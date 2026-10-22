#!/usr/bin/env python3
"""
独立识图脚本 — 调用 OpenAI 兼容视觉模型（纯标准库，零依赖）。

用法:
  python vision.py <图片路径> [问题]
  python vision.py --url <图片链接> [问题]

配置:
  环境变量或同目录 .env 文件:
    DASHSCOPE_API_KEY    API Key
    VISION_MODEL         视觉模型名，如 GLM-4.6V-FlashX / qwen-vl-max / gpt-4o-mini
    DASHSCOPE_BASE_URL   API 地址，如 https://open.bigmodel.cn/api/paas/v4/
"""
import sys
import os
import base64
import json
import urllib.request

# ---------- 1. 加载 .env（当前目录优先，脚本目录兜底）----------
def load_dotenv(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                if key.strip() and key.strip() not in os.environ:
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass

load_dotenv(".env")                                                  # 当前目录
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))  # 脚本目录

# ---------- 2. 配置（环境变量优先，.env 兜底）----------
BASE_URL = os.environ.get("DASHSCOPE_BASE_URL", "https://open.bigmodel.cn/api/paas/v4/")
API_KEY  = os.environ.get("DASHSCOPE_API_KEY", "")
MODEL    = os.environ.get("VISION_MODEL", "")

MIME_MAP = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png",
            "gif": "gif", "webp": "webp", "bmp": "bmp"}

# ---------- 3. 图片 → data URI（核心）----------
def resolve_image_url(source, is_url):
    if is_url:
        return source
    ext = os.path.splitext(source)[1].lstrip(".").lower()
    with open(source, "rb") as f:                        # 二进制读图
        data = f.read()
    b64 = base64.b64encode(data).decode("utf-8")         # bytes → base64 字符串
    return f"data:image/{MIME_MAP.get(ext, 'jpeg')};base64,{b64}"

# ---------- 4. 发 HTTP 请求 ----------
def request(payload):
    url = BASE_URL.rstrip("/") + "/chat/completions"     # 拼出完整接口
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {API_KEY}",            # 鉴权
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]      # 取模型回答

# ---------- 5. 命令行参数 ----------
def parse_args(argv):
    source, prompt, is_url, i = "", "", False, 0
    while i < len(argv):
        if argv[i] == "--url" and i + 1 < len(argv):
            is_url, source, i = True, argv[i + 1], i + 2
        elif not source:
            source, i = argv[i], i + 1
        else:
            prompt = (prompt + " " + argv[i]).strip(); i += 1
    return source, prompt or "请详细描述这张图片的内容。", is_url

# ---------- 6. 组装请求体 + 跑 ----------
def main():
    if not API_KEY:
        print("请设置 DASHSCOPE_API_KEY 环境变量或在 .env 中配置。")
        sys.exit(1)
    source, prompt, is_url = parse_args(sys.argv[1:])
    if not source:
        print("用法: python vision.py <图片路径> [问题]")
        print("      python vision.py --url <图片链接> [问题]")
        sys.exit(1)
    result = request({
        "model": MODEL,
        "messages": [{"role": "user", "content": [       # 灵魂：图片块 + 文字块
            {"type": "image_url", "image_url": {"url": resolve_image_url(source, is_url)}},
            {"type": "text", "text": prompt},
        ]}],
        "stream": False,
        "max_tokens": 1024,
    })
    print(result)

if __name__ == "__main__":
    main()
