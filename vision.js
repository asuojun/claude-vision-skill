#!/usr/bin/env node
/**
 * 独立识图脚本 — 调用千问 VL 模型，按量付费。
 *
 * 用法:
 *   node vision.js <图片路径> [问题]
 *   node vision.js --url <图片链接> [问题]
 *   node vision.js --clipboard [问题]
 *
 * 依赖:
 *   npm install dotenv (可选，如果有 .env 文件)
 *   DASHSCOPE_API_KEY 环境变量 或 同目录 .env 文件
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const os = require("os");
const { execFileSync } = require("child_process");

// 尝试加载 .env（先找当前目录，再找脚本所在目录）
try { require("dotenv").config(); } catch {}
try { require("dotenv").config({ path: path.resolve(__dirname, ".env") }); } catch {}

const BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const API_KEY = process.env.DASHSCOPE_API_KEY || "";
const MODEL = process.env.VISION_MODEL || "";

function parseArgs() {
  const argv = process.argv.slice(2);
  let imageSource = "", prompt = "", isUrl = false, useClipboard = false, noFallback = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--clipboard") {
      useClipboard = true;
    } else if (argv[i] === "--no-fallback") {
      noFallback = true;
    } else if (argv[i] === "--url" && argv[i + 1]) {
      isUrl = true;
      imageSource = argv[++i];
    } else if (useClipboard && !argv[i].startsWith("--")) {
      prompt = prompt ? prompt + " " + argv[i] : argv[i];
    } else if (!imageSource && !argv[i].startsWith("--")) {
      imageSource = argv[i];
    } else if (imageSource && !argv[i].startsWith("--")) {
      prompt = prompt ? prompt + " " + argv[i] : argv[i];
    }
  }
  if (/^https?:\/\//i.test(imageSource)) {
    isUrl = true;
  }
  if (!prompt) prompt = "请详细描述这张图片的内容。";
  return { imageSource, prompt, isUrl, useClipboard, noFallback };
}

function getClipboardReader() {
  if (process.platform === "darwin") {
    return (outPath) => {
      execFileSync("/usr/bin/swift", [path.join(__dirname, "clipboard.swift"), outPath], {
        stdio: "pipe",
      });
      return outPath;
    };
  }
  if (process.platform === "win32") {
    return (outPath) => {
      execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Sta",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          path.join(__dirname, "clipboard.ps1"),
          "-OutFile",
          outPath,
        ],
        { stdio: "pipe", windowsHide: true },
      );
      return outPath;
    };
  }
  return null;
}

function readClipboardImage() {
  const reader = getClipboardReader();
  if (!reader) {
    throw new Error(
      `剪贴板读取暂不支持当前平台: ${process.platform}（目前支持 macOS / Windows）`,
    );
  }
  const outPath = path.join(os.tmpdir(), `vision-clipboard-${Date.now()}.png`);
  return reader(outPath);
}

function resolveImageUrl(source, isUrl) {
  if (isUrl) return source;
  const resolved = path.resolve(source);
  if (!fs.existsSync(resolved)) throw new Error(`文件不存在: ${resolved}`);
  const ext = path.extname(resolved).toLowerCase().replace(".", "");
  const mimeMap = { jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "webp", bmp: "bmp" };
  const data = fs.readFileSync(resolved);
  return `data:image/${mimeMap[ext] || "jpeg"};base64,${data.toString("base64")}`;
}

function request(payload) {
  const url = new URL(BASE_URL.replace(/\/?$/, "/") + "chat/completions");
  const body = JSON.stringify(payload);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error(`API ${res.statusCode}: ${data.slice(0, 300)}`));
        try {
          resolve(JSON.parse(data)?.choices?.[0]?.message?.content || data);
        } catch { resolve(data); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const missing = [];
  if (!API_KEY) missing.push("DASHSCOPE_API_KEY");
  if (!MODEL) missing.push("VISION_MODEL");
  if (missing.length) {
    console.error(`请设置以下配置：${missing.join(", ")}（环境变量或 .env 文件）`);
    console.error("获取 Key: https://bailian.console.aliyun.com/");
    process.exit(1);
  }
  const { imageSource, prompt, isUrl, useClipboard, noFallback } = parseArgs();
  let source = imageSource;

  const tryClipboard = () => {
    try {
      source = readClipboardImage();
      console.error("（未提供可用图片路径，已自动回退读取系统剪贴板）");
      return true;
    } catch (err) {
      console.error("剪贴板读取失败:", err.message);
      return false;
    }
  };

  const showUsage = () => {
    console.error("用法: node vision.js <图片路径> [问题]");
    console.error("      node vision.js --url <图片链接> [问题]");
    console.error("      node vision.js --clipboard [问题]");
  };

  if (useClipboard) {
    if (imageSource || isUrl) {
      console.error("--clipboard 不能和图片路径或 --url 同时使用。");
      process.exit(1);
    }
    if (!tryClipboard()) process.exit(1);
  } else if (source && !isUrl) {
    const resolved = path.resolve(source);
    if (!fs.existsSync(resolved)) {
      if (noFallback) {
        console.error(`文件不存在: ${resolved}`);
        process.exit(1);
      }
      if (!tryClipboard()) process.exit(1);
    }
  } else if (!source) {
    if (noFallback) {
      showUsage();
      process.exit(1);
    }
    if (!tryClipboard()) process.exit(1);
  }

  if (!source) {
    showUsage();
    process.exit(1);
  }
  try {
    const imageUrl = resolveImageUrl(source, isUrl);
    const result = await request({
      model: MODEL,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: imageUrl } },
        { type: "text", text: prompt },
      ]}],
      stream: false,
      max_tokens: 1024,
    });
    console.log(result);
  } catch (err) {
    console.error("识图失败:", err.message);
    process.exit(1);
  }
}

main();
