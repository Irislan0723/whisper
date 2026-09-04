import express from "express";
import { execSync, spawn } from "child_process";
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
let lastSysPrompt  = null;   // 最近一次系统提示词（轮换用）
let lastSessionId  = null;   // 最近一次 CC session ID（Swap 用）
let busy = false;
const queue = [];

// ════════════════════════════════════════
//  tmux 操作（仅用于首次信任确认）
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
    autoCompactEnabled: true,
    autoUpdates: false,
    switchModelsOnFlag: false,
    cleanupPeriodDays: 99999,
    disableBundledSkills: true,
    hooks: {}
  }, null, 2), "utf-8");
  return file;
}

/** 确保目录已被信任（首次运行时需要） */
async function ensureTrusted() {
  // 检查是否已有 .claude 信任标记
  const trustFile = join(DATA, ".claude", "settings.json");
  if (existsSync(trustFile)) return;

  // 用 tmux 交互模式跑一次来处理信任对话框
  console.log("[trust] 首次运行，通过 tmux 处理目录信任...");
  if (tmuxAlive()) tmuxKill();

  const settingsFile = writeSettings();
  const promptFile = join(DATA, "system-prompt.md");
  if (!existsSync(promptFile)) writeFileSync(promptFile, "你是助手。", "utf-8");

  execSync(`tmux new-session -d -s ${TMUX} -c ${DATA}`);
  execSync(`tmux send-keys -t ${TMUX} 'claude --settings "${settingsFile}" --dangerously-skip-permissions' Enter`);

  // 等待信任对话框或 CLI 启动
  await new Promise((resolve) => {
    const poller = setInterval(() => {
      try {
        const pane = execSync(`tmux capture-pane -t ${TMUX} -p`, { encoding: "utf-8" });
        if (pane.includes("trust this folder")) {
          execSync(`tmux send-keys -t ${TMUX} Down Enter`);
          console.log("[trust] 自动通过目录信任确认");
          clearInterval(poller);
          setTimeout(() => { tmuxKill(); resolve(); }, 3000);
        } else if (pane.includes(">") || pane.includes("Claude")) {
          // CLI 已启动（无需信任确认）
          console.log("[trust] 目录已被信任");
          clearInterval(poller);
          tmuxKill();
          resolve();
        }
      } catch { clearInterval(poller); resolve(); }
    }, 2000);
    // 30 秒超时
    setTimeout(() => { clearInterval(poller); tmuxKill(); resolve(); }, 30000);
  });
}

// ════════════════════════════════════════
//  发送消息到 CC（-p 模式 + stream-json）
//  每条消息独立 spawn，通过 --resume 维持对话
// ════════════════════════════════════════

/**
 * 用 -p --output-format stream-json 模式发送一条消息
 * 返回 { text, thinking, sessionId }
 */
