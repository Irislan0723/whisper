import express from "express";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const app = express();
app.use(express.json({ limit: "10mb" }));

const TOKEN = process.env.RELAY_TOKEN;
const PORT  = Number(process.env.RELAY_PORT) || 3001;
const DATA  = "/opt/cc-relay/data";
const TMUX  = "cc-chat";

if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });

function auth(req, res, next) {
  if (req.headers["x-relay-token"] !== TOKEN)
    return res.status(401).json({ error: "unauthorized" });
  next();
}

// ════════════════════════════════════════
//  全局状态
// ════════════════════════════════════════
let currentRound   = null;   // { id, resolve, reject, timer }
let lastSysPrompt  = null;   // 最近一次系统提示词（轮换用）
let ccReady        = false;  // CC CLI 是否就绪
let ccReadyResolve = null;   // startCC 等待就绪的 resolve
let busy = false;
const queue = [];

// ════════════════════════════════════════
//  tmux 操作
// ════════════════════════════════════════
function tmuxAlive() {
  try { execSync(`tmux has-session -t ${TMUX} 2>/dev/null`, { stdio: "ignore" }); return true; }
  catch { return false; }
}

function tmuxKill() {
  try { execSync(`tmux kill-session -t ${TMUX}`, { stdio: "ignore" }); } catch {}
}

/** 写 CC 的 settings 文件（hooks + 行为配置） */
function writeSettings() {
  const file = join(DATA, "cc-settings.json");
  writeFileSync(file, JSON.stringify({
    alwaysThinkingEnabled: true,
    showThinkingSummaries: true,
    autoCompactEnabled: true,
    autoUpdates: false,
    switchModelsOnFlag: false,
    cleanupPeriodDays: 99999,
    disableBundledSkills: true,
    hooks: {
      SessionStart: [{ hooks: [{
        type: "command",
        command: `curl -sf -m 5 -X POST http://127.0.0.1:${PORT}/hook/ready -H 'Content-Type: application/json' -d @- || true`
      }]}],
      Stop: [{ hooks: [{
        type: "command",
        command: `curl -sf -m 5 -X POST http://127.0.0.1:${PORT}/hook/stop -H 'Content-Type: application/json' -d @- || true`
      }]}],
      StopFailure: [{ hooks: [{
        type: "command",
        command: `curl -sf -m 5 -X POST http://127.0.0.1:${PORT}/hook/stop-failure -H 'Content-Type: application/json' -d @- || true`
      }]}]
    }
  }, null, 2), "utf-8");
  return file;
}

/** 启动 CC CLI（在 tmux session 里） */
function startCC(systemPrompt) {
  // 写系统提示词
  const promptFile = join(DATA, "system-prompt.md");
  writeFileSync(promptFile, systemPrompt, "utf-8");
  lastSysPrompt = systemPrompt;

  // 写 settings
  const settingsFile = writeSettings();

  // 写启动脚本（避免 tmux send-keys 的引号问题）
  const startScript = join(DATA, "start-claude.sh");
  writeFileSync(startScript, [
    "#!/bin/bash",
    `exec claude --system-prompt-file "${promptFile}" --tools "" --settings "${settingsFile}"`
  ].join("\n") + "\n", { mode: 0o755 });

  // 杀旧 session
  if (tmuxAlive()) tmuxKill();
  ccReady = false;

  // 创建 tmux session + 启动 claude
  execSync(`tmux new-session -d -s ${TMUX} -c ${DATA}`);
  execSync(`tmux send-keys -t ${TMUX} '${startScript}' Enter`);

  console.log("[CC] tmux session 已创建，等待 CLI 就绪...");

  // 等 SessionStart hook 回调 /hook/ready
  return new Promise((resolve, reject) => {
    ccReadyResolve = resolve;
    // 60 秒超时
    setTimeout(() => {
      if (!ccReady) {
        ccReadyResolve = null;
        reject(new Error("CC CLI 启动超时 (60s)"));
      }
    }, 60000);
  });
}

// ════════════════════════════════════════
//  发送消息到 CC（bracketed paste）
// ════════════════════════════════════════
function sendToCC(message) {
  // 写临时文件 → load-buffer
  const tmp = join(DATA, `msg-${Date.now()}.txt`);
  writeFileSync(tmp, message, "utf-8");

  try {
    execSync(`tmux load-buffer "${tmp}"`);
    execSync(`tmux paste-buffer -p -t ${TMUX}`);
  } finally {
    try { unlinkSync(tmp); } catch {}
  }

  // 停一拍再回车（教程 page 8：贴完立刻 Enter 会抢跑）
  return new Promise(resolve => {
    setTimeout(() => {
      execSync(`tmux send-keys -t ${TMUX} Enter`);
      resolve();
    }, 300);
  });
}

