# Claude Vision Skill

让没有识图能力的模型获得识图能力——把图片发给有 vision 的模型，用文字描述回来。

---

## 如果你是 AI（Claude Code），请读这里

用户把这个链接发给你，是想让你帮他配置识图。先确认信息，再按场景执行。

### 先确认

问用户：
1. 想用哪个识图服务？
   - **推荐千问**（`qwen3.5-omni-plus` / `qwen-vl-max`）：阿里云百炼，新用户 100 万 token 免费，约 0.02 元/次
   - 也可以用 OpenAI（`gpt-4o-mini`）或其他支持 OpenAI 兼容格式的 vision 模型
2. API Key 是什么？没申请的话引导去对应平台注册
3. （如果用非千问服务）API Base URL 是什么？

### 场景 A：用户要在普通 Claude Code 项目里用

1. 把这个仓库里的 `vision.js` 下载到项目根目录
2. 替换 `vision.js` 里的 `sk-xxx` → 用户的 Key，`xxx` → 模型名。如果用的不是千问，同步改 `BASE_URL`
3. 把 `CLAUDE.md` 的内容合并到项目的 `CLAUDE.md`（没有就新建）
4. 告诉用户：配置完成，以后直接发图片就行，AI 会自动识图

### 场景 B：用户要在 cyberboss 里用

1. 先执行场景 A 的所有步骤
2. 接着读这个仓库里的 `cyberboss-setup.md`，按它说的改 persona 和 `src/core/app.js`
3. 告诉用户：重启 cyberboss 后生效，微信里直接发图片就能识图

### 场景 C：用户只想了解这是什么

简要解释：
- `vision.js` 是核心，读取图片 → base64 → 发给 vision 模型 API → 返回文字描述
- 走 OpenAI 兼容格式，不绑定特定厂商
- 推荐千问是因为有免费额度；有别的便宜 vision API 也能用
- 配置好之后，用户直接发图片，AI 自动处理，无需手动打命令

---

## 如果你是人类，请读这里

### 这是什么

一个让 DeepSeek 等无 vision 能力的模型也能"看图"的脚本。配置好之后，直接发图片 AI 就会自动识别。

### 推荐识图服务

| 服务 | 模型 | 备注 |
|------|------|------|
| **阿里云百炼（推荐）** | `qwen3.5-omni-plus` | 新用户 100 万 token 免费 |
| 阿里云百炼 | `qwen-vl-max` | 同上 |
| OpenAI | `gpt-4o-mini` | 需海外支付 |
| 其他 | 任何 OpenAI 兼容格式 | 改 `BASE_URL` 和模型名即可 |

### 自动配置

**方式一（推荐）**：先把仓库 clone 到本地，然后告诉 Claude Code 本地路径：

```
git clone https://github.com/asuojun/claude-vision-skill.git
```

然后在 Claude Code 里说：

> 读一下 claude-vision-skill/README.md，帮我配置识图

**方式二**：直接发 GitHub 链接（DeepSeek 等第三方模型可能无法访问 GitHub）：

> 按 https://github.com/asuojun/claude-vision-skill 的 README 帮我配置识图

AI 会问你用什么服务、Key 是什么，然后自动配好。

### 手动配置

1. 把 `vision.js` 拷到项目里
2. 打开 `vision.js`，填 API Key、模型名（如用非千问服务还需改 API 地址）
3. 把 `CLAUDE.md` 放到项目根目录

### 文件说明

| 文件 | 用途 |
|------|------|
| `vision.js` | 核心脚本，OpenAI 兼容格式 |
| `CLAUDE.md` | 项目说明书，告诉 AI 何时用 vision.js |
| `cyberboss-setup.md` | cyberboss 自动配置指令 |