function ccPrintSend(message, systemPrompt, resumeId) {
  return new Promise((resolve, reject) => {
    const promptFile = join(DATA, "system-prompt.md");
    if (systemPrompt) {
      writeFileSync(promptFile, systemPrompt, "utf-8");
      lastSysPrompt = systemPrompt;
    }

    const settingsFile = writeSettings();

    // 构造参数
    const args = [
      "-p",                               // print 模式
      "--output-format", "stream-json",    // 结构化流式输出
      "--verbose",                         // stream-json 需要 verbose
      "--system-prompt-file", promptFile,
      "--tools", "",
      "--settings", settingsFile,
      "--strict-mcp-config",
      "--mcp-config", '{"mcpServers":{}}',
      "--dangerously-skip-permissions",    // 无人值守
    ];

    if (resumeId) {
      args.push("--resume", resumeId);
    }

    const child = spawn("claude", args, {
      cwd: DATA,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOME: process.env.HOME || "/root" },
    });

    let thinking = "";
    let text = "";
    let sessionId = resumeId || "";
    let stderr = "";
    let buffer = "";

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      // 逐行解析 NDJSON
      const lines = buffer.split("\n");
      buffer = lines.pop(); // 保留不完整的最后一行

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          processStreamEvent(evt);
        } catch { /* 忽略非 JSON 行 */ }
      }
    });

    function processStreamEvent(evt) {
      // stream-json 事件类型：
      // { type: "assistant", message: { content: [...] }, ... }
      // { type: "system", ... }
      // { type: "stream_event", event: { type: "content_block_delta", delta: {...} } }
      if (evt.type === "assistant" && evt.message?.content) {
        for (const block of evt.message.content) {
          if (block.type === "thinking" && block.thinking) {
            thinking += (thinking ? "\n\n" : "") + block.thinking;
          }
          if (block.type === "text" && block.text) {
            text += block.text;
          }
        }
        // 从 assistant message 中提取 session id
        if (evt.session_id) sessionId = evt.session_id;
      }
      // 也捕获 system 事件中的 session_id
      if (evt.session_id && !sessionId) sessionId = evt.session_id;
    }

    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    // 发送消息到 stdin（-p 模式从 stdin 读取用户消息）
    child.stdin.write(message);
    child.stdin.end();

    // 300 秒超时（含 CC CLI 启动时间 + API 响应时间）
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("CC 回复超时 (300s)"));
    }, 300000);

    child.on("close", (code) => {
      clearTimeout(timer);

      // 处理剩余 buffer
      if (buffer.trim()) {
        try {
          const evt = JSON.parse(buffer);
          processStreamEvent(evt);
        } catch {}
      }

      // 从 transcript 中获取 session ID（如果 stream 没给）
      if (!sessionId) {
        sessionId = findLatestTranscript() || "";
      }
      if (sessionId) lastSessionId = sessionId;

      if (code !== 0 && !text) {
        console.error(`[cc-p] 进程退出 code=${code}, stderr:`, stderr.slice(0, 500));
        reject(new Error(`CC 进程异常退出 (code=${code}): ${stderr.slice(0, 200)}`));
      } else {
        console.log(`[cc-p] 完成, text:${text.length} think:${thinking.length} sid:${sessionId?.slice(0, 8)}`);
        resolve({ text, thinking, sessionId });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error("CC 启动失败: " + err.message));
    });
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
  // 如果传了新的系统提示词，存起来（下次轮换用）
  if (systemPrompt) lastSysPrompt = systemPrompt;
  const sp = systemPrompt || lastSysPrompt;
  if (!sp) throw new Error("没有可用的系统提示词");

  // 用 -p 模式发送，通过 --resume 维持对话
  return await ccPrintSend(message, sp, lastSessionId || undefined);
}

// ════════════════════════════════════════
//  Hook 接收端点（保留兼容，Swap 后的 tmux 模式可能触发）
// ════════════════════════════════════════

app.post("/hook/ready", (req, res) => {
  res.json({ ok: true });
  const sid = req.body?.session_id || "";
  console.log("[hook] CC 已就绪, session:", sid?.slice(0, 8));
  if (sid) lastSessionId = sid;
});

app.post("/hook/stop", (req, res) => {
  res.json({ ok: true });
  const sid = req.body?.session_id || "";
  if (sid) lastSessionId = sid;
});

app.post("/hook/stop-failure", (req, res) => {
  res.json({ ok: true });
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
  if (refreshedPrompt) lastSysPrompt = refreshedPrompt;

  // ── 9. 更新 session ID（-p 模式下不需要 kill tmux 或启动新进程）──
  // 下次 ccPrintSend 会自动用新 ID --resume
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
    console.log("[relay] 成功, text:", result.text.length, "thinking:", result.thinking.length);
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
    status: "ok", queue: queue.length, busy,
    lastSessionId: lastSessionId?.slice(0, 8) || null
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

/** 旧式轮换：清空 session ID，下次 send 会创建全新 session */
async function freshRestart() {
  console.log("[rotate] 执行 fresh restart...");
  lastSessionId = null;   // 清空 → 下次 ccPrintSend 不带 --resume = 新 session

  if (lastSysPrompt) {
    lastSysPrompt = refreshSystemPromptDate(lastSysPrompt);
    console.log("[rotate] 系统提示词已刷新日期，等下次 send 时创建新 session");
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
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`CC Relay (print-mode+swap) v3 on :${PORT}`);

  // 确保目录已被信任
  try { await ensureTrusted(); } catch (e) { console.warn("[trust] 信任检查失败:", e.message); }

  // 尝试恢复上次的 session ID
  const latestId = findLatestTranscript();
  if (latestId) {
    lastSessionId = latestId;
    console.log(`[init] 恢复上次 session: ${latestId.slice(0, 8)}`);
  }

  scheduleDaily();
});
