---
name: claude-vision-skill
description: Use when the user shares, pastes, or references an image (local path or URL) and you need to describe, analyze, or recognize its content, especially when the current model cannot read images directly. Run the bundled vision.js helper to convert the image into text.
---

# Vision Helper

The current model may not support native image input. This skill is a
sidecar workflow: it sends the image to a separate vision model and returns
text to the current model. It does not add native image input to the current
model.

When this skill is installed as a Claude Code skill, use the bundled script
through `${CLAUDE_SKILL_DIR}` so the command works from personal, project, or
plugin installations:

```bash
node "${CLAUDE_SKILL_DIR}/vision.js" "<absolute image path>" "<prompt>"
```

If the repository was installed using the project-root setup described in
the README, use the copied script instead:

```bash
node vision.js "<absolute image path>" "<prompt>"
```

For an image URL:

```bash
node "${CLAUDE_SKILL_DIR}/vision.js" --url "<image url>" "<prompt>"
```

Use `node vision.js --url` instead when using the project-root setup.

When the user pastes an image into the chat but no file path or URL is visible,
do not pass the raw image to the text-only model. Read the image from the
clipboard first:

```bash
node "${CLAUDE_SKILL_DIR}/vision.js" --clipboard "<prompt>"
```

Use `node vision.js --clipboard` instead when using the project-root setup.

`--clipboard` reads the current image from the system clipboard (macOS uses a bundled Swift helper, Windows uses a bundled PowerShell script; the pasted image is usually still there). If it fails, ask the user to save the image to a file and provide the absolute path.

Fallback rules (automatic):

- If a local path is given but the file does not exist, vision.js automatically falls back to the clipboard.
- If no image path or URL is given at all, vision.js automatically tries the clipboard.
- Pass `--no-fallback` to disable this behavior and fail with an explicit error instead.

Rules:

- Use `${CLAUDE_SKILL_DIR}/vision.js` for a bundled skill installation, or the
  project-root `vision.js` for the manual setup. Never use a path tied to the
  maintainer's machine.
- Use an absolute image path for local files, or `--url` for remote images.
- Prefer `--clipboard` when the user pasted an image with no accessible path.
- Pass the user's original question as the prompt instead of replacing it with
  a generic description request. Use Chinese for descriptions unless the user
  asks otherwise.
- Configuration lives in `.env` next to `vision.js` (`DASHSCOPE_API_KEY`, `VISION_MODEL`, `DASHSCOPE_BASE_URL`). Never print or commit the API key.
- If the API call fails, report the error to the user and ask them to check the key, model, or base URL.
