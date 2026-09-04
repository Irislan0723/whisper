import express from "express";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json({ limit: "10mb" }));

const TOKEN = process.env.RELAY_TOKEN;
const PORT  = Number(process.env.RELAY_PORT) || 3001;
const DATA  = "/opt/cc-relay/data";
const TMUX  = "cc-chat";
const PROJECT_DIR = "/root/.claude/projects/-opt-cc-relay-data";

// Swap 配置
const SWAP_KEEP_TURNS = 15;   // 保留最近 N 个用户回合（每回合含多轮工具交互）

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
let lastSessionId  = null;   // 最近一次 CC session ID（Swap 用）
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

/** 启动 CC CLI（在 tmux session 里）
 *  @param {string} systemPrompt - 系统提示词
 *  @param {string|null} resumeId - 如果提供，用 --resume 恢复该 session
 */
function startCC(systemPrompt, resumeId) {
  // 写系统提示词
  const promptFile = join(DATA, "system-prompt.md");
  writeFileSync(promptFile, systemPrompt, "utf-8");
  lastSysPrompt = systemPrompt;

  // 写 settings
  const settingsFile = writeSettings();

  // 构造启动命令
  const baseArgs = `--system-prompt-file "${promptFile}" --tools "" --settings "${settingsFile}" --strict-mcp-config --mcp-config '{"mcpServers":{}}'`;
  const cmd = resumeId
    ? `exec claude --resume "${resumeId}" ${baseArgs}`
    : `exec claude ${baseArgs}`;

  // 写启动脚本（避免 tmux send-keys 的引号问题）
  const startScript = join(DATA, "start-claude.sh");
  writeFileSync(startScript, `#!/bin/bash\n${cmd}\n`, { mode: 0o755 });

  // 杀旧 session
  if (tmuxAlive()) tmuxKill();
  ccReady = false;

  // 创建 tmux session + 启动 claude
  execSync(`tmux new-session -d -s ${TMUX} -c ${DATA}`);
  execSync(`tmux send-keys -t ${TMUX} '${startScript}' Enter`);

  console.log(`[CC] tmux session 已创建${resumeId ? ` (resume: ${resumeId.slice(0, 8)})` : ""}，等待 CLI 就绪...`);

  // CC CLI 首次在新目录运行时会弹 "trust this folder" 交互确认
  // 自动检测并选择 "Yes, I trust this folder"，避免无人值守时卡死
  const trustPoller = setInterval(() => {
    try {
      const pane = execSync(`tmux capture-pane -t ${TMUX} -p`, { encoding: "utf-8" });
      if (pane.includes("trust this folder")) {
        execSync(`tmux send-keys -t ${TMUX} Down Enter`);
        console.log("[CC] 自动通过目录信任确认");
        clearInterval(trustPoller);
      }
    } catch { clearInterval(trustPoller); }
  }, 2000);
  const stopTrustPoller = () => clearInterval(trustPoller);

  // 等 SessionStart hook 回调 /hook/ready
  return new Promise((resolve, reject) => {
    ccReadyResolve = () => { stopTrustPoller(); resolve(); };
    // 60 秒超时
    setTimeout(() => {
      if (!ccReady) {
        stopTrustPoller();
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
  const sid = req.body?.session_id || "";
  console.log("[hook] CC 已就绪, session:", sid?.slice(0, 8));
  ccReady = true;
  if (sid) lastSessionId = sid;
  if (ccReadyResolve) { ccReadyResolve(); ccReadyResolve = null; }
});

// Stop hook → 回合正常结束
app.post("/hook/stop", (req, res) => {
  res.json({ ok: true });
  const text = req.body?.last_assistant_message || "";
  const sid  = req.body?.session_id || "";
  console.log("[hook] Stop, text:", text.length, "chars, session:", sid?.slice(0, 8));

  if (sid) lastSessionId = sid;

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
//  Swap：上下文换窗（保留近期对话，生成新 session）
// ════════════════════════════════════════

/** 找到最近修改的 transcript JSONL */
function findLatestTranscript() {
  if (!existsSync(PROJECT_DIR)) return null;
  const files = readdirSync(PROJECT_DIR)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => ({ name: f, mtime: statSync(join(PROJECT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? files[0].name.replace(".jsonl", "") : null;
}

/** 刷新系统提示词中的日期（避免 Swap 后 CC 还以为是昨天） */
function refreshSystemPromptDate(prompt) {
  if (!prompt) return prompt;
  const newDate = new Date().toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric", weekday: "long"
  });
  // 替换：当前日期：2026年9月3日 星期三 → 当前日期：2026年9月4日 星期四
  return prompt.replace(/当前日期：[^\n]+/, `当前日期：${newDate}`);
}

/** 判断一个 user event 是否是"用户发起的新回合"（而非工具结果轮） */
function isUserInitiated(evt) {
  if (evt.type !== "user") return false;
  const content = evt.message?.content || "";
  const text = typeof content === "string" ? content : (Array.isArray(content) ? JSON.stringify(content) : "");
  // 工具结果轮以"【工具执行结果】"开头，或是 tool_result 结构
  if (text.startsWith("【工具执行结果】")) return false;
  if (text.includes('"type":"tool_result"') || text.includes("'type': 'tool_result'")) return false;
  return true;
}

/**
 * 执行 Swap：裁剪旧 transcript，生成新 session，用 --resume 启动
 * 失败时抛异常，由调用方 fallback 到 fresh start
 */
async function performSwap() {
  // ── 1. 找到活跃 transcript ──
  const activeId = lastSessionId || findLatestTranscript();
  if (!activeId) throw new Error("找不到活跃 session ID");

  const oldFile = join(PROJECT_DIR, activeId + ".jsonl");
  if (!existsSync(oldFile)) throw new Error(`Transcript 文件不存在: ${oldFile}`);

  console.log(`[swap] 读取旧 transcript: ${activeId.slice(0, 8)}`);

  // ── 2. 解析所有 events ──
  const raw = readFileSync(oldFile, "utf-8").trim();
  if (!raw) throw new Error("Transcript 为空");
  const events = raw.split("\n").map(line => JSON.parse(line));

  // 分离：header events（无 uuid 链）vs 对话 events（有 uuid）
  const HEADER_TYPES = new Set(["last-prompt", "mode", "permission-mode", "atis-latch",
                                 "bridge-session", "ai-title", "cost-state"]);
  const CONVERSATION_TYPES = new Set(["user", "assistant"]);

  const headers = events.filter(e => HEADER_TYPES.has(e.type));
  const conversationEvents = events.filter(e => CONVERSATION_TYPES.has(e.type));

  if (!conversationEvents.length) throw new Error("Transcript 无对话内容");

  // ── 3. 按用户回合分组，保留最近 N 个回合 ──
  // 一个"回合" = 从用户发起消息到下一个用户发起消息之前的所有 events
  const turns = [];   // [ [evt, evt, ...], ... ]
  let currentTurn = [];

  for (const evt of conversationEvents) {
    if (isUserInitiated(evt) && currentTurn.length > 0) {
      turns.push(currentTurn);
      currentTurn = [];
    }
    currentTurn.push(evt);
  }
  if (currentTurn.length) turns.push(currentTurn);

  // 保留最近 SWAP_KEEP_TURNS 个回合
  const keptTurns = turns.slice(-SWAP_KEEP_TURNS);
  const keptEvents = keptTurns.flat();

  const totalConvEvents = conversationEvents.length;
  const keptCount = keptEvents.length;
  const turnCount = keptTurns.length;

  console.log(`[swap] 对话事件: ${totalConvEvents} → 保留 ${keptCount} (${turnCount} 个回合)`);

  // ── 4. 生成新 session ID ──
  const newId = randomUUID();

  // ── 5. 重写 header events ──
  const newHeaders = headers.map(e => ({ ...e, sessionId: newId }));

  // ── 6. 重写对话 events：更新 sessionId + 修正 parentUuid 链 ──
  let prevUuid = null;
  const newConversation = keptEvents.map(evt => {
    const newEvt = { ...evt, sessionId: newId, parentUuid: prevUuid };
    prevUuid = evt.uuid;   // 保留原 uuid，只修 parent 链
    return newEvt;
  });

  // 更新 last-prompt 的 leafUuid 指向最后一个事件
  if (newConversation.length) {
    const lastUuid = newConversation[newConversation.length - 1].uuid;
    for (const h of newHeaders) {
      if (h.type === "last-prompt") h.leafUuid = lastUuid;
    }
  }

  // ── 7. 写新 JSONL ──
  if (!existsSync(PROJECT_DIR)) mkdirSync(PROJECT_DIR, { recursive: true });
  const newFile = join(PROJECT_DIR, newId + ".jsonl");
  const output = [...newHeaders, ...newConversation].map(e => JSON.stringify(e)).join("\n") + "\n";
  writeFileSync(newFile, output, "utf-8");

  const newFileSize = statSync(newFile).size;
  console.log(`[swap] 新 transcript 已写入: ${newId.slice(0, 8)} (${Math.round(newFileSize / 1024)} KB)`);

  // ── 8. 刷新系统提示词日期 ──
  const refreshedPrompt = refreshSystemPromptDate(lastSysPrompt);
  if (!refreshedPrompt) throw new Error("没有可用的系统提示词");

  // ── 9. Kill 旧 tmux + 用 --resume 启动新 session ──
  if (tmuxAlive()) tmuxKill();
  ccReady = false;

  await startCC(refreshedPrompt, newId);

  // 更新 lastSessionId
  lastSessionId = newId;

  console.log(`[swap] ✓ Swap 完成: ${activeId.slice(0, 8)} → ${newId.slice(0, 8)}, 保留 ${turnCount} 回合 / ${keptCount} 事件`);

  return { oldId: activeId, newId, keptTurns: turnCount, keptEvents: keptCount, totalEvents: totalConvEvents };
}

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
  res.json({
    status: "ok", queue: queue.length, busy, ccReady,
    tmux: tmuxAlive(), lastSessionId: lastSessionId?.slice(0, 8) || null
  });
});

// 手动触发 Swap（测试用）
app.post("/relay/swap", auth, async (_req, res) => {
  try {
    const result = await swapSession();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 手动触发旧式轮换（fallback 测试用）
app.post("/relay/rotate", auth, async (_req, res) => {
  try {
    await freshRestart();
    res.json({ ok: true, mode: "fresh-restart" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
//  每日换窗（UTC+8 凌晨 5 点 = UTC 21:00）
// ════════════════════════════════════════

/** Swap 换窗：保留近期上下文 */
async function swapSession() {
  console.log("[swap] 开始每日换窗...");
  try {
    const result = await performSwap();
    console.log(`[swap] 成功, ${result.keptTurns} 回合带入新窗口`);
    return result;
  } catch (e) {
    console.error(`[swap] Swap 失败 (${e.message})，降级到 fresh restart...`);
    await freshRestart();
    return { fallback: true, reason: e.message };
  }
}

/** 旧式轮换：kill + 全新启动（Swap 的 fallback） */
async function freshRestart() {
  console.log("[rotate] 执行 fresh restart...");
  if (tmuxAlive()) tmuxKill();
  ccReady = false;

  if (lastSysPrompt) {
    const refreshedPrompt = refreshSystemPromptDate(lastSysPrompt);
    await startCC(refreshedPrompt);
    console.log("[rotate] 新 session 已启动 (fresh)");
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
  console.log(`[schedule] 下次换窗: ${next.toISOString()} (${Math.round(ms / 60000)} min)`);

  setTimeout(async () => {
    try { await swapSession(); } catch (e) { console.error("[swap] 致命错误:", e.message); }
    scheduleDaily();
  }, ms);
}

// ════════════════════════════════════════
//  启动
// ════════════════════════════════════════
app.listen(PORT, "0.0.0.0", () => {
  console.log(`CC Relay (tmux+swap) v2 on :${PORT}`);
  scheduleDaily();
});
