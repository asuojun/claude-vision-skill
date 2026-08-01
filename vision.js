#!/usr/bin/env node
/**
 * 识图脚本 — 把图片发给有视觉能力的模型，取回文字描述。
 * 支持两种协议（由 VISION_PROVIDER 决定）：
 *   - anthropic : Anthropic Messages API（Kimi/Moonshot 等兼容服务）
 *   - dashscope : OpenAI 兼容格式（阿里云百炼、OpenAI 等，默认）
 *   - openai    : dashscope 的兼容别名（旧配置可直接沿用）
 *
 * 用法:
 *   node vision.js <图片路径> [问题]
 *   node vision.js --url <图片链接> [问题]
 *
 * 配置: 环境变量 或 .env 文件（零第三方依赖；同名环境变量优先于 .env）。
 *   VISION_PROVIDER=dashscope|anthropic
 *   dashscope: DASHSCOPE_BASE_URL / DASHSCOPE_API_KEY / VISION_MODEL
 *              （兼容别名 OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_VISION_MODEL）
 *   anthropic: ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY / ANTHROPIC_VISION_MODEL
 *              （base 已含 /v1 的服务如 Kimi 直接填 base 即可，端点自动适配）
 *
 * 说明:
 *   - anthropic 响应优先取 text 块；模型只输出 thinking 时回退展示思考过程
 *   - max_tokens 4096（thinking 模型需要更大额度才不会被截断正文）
 *   - --url 下载跟随重定向、限 10MB、校验 Content-Type、magic bytes 检测真实格式
 */
'use strict';

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ── .env 加载（零依赖；dotenv 已安装时优先用它）──
function applyEnvFile(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\s+#.*$/, ""); // 去掉行尾注释
    if (process.env[m[1]] === undefined && value !== "") process.env[m[1]] = value;
  }
}

let hasDotenv = false;
try { require("dotenv"); hasDotenv = true; } catch {}
if (hasDotenv) {
  try { require("dotenv").config(); } catch {}
  try { require("dotenv").config({ path: path.resolve(__dirname, ".env") }); } catch {}
} else {
  // 先找当前工作目录，再找脚本所在目录（多项目公用时项目可覆盖公共配置）
  applyEnvFile(path.resolve(process.cwd(), ".env"));
  applyEnvFile(path.resolve(__dirname, ".env"));
}

const MIME_MAP = { jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "webp", bmp: "bmp" };
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 下载大小上限 10MB
const MAX_REDIRECTS = 5; // 下载重定向上限

/** 用 magic bytes 检测真实图片格式，返回规范 mime（如 jpeg/png），无法识别返回 null */
function detectImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif"; // GIF8
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "webp"; // RIFF....WEBP
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "bmp"; // BM
  return null;
}

function loadConfig() {
  const raw = (process.env.VISION_PROVIDER || "dashscope").toLowerCase();
  const provider = raw === "openai" ? "dashscope" : raw; // openai 是 dashscope 的兼容别名
  if (provider !== "dashscope" && provider !== "anthropic") {
    throw new Error(`不支持的 VISION_PROVIDER: ${raw}（可选 dashscope 或 anthropic）`);
  }
  if (provider === "anthropic") {
    return {
      provider,
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: process.env.ANTHROPIC_VISION_MODEL || "",
    };
  }
  return {
    provider: "dashscope",
    baseUrl: process.env.DASHSCOPE_BASE_URL || process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY || "",
    model: process.env.VISION_MODEL || process.env.OPENAI_VISION_MODEL || "",
  };
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let imageSource = "", prompt = "", isUrl = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) {
      isUrl = true;
      imageSource = argv[++i];
    } else if (!imageSource && !argv[i].startsWith("--")) {
      imageSource = argv[i];
    } else if (imageSource && !argv[i].startsWith("--")) {
      prompt = prompt ? prompt + " " + argv[i] : argv[i];
    }
  }
  if (!prompt) prompt = "请详细描述这张图片的内容。";
  return { imageSource, prompt, isUrl };
}

