# Claude Vision Skill

让没有识图能力的模型获得识图能力——把图片发给有 vision 的模型，用文字描述回来。

---

## 如果你是 AI（Claude Code），请读这里

用户把这个链接发给你，是想让你帮他配置识图。按以下流程走。

### 第一步：确认信息

问用户：
1. 想用哪个识图服务？
   - **推荐千问**（`qwen3.5-omni-plus` 或 `qwen-vl-max`）：阿里云百炼，新用户 100 万 token 免费，约 0.02 元/次
   - 也可以用其他支持 OpenAI 兼容格式的 vision 模型（GPT-4o、Claude 等），只需改 API 地址和模型名
2. API Key 是什么？（没申请的话引导用户去对应平台注册）
3. （可选）API Base URL，默认千问的 `https://dashscope.aliyuncs.com/compatible-mode/v1`

### 第二步：配置

1. 把这个仓库里的 `vision.js` 下载到项目根目录
2. 在 `vision.js` 里替换：
   - `sk-xxx` → 用户的 API Key
   - `xxx` → 模型名（默认千问，用户选别的就改）
   - 如果用的不是千问，还要改 `BASE_URL` 那行的默认值
3. 把 `vision.md` 放到 `.claude/skills/vision.md`
4. 把 `CLAUDE.md` 的内容合并到项目已有的 `CLAUDE.md`（没有就新建）

### 第三步：告知用户

告诉用户配置完成，以后：
- 对话中提到图片路径会自动调 vision.js
- 也可以手动 `/vision <图片路径>`
- 如果用户还要配 cyberboss，读这个仓库的 `cyberboss-setup.md` 继续

---

## 如果你是人类，请读这里

### 这是什么

一个让 DeepSeek 等无 vision 能力的模型也能"看图"的脚本。
原理：图片 → base64 → 发给有 vision 的模型 API → 返回文字描述。

### 推荐识图服务

| 服务 | 模型 | 费用 | 备注 |
|------|------|------|------|
| **阿里云百炼（推荐）** | `qwen3.5-omni-plus` | ~0.02 元/次 | 新用户 100 万 token 免费 |
| 阿里云百炼 | `qwen-vl-max` | ~0.02 元/次 | 同上 |
| OpenAI | `gpt-4o-mini` | ~$0.00015/次 | 需海外支付 |
| 其他 | 任何 OpenAI 兼容格式 | 各异 | 改 `BASE_URL` 和模型名即可 |

如果你有其他便宜或免费的 vision API，也可以用它——`vision.js` 走的是 OpenAI 兼容格式，兼容性很广。

### 自动配置

把这个 GitHub 链接发给 Claude Code，说一句：

> 按这个 README 帮我配置识图

AI 会自动帮你搞定。

### 手动配置

1. 把 `vision.js` 拷到项目里
2. 打开 `vision.js`，改 API Key、模型名（如需改 API 地址）
3. 把 `vision.md` 放到 `.claude/skills/`
4. 把 `CLAUDE.md` 放到项目根目录

### cyberboss 用户

让 Claude Code 在 cyberboss 目录下读 `cyberboss-setup.md`，自动改好。

### 文件说明

| 文件 | 用途 |
|------|------|
| `vision.js` | 核心脚本，OpenAI 兼容格式 |
| `vision.md` | Skill 文件，放到 `.claude/skills/` |
| `CLAUDE.md` | 项目说明书 |
| `cyberboss-setup.md` | cyberboss 自动配置指令 |
