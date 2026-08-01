# Claude Vision Skill

让没有识图能力的模型获得识图能力——把图片发给有 vision 的模型，用文字描述回来。

---

## 如果你是 AI（Claude Code），请读这里

用户把这个链接发给你，是想让你帮他配置识图。先确认信息，再按场景执行。

### 先确认

问用户：
1. 想用哪个识图服务 / 协议？
   - **OpenAI 兼容协议**（默认）：推荐千问（`qwen3.5-omni-plus` / `qwen-vl-max`，阿里云百炼，新用户 100 万 token 免费），也可用 OpenAI（`gpt-4o-mini`）或其他兼容服务
   - **Anthropic 原生协议**：Claude 系列（如 `claude-sonnet-4-20250514`）
2. API Key 是什么？没申请的话引导去对应平台注册
3. （如果用非千问的 OpenAI 兼容服务）API Base URL 是什么？

### 场景 A：用户要在普通 Claude Code 项目里用

1. 把这个仓库里的 `vision.js` 下载到项目根目录
2. 创建 `.env` 文件（或设置环境变量）：
   - 用 OpenAI 兼容协议（默认，千问等）：
     ```
     OPENAI_API_KEY=用户Key
     OPENAI_VISION_MODEL=qwen3.5-omni-plus
     # OPENAI_BASE_URL=非千问服务才需要改
     ```
   - 或用 Anthropic 原生协议：
     ```
     VISION_PROVIDER=anthropic
     ANTHROPIC_API_KEY=sk-ant-用户Key
     ANTHROPIC_VISION_MODEL=claude-sonnet-4-20250514
     ```
3. 把 `CLAUDE.md` 的内容合并到项目的 `CLAUDE.md`（没有就新建）
4. 告诉用户：配置完成，以后直接发图片就行，AI 会自动识图

### 多项目公用（公共脚本库，不用每个项目都拷）

`vision.js` 是独立脚本，不依赖项目目录。**如果这个仓库已 clone 在本地**（例如 `D:\workspace\claude-vision-skill`），其他项目不需要再拷贝一份：

1. 把 `vision.js` + `.env`（API Key 配置）留在仓库里，当作公共脚本库
2. 其他项目的 `CLAUDE.md` 里用**绝对路径**调用：
   ```
   node D:\workspace\claude-vision-skill\vision.js "<图片绝对路径>" "请用中文描述这张图片"
   ```
3. `.env` 查找顺序：先找**当前工作目录**，再找**脚本所在目录**
   - 想让所有项目共用同一份 Key/模型 → 配置放公共脚本目录（本仓库）即可
   - 某个项目想用不同 Key/模型 → 在该项目目录放一个自己的 `.env`，自动覆盖公共配置
4. 唯一要求：运行命令的机器能访问到图片文件（同机路径或网络路径均可）

### 场景 B：用户要在 cyberboss 里用

1. 先执行场景 A 的所有步骤
2. 接着读这个仓库里的 `cyberboss-setup.md`，按它说的改 persona 和 `src/core/app.js`
3. 告诉用户：重启 cyberboss 后生效，微信里直接发图片就能识图

### 场景 C：用户只想了解这是什么

简要解释：
- `vision.js` 是核心，读取图片 → base64 → 发给 vision 模型 API → 返回文字描述
- 同时支持 OpenAI 兼容格式和 Anthropic 原生协议，通过 `VISION_PROVIDER` 环境变量切换，不绑定特定厂商
- 推荐千问是因为有免费额度；有别的便宜 vision API 也能用
- 配置好之后，用户直接发图片，AI 自动处理，无需手动打命令

---

## 如果你是人类，请读这里

### 这是什么

一个让 DeepSeek 等无 vision 能力的模型也能"看图"的脚本。配置好之后，直接发图片 AI 就会自动识别。

### 推荐识图服务

| 协议 | 服务 | 模型 | 备注 |
|------|------|------|------|
| OpenAI 兼容（默认） | **阿里云百炼** | `qwen3.5-omni-plus` | 新用户 100 万 token 免费 |
| OpenAI 兼容（默认） | 阿里云百炼 | `qwen-vl-max` | 同上 |
| OpenAI 兼容（默认） | OpenAI | `gpt-4o-mini` | 需海外支付 |
| OpenAI 兼容（默认） | 其他 | 任意兼容模型 | 改 `OPENAI_BASE_URL` 和模型名即可 |
| Anthropic 原生 | Anthropic | `claude-sonnet-4-20250514` 等 | 用 Claude 官方 API 时选 |

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
2. 在项目根目录创建 `.env`（或设置环境变量）：
   - **OpenAI 兼容协议**（默认，千问 / OpenAI 等）：
     ```ini
     OPENAI_API_KEY=你的Key
     OPENAI_VISION_MODEL=qwen3.5-omni-plus
     # OPENAI_BASE_URL=https://api.openai.com/v1   # 非千问服务改成对应地址
     ```
   - **Anthropic 原生协议**：
     ```ini
     VISION_PROVIDER=anthropic
     ANTHROPIC_API_KEY=sk-ant-你的Key
     ANTHROPIC_VISION_MODEL=claude-sonnet-4-20250514
     # ANTHROPIC_BASE_URL=https://api.anthropic.com
     ```
3. 把 `CLAUDE.md` 放到项目根目录

### 多项目公用（公共脚本库）

不想每个项目都拷一份？把 `vision.js` + `.env` 放在一个固定目录（比如这个仓库），其他项目用**绝对路径**调用即可：

```powershell
node D:\workspace\claude-vision-skill\vision.js "D:\other-project\photo.jpg" "描述这张图"
```

`.env` 查找顺序：**当前工作目录优先，脚本所在目录兜底**。公共 Key 放脚本目录，个别项目想覆盖就在项目目录放自己的 `.env`。

### 文件说明

| 文件 | 用途 |
|------|------|
| `vision.js` | 核心脚本，同时支持 OpenAI 兼容 / Anthropic 原生两种协议，用 `VISION_PROVIDER` 切换 |
| `CLAUDE.md` | 项目说明书，告诉 AI 何时用 vision.js |
| `cyberboss-setup.md` | cyberboss 自动配置指令 |
