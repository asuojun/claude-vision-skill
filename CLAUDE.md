# 识图能力

你的底层模型不具备原生识图能力。遇到图片时，**不要用 Read 工具**，改用 vision.js：

```
node vision.js "<图片路径>" "用中文描述这张图片"
```

## 触发场景

- 用户分享图片路径（本地或网络 URL）
- 消息中出现 "Saved attachments:" 并列出图片
- 用户要求分析、描述、识别图片内容

## 前置条件

- `DASHSCOPE_API_KEY` 已设为环境变量或 .env 文件
- 获取 Key: https://bailian.console.aliyun.com/
- 计费: 按量付费 ~¥0.02/次

## 也支持手动调用

输入 `/vision <图片路径>` 来手动触发识图。
