---
name: vision
description: 识图 — 用千问 VL 模型分析图片内容。不依赖原生 vision 能力。
argument-hint: <图片路径或URL> [问题?]
---

# 识图 Skill

调用 vision.js 分析图片内容，适用于没有原生识图能力的模型（如 DeepSeek）。

## 使用

```
/vision /path/to/image.jpg
/vision --url https://example.com/photo.png
/vision photo.jpg 这张图里有什么？
```

## 要求

- `vision.js` 在项目根目录
- `DASHSCOPE_API_KEY` 已配置（环境变量或 .env）
- 需要 `npm install dotenv`（如使用 .env 文件）

## 原理

将图片 base64 编码后发给通义千问 VL 模型 (`qwen3.5-omni-plus`)，返回文字描述。
走阿里云百炼 DashScope，按量付费 ~¥0.02/次。
