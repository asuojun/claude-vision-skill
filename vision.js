#!/usr/bin/env node
/**
 * 独立识图脚本 — 同时支持 OpenAI 兼容协议 与 Anthropic 原生协议，按量付费。
 *
 * 用法:
 *   node vision.js <图片路径> [问题]
 *   node vision.js --url <图片链接> [问题]
 *
 * 配置（环境变量 或 同目录 .env 文件）:
 *   VISION_PROVIDER          协议切换: openai | anthropic（默认 openai）
 *
 *   ── OpenAI 兼容协议（默认，兼容阿里云百炼 / OpenAI 等）──
 *     OPENAI_BASE_URL        API 地址（默认 https://dashscope.aliyuncs.com/compatible-mode/v1）
 *     OPENAI_API_KEY         API Key
 *     OPENAI_VISION_MODEL    视觉模型名
 *     兼容旧变量: DASHSCOPE_BASE_URL / DASHSCOPE_API_KEY / VISION_MODEL
 *
 *   ── Anthropic 原生协议 ──
 *     ANTHROPIC_BASE_URL     默认 https://api.anthropic.com
 *     ANTHROPIC_API_KEY      API Key（sk-ant-...）
 *     ANTHROPIC_VISION_MODEL 默认 claude-sonnet-4-20250514
 *
 * 依赖:
 *   npm install dotenv (可选，如果有 .env 文件)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ── .env 加载（零依赖）──
// 优先用 dotenv（若已安装）；未安装时用内置解析器，保证拷贝脚本到任何项目都能读 .env。
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
  // 先找当前目录，再找脚本所在目录
  applyEnvFile(path.resolve(process.cwd(), ".env"));
  applyEnvFile(path.resolve(__dirname, ".env"));
}

const MIME_MAP = { jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "webp", bmp: "bmp" };
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 下载大小上限 10MB（Anthropic 单图约 5MB）
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
  const provider = (process.env.VISION_PROVIDER || "openai").toLowerCase();
  if (provider !== "openai" && provider !== "anthropic") {
    throw new Error(`不支持的 VISION_PROVIDER: ${provider}（可选 openai 或 anthropic）`);
  }
  if (provider === "anthropic") {
    return {
      provider: "anthropic",
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-20250514",
    };
  }
  return {
    provider: "openai",
    baseUrl: process.env.OPENAI_BASE_URL || process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY || "",
    model: process.env.OPENAI_VISION_MODEL || process.env.VISION_MODEL || "xxx",
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
    transport.get(url, (res) => {
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
    }).on("error", (err) => done(reject, err));
  });
}

function mimeFromUrl(urlStr) {
  const ext = path.extname(new URL(urlStr).pathname).toLowerCase().replace(".", "");
  return MIME_MAP[ext] || null;
}

/**
 * 解析图片输入为各协议需要的格式。
 * - 本地文件: 始终转 base64 + mime
 * - 远程 URL: OpenAI 兼容协议可直接传 URL；Anthropic 协议只接受 base64，需先下载
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

function buildRequest(cfg, image, prompt) {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  if (cfg.provider === "anthropic") {
    // 部分服务（如 Kimi coding）的 base URL 已含 /v1，需适配拼接
    const messagesPath = /\/v1$/i.test(base) ? "/messages" : "/v1/messages";
    return {
      url: base + messagesPath,
      headers: {
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 1024,
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
  // OpenAI 兼容协议
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
    r.on("error", reject);
    r.write(req.body);
    r.end();
  });
}

function parseResponse(provider, raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return raw; }
  if (provider === "anthropic") {
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return text || raw;
  }
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
      ? "请设置 ANTHROPIC_API_KEY 环境变量或在 .env 文件中配置。获取 Key: https://console.anthropic.com/"
      : "请设置 OPENAI_API_KEY（或兼容旧变量 DASHSCOPE_API_KEY）环境变量或在 .env 文件中配置。获取 Key: https://bailian.console.aliyun.com/");
    process.exit(1);
  }
  const { imageSource, prompt, isUrl } = parseArgs();
  if (!imageSource) {
    console.error("用法: node vision.js <图片路径> [问题]");
    console.error("      node vision.js --url <图片链接> [问题]");
    console.error("协议:  通过 VISION_PROVIDER=openai|anthropic 切换（默认 openai）");
    process.exit(1);
  }
  try {
    const image = await resolveImage(imageSource, isUrl, cfg.provider);
    const req = buildRequest(cfg, image, prompt);
    const raw = await request(req);
    console.log(parseResponse(cfg.provider, raw));
  } catch (err) {
    console.error("识图失败:", err.message);
    process.exit(1);
  }
}

main();