/**
 * 下载远程图片：跟随 3xx 重定向（Node 原生 http 不会自动跟随）、限制大小、校验 Content-Type。
 * 返回 { buf, mime }，mime 来自响应 Content-Type（规范化）。
 */
function fetchBuffer(urlStr, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };
    let url;
    try { url = new URL(urlStr); }
    catch (err) { return done(reject, new Error(`图片链接无效: ${err.message}`)); }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return done(reject, new Error(`不支持的图片协议: ${url.protocol}`));
    }
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.get(url, (res) => {
      const status = res.statusCode;
      // 3xx 重定向：递归跟随，带次数上限
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return done(reject, new Error("下载图片重定向次数过多"));
        const next = new URL(res.headers.location, url).href;
        return fetchBuffer(next, redirectsLeft - 1).then(done.bind(null, resolve), done.bind(null, reject));
      }
      if (status >= 400) {
        res.resume();
        return done(reject, new Error(`下载图片失败: HTTP ${status}`));
      }
      const contentType = String(res.headers["content-type"] || "").split(";")[0].trim();
      if (!contentType.startsWith("image/")) {
        res.resume();
        return done(reject, new Error(`下载图片失败: 响应不是图片 (Content-Type: ${contentType || "未知"})`));
      }
      const declared = Number(res.headers["content-length"] || 0);
      if (declared > MAX_DOWNLOAD_BYTES) {
        res.resume();
        return done(reject, new Error(`图片过大: ${declared} 字节（上限 ${MAX_DOWNLOAD_BYTES}）`));
      }
      const chunks = [];
      let total = 0;
      res.on("data", (c) => {
        total += c.length;
        if (total > MAX_DOWNLOAD_BYTES) {
          res.destroy();
          return done(reject, new Error(`图片超过 ${MAX_DOWNLOAD_BYTES} 字节上限`));
        }
        chunks.push(c);
      });
      res.on("end", () => {
        const mime = contentType.slice("image/".length).toLowerCase();
        done(resolve, { buf: Buffer.concat(chunks), mime: MIME_MAP[mime] || mime });
      });
      res.on("error", (err) => done(reject, err));
      req.setTimeout(60000, () => req.destroy(new Error("下载图片超时（60s）")));
      req.on("error", (err) => done(reject, err));
    }).on("error", (err) => done(reject, err));
  });
}

function mimeFromUrl(urlStr) {
  const ext = path.extname(new URL(urlStr).pathname).toLowerCase().replace(".", "");
  return MIME_MAP[ext] || null;
}

/**
 * 解析图片输入。
 * - 本地文件: 始终转 base64 + mime（magic bytes 优先，扩展名兜底）
 * - 远程 URL: dashscope 协议可直接传 URL；anthropic 协议只接受 base64，需先下载
 */
async function resolveImage(source, isUrl, provider) {
  if (isUrl) {
    if (provider === "anthropic") {
      const { buf, mime: ctMime } = await fetchBuffer(source);
      const mime = detectImageMime(buf) || ctMime || mimeFromUrl(source);
      if (!mime) throw new Error(`无法识别图片格式: ${source}`);
      return { base64: buf.toString("base64"), mime };
    }
    return { url: source };
  }
  const resolved = path.resolve(source);
  if (!fs.existsSync(resolved)) throw new Error(`文件不存在: ${resolved}`);
  const ext = path.extname(resolved).toLowerCase().replace(".", "");
  const data = fs.readFileSync(resolved);
  const mime = detectImageMime(data) || MIME_MAP[ext];
  if (!mime) throw new Error(`无法识别图片格式: ${resolved}`);
  return { base64: data.toString("base64"), mime };
}

/** Anthropic 端点拼接：base 已含 /v1（如 Kimi）直接拼 /messages，否则拼 /v1/messages */
function anthropicEndpoint(baseUrl) {
  const base = baseUrl.replace(/\/+$/, "");
  if (/\/messages$/i.test(base)) return base;
  return /\/v1$/i.test(base) ? base + "/messages" : base + "/v1/messages";
}

