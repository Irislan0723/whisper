import express from "express";
import { spawn } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const app = express();
app.use(express.json({ limit: "10mb" }));

const TOKEN = process.env.RELAY_TOKEN;
const PORT  = Number(process.env.RELAY_PORT) || 3001;
const TMP   = "/tmp/cc-relay";
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

function auth(req, res, next) {
  if (req.headers["x-relay-token"] !== TOKEN)
    return res.status(401).json({ error: "unauthorized" });
  next();
}

// ── 串行队列（CC CLI 同一时间只能跑一个） ──
let busy = false;
const queue = [];

function enqueue(job) {
  return new Promise((resolve, reject) => {
    queue.push({ ...job, resolve, reject });
    drain();
  });
}

async function drain() {
  if (busy || !queue.length) return;
  busy = true;
  const j = queue.shift();
  try { j.resolve(await invokeClaude(j)); }
  catch (e) { j.reject(e); }
  busy = false;
  drain();
}

// ── CC CLI 调用（支持 --resume 会话续接） ──
function invokeClaude({ systemPrompt, message, model, sessionId }) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--verbose", "--output-format", "stream-json"];

    // 会话续接：有 sessionId 则 --resume，让 CC 维护上下文
    if (sessionId) {
      args.push("--resume", sessionId);
    }

    // 自动压缩上下文
    args.push("--autocompact", "auto");

    // 系统提示词：写入临时文件再用 --system-prompt-file（避免 shell 参数过长）
    let sysPromptFile = null;
    if (systemPrompt) {
      sysPromptFile = join(TMP, `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
      writeFileSync(sysPromptFile, systemPrompt, "utf-8");
      args.push("--system-prompt-file", sysPromptFile);
    }

    if (model) args.push("--model", model);

    console.log("[CC] args:", args.filter(a => !a.startsWith("/tmp")).join(" "),
      sessionId ? `(resume ${sessionId.slice(0, 8)}…)` : "(new session)");

    const proc = spawn("claude", args, {
      timeout: 180000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env }
    });

    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));

    proc.on("error", (e) => {
      if (sysPromptFile) try { unlinkSync(sysPromptFile); } catch (_) {}
      reject(new Error("spawn failed: " + e.message));
    });

    proc.on("close", (code) => {
      // 清理临时系统提示词文件
      if (sysPromptFile) try { unlinkSync(sysPromptFile); } catch (_) {}

      if (code !== 0) return reject(new Error("claude exit " + code + ": " + err.slice(0, 500)));

      // stream-json 输出是多行 JSON，逐行解析
      let resultText = "";
      let resultSessionId = "";
      const thinkingParts = [];

      const lines = out.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);

          // 最终结果行 — 包含 session_id
          if (obj.type === "result") {
            resultText = obj.result || "";
            resultSessionId = obj.session_id || "";
          }

          // assistant 消息行 — 提取 thinking blocks
          if (obj.type === "assistant" && obj.message) {
            const content = obj.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "thinking" && block.thinking) {
                  thinkingParts.push(block.thinking.trim());
                }
              }
            }
          }
        } catch (_) {
          // 非 JSON 行，忽略
        }
      }

      // 兜底
      if (!resultText && lines.length) {
        try {
          const last = JSON.parse(lines[lines.length - 1]);
          resultText = last.result || last.text || out.trim();
        } catch (_) {
          resultText = out.trim();
        }
      }

      resolve({
        text: resultText,
        thinking: thinkingParts.join("\n\n"),
        sessionId: resultSessionId
      });
    });

    proc.stdin.write(message);
    proc.stdin.end();
  });
}

// ── POST /relay/send ──
app.post("/relay/send", auth, async (req, res) => {
  const { message, systemPrompt, model, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  console.log("[CC] 收到请求, model:", model, "session:", sessionId?.slice(0, 8) || "new",
    "msg长度:", message.length, "sp长度:", (systemPrompt || "").length);
  try {
    const result = await enqueue({ systemPrompt, message, model, sessionId });
    console.log("[CC] 成功, text长度:", result.text.length,
      "thinking长度:", result.thinking.length, "session:", result.sessionId?.slice(0, 8));
    res.json({
      text: result.text,
      thinking: result.thinking,
      model: model || "default",
      sessionId: result.sessionId
    });
  } catch (e) {
    console.error("[CC] 错误:", e.message);
    res.status(500).json({ error: e.message || "relay error" });
  }
});

// ── GET /relay/health ──
app.get("/relay/health", (_req, res) => {
  res.json({ status: "ok", queue: queue.length, busy });
});

app.listen(PORT, "0.0.0.0", () => console.log("CC Relay v3 (stateful) started on :" + PORT));