// ════════════════════════════════════════
//  串行队列（CC 同时只吃一条对话流）
// ════════════════════════════════════════
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
  try   { j.resolve(await processMessage(j)); }
  catch (e) { j.reject(e); }
  busy = false;
  drain();
}

async function processMessage({ message, systemPrompt }) {
  // CC 没跑就启动
  if (!ccReady || !tmuxAlive()) {
    const sp = systemPrompt || lastSysPrompt;
    if (!sp) throw new Error("CC 未就绪：没有系统提示词");
    await startCC(sp);
  }

  // 如果传了新的系统提示词，存起来（下次轮换用）
  if (systemPrompt) lastSysPrompt = systemPrompt;

  return new Promise(async (resolve, reject) => {
    const id = Date.now().toString();

    // 180 秒超时
    const timer = setTimeout(() => {
      if (currentRound?.id === id) {
        currentRound = null;
        reject(new Error("CC 回复超时 (180s)"));
      }
    }, 180000);

    currentRound = { id, resolve, reject, timer };

    try {
      await sendToCC(message);
    } catch (e) {
      clearTimeout(timer);
      currentRound = null;
      reject(new Error("发送失败: " + e.message));
    }
  });
}

// ════════════════════════════════════════
//  Hook 接收端点（CC → relay）
// ════════════════════════════════════════

// SessionStart hook → CC 就绪
app.post("/hook/ready", (req, res) => {
  res.json({ ok: true });
  console.log("[hook] CC 已就绪, session:", req.body?.session_id?.slice(0, 8));
  ccReady = true;
  if (ccReadyResolve) { ccReadyResolve(); ccReadyResolve = null; }
});

// Stop hook → 回合正常结束
app.post("/hook/stop", (req, res) => {
  res.json({ ok: true });
  const text = req.body?.last_assistant_message || "";
  const sid  = req.body?.session_id || "";
  console.log("[hook] Stop, text:", text.length, "chars, session:", sid?.slice(0, 8));

  if (currentRound) {
    clearTimeout(currentRound.timer);
    currentRound.resolve({ text, thinking: "", sessionId: sid });
    currentRound = null;
  }
});

// StopFailure hook → 回合异常
app.post("/hook/stop-failure", (req, res) => {
  res.json({ ok: true });
  const { error_type, error_message } = req.body || {};
  console.error("[hook] StopFailure:", error_type, error_message);

  if (currentRound) {
    clearTimeout(currentRound.timer);
    currentRound.reject(new Error(`CC ${error_type}: ${error_message}`));
    currentRound = null;
  }
});

// ════════════════════════════════════════
//  主端点（HK 服务端 → relay）
// ════════════════════════════════════════
app.post("/relay/send", auth, async (req, res) => {
  const { message, systemPrompt, model } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  console.log("[relay] 收到请求, msg:", message.length, "sp:", (systemPrompt || "").length);

  try {
    const result = await enqueue({ message, systemPrompt });
    console.log("[relay] 成功, text:", result.text.length);
    res.json({
      text:      result.text,
      thinking:  result.thinking,
      model:     model || "default",
      sessionId: result.sessionId
    });
  } catch (e) {
    console.error("[relay] 错误:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
//  健康检查 & 手动操作
// ════════════════════════════════════════
app.get("/relay/health", (_req, res) => {
  res.json({ status: "ok", queue: queue.length, busy, ccReady, tmux: tmuxAlive() });
});

// 手动触发轮换
app.post("/relay/rotate", auth, async (_req, res) => {
  try   { await rotateSession(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
//  每日轮换（UTC+8 凌晨 5 点 = UTC 21:00）
// ════════════════════════════════════════
async function rotateSession() {
  console.log("[rotate] 开始轮换...");
  if (tmuxAlive()) tmuxKill();
  ccReady = false;

  if (lastSysPrompt) {
    await startCC(lastSysPrompt);
    console.log("[rotate] 新 session 已启动");
  } else {
    console.log("[rotate] 没有系统提示词，等下次 send 再启动");
  }
}

function scheduleDaily() {
  const now  = new Date();
  const next = new Date(now);
  next.setUTCHours(21, 0, 0, 0);                        // UTC 21:00 = UTC+8 05:00
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  const ms = next - now;
  console.log(`[schedule] 下次轮换: ${next.toISOString()} (${Math.round(ms / 60000)} min)`);

  setTimeout(async () => {
    try { await rotateSession(); } catch (e) { console.error("[rotate] 失败:", e.message); }
    scheduleDaily();
  }, ms);
}

// ════════════════════════════════════════
//  启动
// ════════════════════════════════════════
app.listen(PORT, "0.0.0.0", () => {
  console.log(`CC Relay (tmux) v1 on :${PORT}`);
  scheduleDaily();
});
