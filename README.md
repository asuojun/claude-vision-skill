# Claude Vision Skill

让没有识图能力的模型（DeepSeek 等）通过千问 VL API 获得识图能力。

## 你需要准备

1. **Node.js**（一般已经有了）
2. **千问 API Key**：[阿里云百炼](https://bailian.console.aliyun.com/) 注册 → 开通 → 创建 Key。新用户 100 万 token 免费额度。
3. 把 `vision.js` 里的 `sk-xxx` 换成你的 Key，`xxx` 换成你想用的千问模型（如 `qwen3.5-omni-plus`、`qwen-vl-max`）

## 用法一：在任意 Claude Code 项目里用

把这整个文件夹的内容拷到你的项目根目录，然后在 Claude Code 里说：

> 读一下 CLAUDE.md，以后遇到图片就用 vision.js

之后只要在对话里写图片路径，AI 就会自动调 vision.js 识图。也支持手动 `/vision 图片路径`。

## 用法二：配到 cyberboss 里

1. 把这整个文件夹放到你能访问的路径（比如 `F:\claude-vision-skill\`）
2. 在 **cyberboss 所在目录**打开 Claude Code
3. 把下面这句话发给 Claude Code：

```
读一下 F:\claude-vision-skill\cyberboss-setup.md，按它说的做
```

然后 Claude Code 会自动改好 cyberboss 源码、拷贝 vision.js、重启服务。

## 文件说明

| 文件 | 用途 |
|------|------|
| `vision.js` | 核心脚本，调千问 API 识图 |
| `vision.md` | Claude Code skill，拷到 `.claude/skills/` 后可用 `/vision` |
| `CLAUDE.md` | 项目说明书，告诉 AI 何时用 vision.js |
| `cyberboss-setup.md` | cyberboss 自动配置 prompt |

## 费用

千问 VL 按量付费，约 ¥0.02/次。新用户 100 万 token 免费额度，够用很久。