function buildRequest(cfg, image, prompt) {
  if (cfg.provider === "anthropic") {
    return {
      url: anthropicEndpoint(cfg.baseUrl),
      headers: {
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: `image/${image.mime}`, data: image.base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    };
  }
  // dashscope（OpenAI 兼容）
  const base = cfg.baseUrl.replace(/\/+$/, "");
  return {
    url: base + "/chat/completions",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image.url || `data:image/${image.mime};base64,${image.base64}` } },
          { type: "text", text: prompt },
        ],
      }],
      stream: false,
      max_tokens: 1024,
    }),
  };
}

function request(req) {
  const url = new URL(req.url);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const r = transport.request(url, {
      method: "POST",
      headers: { ...req.headers, "Content-Length": Buffer.byteLength(req.body) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error(`API ${res.statusCode}: ${data.slice(0, 300)}`));
        resolve(data);
      });
    });
    r.setTimeout(60000, () => r.destroy(new Error("请求超时（60s）")));
    r.on("error", reject);
    r.write(req.body);
    r.end();
  });
}

function parseResponse(provider, raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return raw; }
  if (provider === "anthropic") {
    if (Array.isArray(data.content)) {
      // 优先正文；模型只输出 thinking 时回退展示思考过程
      const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (text) return text;
      const thinking = data.content.filter((b) => b.type === "thinking").map((b) => b.thinking).join("\n");
      if (thinking) return "[模型思考过程，未输出正文]\n" + thinking;
    }
    return raw;
  }
  // dashscope（OpenAI 兼容）：content 可能是字符串或块数组
  const content = data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    const text = content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return text || raw;
  }
  return content || raw;
}

async function main() {
  let cfg;
  try { cfg = loadConfig(); }
  catch (err) { console.error("配置错误:", err.message); process.exit(1); }
  if (!cfg.apiKey) {
    console.error(cfg.provider === "anthropic"
      ? "请设置 ANTHROPIC_API_KEY 环境变量或在 .env 文件中配置。获取 Key: https://console.anthropic.com/（Kimi 用户: https://platform.moonshot.cn/）"
      : "请设置 DASHSCOPE_API_KEY（或兼容别名 OPENAI_API_KEY）环境变量或在 .env 文件中配置。获取 Key: https://bailian.console.aliyun.com/");
    process.exit(1);
  }
  if (!cfg.model) {
    console.error(cfg.provider === "anthropic"
      ? "请设置 ANTHROPIC_VISION_MODEL 环境变量或在 .env 文件中配置。"
      : "请设置 VISION_MODEL（或兼容别名 OPENAI_VISION_MODEL）环境变量或在 .env 文件中配置。");
    process.exit(1);
  }
  const { imageSource, prompt, isUrl } = parseArgs();
  if (!imageSource) {
    console.error("用法: node vision.js <图片路径> [问题]");
    console.error("      node vision.js --url <图片链接> [问题]");
    console.error("协议:  通过 VISION_PROVIDER=dashscope|anthropic 切换（默认 dashscope）");
    process.exit(1);
  }
  try {
    // http 明文警告（本地 mock/代理除外）
    try {
      const u = new URL(cfg.baseUrl);
      const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])/i.test(u.hostname);
      if (u.protocol === "http:" && !isLocal) {
        console.error("警告: API 地址使用 http:// 明文传输，API Key 可能被窃听（本地 mock/代理场景除外）");
      }
    } catch {}
    const image = await resolveImage(imageSource, isUrl, cfg.provider);
    const req = buildRequest(cfg, image, prompt);
    const raw = await request(req);
    console.log(parseResponse(cfg.provider, raw));
  } catch (err) {
    // 错误信息里回显的响应体可能包含敏感信息，把 key 打码
    const msg = cfg.apiKey ? err.message.split(cfg.apiKey).join("***") : err.message;
    console.error("识图失败:", msg);
    process.exit(1);
  }
}

main();
