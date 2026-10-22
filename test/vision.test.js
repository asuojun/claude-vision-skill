const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const script = path.resolve(__dirname, "..", "vision.js");

test("reports missing vision configuration before trying to read an image", () => {
  const result = spawnSync(process.execPath, [script, "--no-fallback"], {
    encoding: "utf8",
    env: {
      ...process.env,
      DASHSCOPE_API_KEY: "",
      VISION_MODEL: "",
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /DASHSCOPE_API_KEY/);
  assert.match(result.stderr, /VISION_MODEL/);
});

test("fails clearly for a missing image path when clipboard fallback is disabled", () => {
  const result = spawnSync(process.execPath, [script, "missing-image.png", "--no-fallback"], {
    encoding: "utf8",
    env: {
      ...process.env,
      DASHSCOPE_API_KEY: "test-key",
      VISION_MODEL: "test-model",
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /文件不存在/);
});
