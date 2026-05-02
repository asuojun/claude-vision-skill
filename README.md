# Claude Vision Skill

让没有识图能力的模型获得识图能力——把图片发给千问 VL，用文字描述回来。

---

## 如果你是 AI（Claude Code），请读这里

用户把这个仓库链接发给你，是想让你帮他配置识图功能。请按用户的需求执行以下操作。

### 先确认

问用户两个问题：
1. 你的千问 API Key 是什么？（没申请的话去 https://bailian.console.aliyun.com/ 注册，新用户免费）
2. 你想用哪个千问模型？（默认 `qwen3.5-omni-plus`，可选 `qwen-vl-max`、`qwen-vl-plus`）

### 场景 A：用户要在当前项目里用

1. 把这个仓库里的 `vision.js` 下载到当前项目的根目录
2. 把 `vision.js` 里的 `sk-xxx` 替换成用户的 API Key，`xxx` 替换成模型名
3. 把 `vision.md` 放到 `.claude/skills/vision.md`
4. 把 `CLAUDE.md` 的内容合并到项目已有的 `CLAUDE.md`（没有就新建）
5. 告诉用户：搞定了，以后遇到图片自动识图，也支持 `/vision 图片路径`

### 场景 B：用户要在 cyberboss 里用

1. 执行场景 A 的所有步骤
2. 接着读这个仓库里的 `cyberboss-setup.md`，按它说的改 cyberboss 源码
3. 告诉用户：重启 cyberboss 生效

### 场景 C：用户只想先看看

简要解释：
- `vision.js` 是核心，读取图片 → base64 → 千问 VL API → 文字描述
- 支持本地路径和 URL
- 约 0.02 元/次，新用户有 100 万 token 免费额度

---

## 如果你是人类，请读这里

### 你需要准备

1. **Node.js**（一般已经有了）
2. **千问 API Key**：去 [阿里云百炼](https://bailian.console.aliyun.com/) 注册 → 免费开通 → 创建 API Key
3. 把这个 GitHub 链接发给 Claude Code，说一句：

> 按这个 README 帮我配置识图

Claude Code 会自动帮你搞定一切。

### 手动配置

如果你不想让 AI 帮你配：

1. 把 `vision.js` 拷到项目里
2. 打开 `vision.js`，把 `sk-xxx` 换成你的 Key
3. 把 `vision.md` 放到 `.claude/skills/`
4. 把 `CLAUDE.md` 放到项目根目录

### cyberboss 用户

让 Claude Code 在 cyberboss 目录下读 `cyberboss-setup.md`，它会自动改好。

### 费用

千问 VL 按量付费，约 0.02 元/次。新用户 100 万 token 免费额度。

### 文件说明

| 文件 | 用途 |
|------|------|
| `vision.js` | 核心脚本 |
| `vision.md` | 放到 `.claude/skills/`，支持 `/vision` |
| `CLAUDE.md` | 项目说明书，AI 自动读 |
| `cyberboss-setup.md` | cyberboss 自动配置指令 |
