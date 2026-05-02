# Cyberboss 识图配置 — 给 Claude Code 执行的指令

请你帮我完成以下操作，不要问问题，直接执行：

## 步骤 1：拷贝 vision.js

把当前目录(claude-version-skill)下的 `vision.js` 拷贝到cyberboss文件夹中的 `scripts/vision.js`。
如果 `scripts/` 目录不存在就创建它。

## 步骤 2：修改 app.js

打开 `src/core/app.js`，找到 `buildInboundText` 函数里这一段：

```
if (runtimeUsesReadForImages(runtimeId)) {
    lines.push("Read every image first with `Read`.");
}
```

替换成：

```
lines.push("If your model has native vision, use `Read` on each image.");
lines.push("If your model does NOT have vision (e.g. DeepSeek), for EVERY image run:");
lines.push('  node scripts/vision.js "<path>" "请用中文描述这张图片的内容"');
lines.push("Say nothing before all images are processed.");
```

## 步骤 3：验证

跑一下 `node scripts/vision.js` 确保没有语法错误。

## 步骤 4：告诉用户

改完后告诉用户：重启 cyberboss 即可生效。以后微信发图片，AI 会自动用 vision.js 识图。
