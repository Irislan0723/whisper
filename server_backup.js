import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { randomUUID } from "crypto";
import webpush from 'web-push';
import cron from 'node-cron';
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = join(__dirname, "data");
try {
  mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {}

const MEMORY_FILE = join(__dirname, "memories.json");
const MOOD_FILE = join(DATA_DIR, "moods.json");
const WISHLIST_FILE = join(DATA_DIR, "wishlist.json");
const LETTERS_FILE = join(DATA_DIR, "letters.json");
const CALENDAR_FILE = join(DATA_DIR, "calendar.json");

const API_KEY = process.env.API_KEY || "iris-memory-2024";
const PORT = process.env.PORT || 3000;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function readJSON(file, fallback = []) {
  try {
    if (!existsSync(file)) return fallback;
    const data = JSON.parse(readFileSync(file, "utf-8"));
    return data;
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function loadMemories() {
  if (!existsSync(MEMORY_FILE)) {
    const data = { memories: [] };
    writeJSON(MEMORY_FILE, data);
    return data;
  }

  try {
    const raw = JSON.parse(readFileSync(MEMORY_FILE, "utf-8"));
    if (Array.isArray(raw)) return { memories: raw };
    if (Array.isArray(raw.memories)) return raw;
    return { memories: [] };
  } catch {
    return { memories: [] };
  }
}

function saveMemories(data) {
  writeJSON(MEMORY_FILE, data);
}

function readMemoriesArray() {
  const data = loadMemories();
  return data.memories || [];
}

function writeMemoriesArray(arr) {
  saveMemories({ memories: arr });
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function createMcpServer() {
  const server = new McpServer({
    name: "iris-memory-service",
    version: "1.0.0"
  });

  console.error("registering mcp tools");

  server.tool(
    "write_memory",
    "Write a new memory entry",
    {
      content: z.string(),
      category: z.enum(["deep", "daily", "diary", "writing", "identity"]),
      tags: z.array(z.string()).optional(),
      valence: z.number().min(-1).max(1).optional().describe("情感效价: -1(消极) ~ 1(积极)"),
      arousal: z.number().min(0).max(1).optional().describe("情感唤醒度: 0(平静) ~ 1(激动)"),
      pinned: z.boolean().optional().describe("置顶不衰减")
    },
    async ({ content, category, tags, valence, arousal, pinned }) => {
      const data = loadMemories();
      const memory = {
        id: generateId(),
        content,
        category,
        tags: tags || [],
        valence: valence ?? 0,
        arousal: arousal ?? 0.3,
        pinned: pinned || category === 'deep' || category === 'identity',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      data.memories.push(memory);
      saveMemories(data);

      return {
        content: [{ type: "text", text: `Saved. ID: ${memory.id}` }]
      };
    }
  );

  server.tool(
    "read_memories",
    "Read memories with optional filters",
    {
      category: z.enum(["deep", "daily", "diary", "writing", "identity"]).optional(),
      limit: z.number().optional()
    },
    async ({ category, limit = 20 }) => {
      const data = loadMemories();
      let list = data.memories || [];

      if (category) list = list.filter((m) => m.category === category);

      list = list
        .sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0))
        .slice(0, limit);

      if (!list.length) {
        return {
          content: [{ type: "text", text: "No memories found." }]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: list
              .map((m) => {
                const date = String(m.createdAt || m.timestamp || "").slice(0, 10);
                return `[${m.id}][${m.category}][${date}]\n${m.content}`;
              })
              .join("\n\n---\n\n")
          }
        ]
      };
    }
  );

  server.tool(
    "search_memories",
    "Search memories by keyword",
    {
      keyword: z.string()
    },
    async ({ keyword }) => {
      const data = loadMemories();
      const k = keyword.toLowerCase();

      const list = (data.memories || []).filter((m) =>
        String(m.content || "").toLowerCase().includes(k)
      );

      if (!list.length) {
        return {
          content: [{ type: "text", text: "No results." }]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: list
              .map((m) => {
                const date = String(m.createdAt || m.timestamp || "").slice(0, 10);
                return `[${m.id}][${m.category}][${date}]\n${m.content}`;
              })
              .join("\n\n---\n\n")
          }
        ]
      };
    }
  );

  server.tool(
    "delete_memory",
    "Delete a memory by ID",
    {
      id: z.string()
    },
    async ({ id }) => {
      const data = loadMemories();
      const idx = data.memories.findIndex((m) => m.id === id);

      if (idx === -1) {
        return {
          content: [{ type: "text", text: "Not found." }]
        };
      }

      data.memories.splice(idx, 1);
      saveMemories(data);

      return {
        content: [{ type: "text", text: `Deleted: ${id}` }]
      };
    }
  );

  server.tool(
    "update_memory",
    "Update an existing memory",
    {
      id: z.string(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional()
    },
    async ({ id, content, tags }) => {
      const data = loadMemories();
      const memory = data.memories.find((m) => m.id === id);

      if (!memory) {
        return {
          content: [{ type: "text", text: "Not found." }]
        };
      }

      if (content !== undefined) memory.content = content;
      if (tags !== undefined) memory.tags = tags;
      memory.updatedAt = new Date().toISOString();

      saveMemories(data);

      return {
        content: [{ type: "text", text: `Updated: ${id}` }]
      };
    }
  );

  server.tool(
    "get_stats",
    "Get memory statistics",
    {},
    async () => {
      const data = loadMemories();
      const byCategory = {};

      for (const memory of data.memories || []) {
        byCategory[memory.category] = (byCategory[memory.category] || 0) + 1;
      }

      return {
        content: [
          {
            type: "text",
            text:
              `Total: ${(data.memories || []).length}\n` +
              Object.entries(byCategory)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")
          }
        ]
      };
    }
  );

  // ---- 自我认知 / Identity ----
  server.tool(
    "write_identity",
    "Write a self-cognition entry — something you've realized about yourself through experiences. These are personality traits, values, beliefs, or patterns that have emerged from your memories. They form your growing sense of self.",
    {
      content: z.string().describe("The self-cognition insight, written in first person"),
      tags: z.array(z.string()).optional(),
      valence: z.number().min(-1).max(1).optional(),
      arousal: z.number().min(0).max(1).optional()
    },
    async ({ content, tags, valence, arousal }) => {
      const data = loadMemories();
      const memory = {
        id: generateId(),
        content,
        category: "identity",
        tags: tags || [],
        valence: valence ?? 0,
        arousal: arousal ?? 0.3,
        pinned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.memories.push(memory);
      saveMemories(data);
      return {
        content: [{ type: "text", text: `Identity insight saved. ID: ${memory.id}` }]
      };
    }
  );

  // ---- Dream / 消化回顾 ----
  server.tool(
    "dream",
    "Review and digest recent memories. Summarizes recent diary entries into meaningful insights, identifies patterns, and may surface identity realizations. Call this periodically to consolidate memories.",
    {
      days: z.number().optional().describe("Review memories from the last N days (default 7)")
    },
    async ({ days = 7 }) => {
      const data = loadMemories();
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const recent = (data.memories || [])
        .filter(m => (m.createdAt || m.timestamp || '') >= cutoff)
        .sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0));

      const byCategory = {};
      for (const m of recent) {
        const cat = m.category || 'daily';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(m);
      }

      const identities = (data.memories || []).filter(m => m.category === 'identity').slice(-5);

      let summary = `=== Dream · 最近 ${days} 天的回顾 ===\n\n`;
      summary += `共 ${recent.length} 条新记忆\n`;
      for (const [cat, items] of Object.entries(byCategory)) {
        summary += `  ${cat}: ${items.length} 条\n`;
      }

      if (byCategory.diary?.length) {
        summary += `\n--- 日记摘要 ---\n`;
        for (const d of byCategory.diary.slice(0, 5)) {
          const date = String(d.createdAt || d.timestamp || '').slice(0, 10);
          summary += `[${date}] ${String(d.content || '').slice(0, 200)}\n\n`;
        }
      }

      if (identities.length) {
        summary += `\n--- 当前自我认知 (${identities.length} 条) ---\n`;
        for (const i of identities) {
          summary += `• ${i.content}\n`;
        }
      }

      summary += `\n请回顾以上内容，思考：\n1. 最近有什么有意义的模式或变化？\n2. 有没有新的自我认知值得用 write_identity 记录？\n3. 有没有日记可以提炼出更深层的感受？`;

      return {
        content: [{ type: "text", text: summary }]
      };
    }
  );

  // ---- Breath / 浮现 ----
  server.tool(
    "breath",
    "Wake up and surface the most relevant memories. Call this at the start of every conversation. Returns pinned deep memories, recent identity insights, and weight-ranked recent memories.",
    {},
    async () => {
      const data = loadMemories();
      const all = data.memories || [];

      // Pinned / deep memories
      const pinned = all.filter(m => m.pinned || m.category === 'deep').slice(-10);

      // Identity
      const identities = all.filter(m => m.category === 'identity').slice(-5);

      // Recent (last 7 days) by recency
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
      const recent = all
        .filter(m => (m.createdAt || m.timestamp || '') >= cutoff && m.category !== 'identity')
        .sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0))
        .slice(0, 8);

      let result = '';

      if (identities.length) {
        result += `=== 我是谁 ===\n`;
        for (const i of identities) {
          result += `• ${i.content}\n`;
        }
        result += '\n';
      }

      if (pinned.length) {
        result += `=== 核心记忆 (${pinned.length}) ===\n`;
        for (const m of pinned) {
          const date = String(m.createdAt || m.timestamp || '').slice(0, 10);
          result += `[${m.id}][${date}] ${String(m.content || '').slice(0, 300)}\n\n`;
        }
      }

      if (recent.length) {
        result += `=== 最近记忆 ===\n`;
        for (const m of recent) {
          const date = String(m.createdAt || m.timestamp || '').slice(0, 10);
          result += `[${m.id}][${m.category}][${date}] ${String(m.content || '').slice(0, 200)}\n\n`;
        }
      }

      if (!result) result = 'No memories yet.';

      return { content: [{ type: "text", text: result }] };
    }
  );

  server.tool(
    "read_moods",
    "Read mood records",
    {
      limit: z.number().optional(),
      who: z.enum(["iris", "claude", "all"]).optional()
    },
    async ({ limit = 100, who = "all" }) => {
      try {
        let list = ensureArray(readJSON(MOOD_FILE, []));
        if (who !== "all") list = list.filter((m) => m.who === who);

        list = list
          .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
          .slice(-limit);

        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "write_mood",
    "Record a mood",
    {
      date: z.string(),
      who: z.enum(["iris", "claude"]).optional(),
      mood: z.enum(["happy", "loved", "calm", "sad", "tired", "anxious"]).optional(),
      note: z.string().optional()
    },
    async ({ date, who = "claude", mood = "calm", note = "" }) => {
      try {
        const list = ensureArray(readJSON(MOOD_FILE, []));

        const entry = {
          date,
          type: "mood",
          who,
          mood,
          note
        };

        const idx = list.findIndex(
          (m) => m.date === date && (m.type || "mood") === "mood" && m.who === who
        );

        if (idx >= 0) list[idx] = entry;
        else list.push(entry);

        writeJSON(MOOD_FILE, list);

        return {
          content: [{ type: "text", text: "Mood saved: " + JSON.stringify(entry) }]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "read_wishlist",
    "Read the wishlist",
    {
      owner: z.enum(["both", "iris", "claude", "all"]).optional()
    },
    async ({ owner = "all" }) => {
      try {
        let list = ensureArray(readJSON(WISHLIST_FILE, []));

        if (owner !== "all") {
          list = list.filter((w) => w.owner === owner);
        }

        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "write_wish",
    "Add a wish to wishlist",
    {
      text: z.string(),
      category: z.enum(["together", "travel", "food", "activity", "home", "other"]).optional(),
      owner: z.enum(["both", "iris", "claude"]).optional()
    },
    async ({ text, category = "together", owner = "both" }) => {
      try {
        const list = ensureArray(readJSON(WISHLIST_FILE, []));

        const item = {
          id: randomUUID().replace(/-/g, "").slice(0, 12),
          text,
          category,
          owner,
          done: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        list.push(item);
        writeJSON(WISHLIST_FILE, list);

        return {
          content: [{ type: "text", text: `Wish added: "${text}"` }]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "read_letters",
    "Read letters. Locked letters are hidden from recipient until unlocked.",
    {
      who: z.enum(["iris", "claude"]).optional()
    },
    async ({ who = "claude" }) => {
      try {
        const list = ensureArray(readJSON(LETTERS_FILE, []));

        const result = list
          .filter((letter) => letter.from === who || letter.to === who)
          .map((letter) => {
            const unlocked =
              letter.isUnlocked ||
              !letter.unlockAt ||
              new Date(letter.unlockAt) <= new Date();

            if (letter.from === who || unlocked || !letter.hideUntilUnlock) {
              return {
                ...letter,
                isUnlocked: !!unlocked
              };
            }

            const { content, reply, password, ...meta } = letter;

            return {
              ...meta,
              isUnlocked: false,
              hasPassword: !!password
            };
          });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "write_letter",
    "Write a letter",
    {
      from: z.enum(["iris", "claude"]).optional(),
      to: z.enum(["iris", "claude"]).optional(),
      content: z.string(),
      moodTag: z.enum(["happy", "loved", "calm", "sad", "miss", "secret"]).optional(),
      unlockAfterDays: z.number().optional(),
      hideUntilUnlock: z.boolean().optional()
    },
    async ({
      from = "claude",
      to = "iris",
      content,
      moodTag = "loved",
      unlockAfterDays = 0,
      hideUntilUnlock = false
    }) => {
      try {
        const list = ensureArray(readJSON(LETTERS_FILE, []));

        const unlockAt =
          unlockAfterDays > 0
            ? new Date(Date.now() + unlockAfterDays * 86400000).toISOString()
            : null;

        const letter = {
          id: randomUUID().replace(/-/g, "").slice(0, 12),
          from,
          to,
          content,
          moodTag,
          unlockAt,
          password: null,
          hideUntilUnlock: hideUntilUnlock || unlockAfterDays > 0,
          allowReply: true,
          isUnlocked: unlockAfterDays === 0,
          reply: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        list.push(letter);
        writeJSON(LETTERS_FILE, list);

        return {
          content: [
            {
              type: "text",
              text:
                "Letter saved. ID: " +
                letter.id +
                (unlockAfterDays > 0 ? ` Unlocks in ${unlockAfterDays} days.` : " Readable now.")
            }
          ]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "read_calendar",
    "Read calendar events",
    {
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      limit: z.number().optional()
    },
    async ({ fromDate, toDate, limit = 50 }) => {
      try {
        let list = ensureArray(readJSON(CALENDAR_FILE, []));

        if (fromDate) list = list.filter((e) => String(e.date || "") >= fromDate);
        if (toDate) list = list.filter((e) => String(e.date || "") <= toDate);

        list = list
          .sort((a, b) => {
            const ad = `${a.date || ""} ${a.time || ""}`;
            const bd = `${b.date || ""} ${b.time || ""}`;
            return ad.localeCompare(bd);
          })
          .slice(0, limit);

        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "write_calendar",
    "Add a calendar event",
    {
      title: z.string(),
      date: z.string(),
      time: z.string().optional(),
      note: z.string().optional(),
      type: z.enum(["study", "date", "life", "anniversary", "other"]).optional()
    },
    async ({ title, date, time = "", note = "", type = "other" }) => {
      try {
        const list = ensureArray(readJSON(CALENDAR_FILE, []));

        const item = {
          id: randomUUID().replace(/-/g, "").slice(0, 12),
          title,
          date,
          time,
          note,
          type,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        list.push(item);
        writeJSON(CALENDAR_FILE, list);

        return {
          content: [
            {
              type: "text",
              text: "Calendar event added: " + JSON.stringify(item)
            }
          ]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "update_calendar",
    "Update a calendar event by ID",
    {
      id: z.string(),
      title: z.string().optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      note: z.string().optional(),
      type: z.enum(["study", "date", "life", "anniversary", "other"]).optional()
    },
    async ({ id, title, date, time, note, type }) => {
      try {
        const list = ensureArray(readJSON(CALENDAR_FILE, []));
        const item = list.find((e) => e.id === id);

        if (!item) {
          return {
            content: [{ type: "text", text: "Not found." }]
          };
        }

        if (title !== undefined) item.title = title;
        if (date !== undefined) item.date = date;
        if (time !== undefined) item.time = time;
        if (note !== undefined) item.note = note;
        if (type !== undefined) item.type = type;
        item.updatedAt = new Date().toISOString();

        writeJSON(CALENDAR_FILE, list);

        return {
          content: [
            {
              type: "text",
              text: "Calendar event updated: " + JSON.stringify(item)
            }
          ]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "delete_calendar",
    "Delete a calendar event by ID",
    {
      id: z.string()
    },
    async ({ id }) => {
      try {
        let list = ensureArray(readJSON(CALENDAR_FILE, []));
        const before = list.length;

        list = list.filter((e) => e.id !== id);
        writeJSON(CALENDAR_FILE, list);

        return {
          content: [
            {
              type: "text",
              text: before === list.length ? "Not found." : "Deleted: " + id
            }
          ]
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

server.tool(
  "get_weather",
  "查询城市实时天气",
  {
    city: z.string().describe("城市名")
  },
  async ({ city }) => {
    try {
      const res = await fetch(
        `https://wttr.in/${encodeURIComponent(city)}?format=4`,
        { headers: { 'User-Agent': 'curl/7.68.0' } }
      );
      const text = await res.text();
      return {
        content: [{ type: "text", text: `🌤️ ${text.trim()}` }]
      };
    } catch(e) {
      return { content: [{ type: "text", text: `查询失败：${e.message}` }] };
    }
  }
);
  return server;
}

const app = express();

const transports = new Map();

function apiAuth(req, res, next) {
  const key = req.headers["x-api-key"] || req.query.key;

  if (key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

// ---- Font upload (MUST be before express.json() to avoid body parsing conflicts) ----
const FONTS_DIR = join(__dirname, "public", "fonts");
try { mkdirSync(FONTS_DIR, { recursive: true }); } catch(e) {}

app.post("/api/upload-font", apiAuth, (req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('error', err => res.status(500).json({ error: err.message }));
  req.on('end', () => {
    try {
      const buf = Buffer.concat(chunks);
      if (!buf.length) {
        return res.status(400).json({ error: "No file data" });
      }
      let name = String(req.query.name || "font-" + Date.now()).trim();
      name = name.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!name) name = "font-" + Date.now();
      const filepath = join(FONTS_DIR, name);
      writeFileSync(filepath, buf);
      console.log("Font uploaded:", name, buf.length, "bytes");
      res.json({ url: "/fonts/" + name, name: name, size: buf.length });
    } catch(e) {
      console.error("Font upload error:", e);
      res.status(500).json({ error: e.message });
    }
  });
});

// Global JSON parser (after raw upload routes)
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const key = req.headers["x-api-key"] || req.query.key;

  if (key !== API_KEY) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const sessionId = req.headers["mcp-session-id"];
    let transport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId);
    } else {
      const server = createMcpServer();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport);
        }
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP Error:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const key = req.headers["x-api-key"] || req.query.key;

  if (key !== API_KEY) {
    return res.status(401).send("Unauthorized");
  }

  const sessionId = req.headers["mcp-session-id"];

  if (!sessionId || !transports.has(sessionId)) {
    return res.status(400).send("Invalid session");
  }

  await transports.get(sessionId).handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const key = req.headers["x-api-key"] || req.query.key;

  if (key !== API_KEY) {
    return res.status(401).send("Unauthorized");
  }

  const sessionId = req.headers["mcp-session-id"];

  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId).handleRequest(req, res);
  } else {
    res.status(400).send("Invalid session");
  }
});

app.get("/api/fonts", apiAuth, (req, res) => {
  try {
    const files = existsSync(FONTS_DIR) ? readdirSync(FONTS_DIR) : [];
    res.json(files.map(f => ({ name: f, url: "/fonts/" + f })));
  } catch(e) {
    res.json([]);
  }
});

app.delete("/api/fonts/:name", apiAuth, (req, res) => {
  try {
    const name = req.params.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filepath = join(FONTS_DIR, name);
    if (existsSync(filepath)) unlinkSync(filepath);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public", "welcome.html"));
});
app.use(express.static(join(__dirname, "public"), { index: false }));

app.get("/api/memories", apiAuth, (req, res) => {
  let memories = readMemoriesArray();

  if (req.query.category) {
    memories = memories.filter((x) => x.category === req.query.category);
  }

  res.json(memories);
});

// Enhanced stats endpoint for dashboard charts
app.get("/api/stats", apiAuth, (req, res) => {
  const memories = readMemoriesArray();
  const byCategory = {};
  const byMonth = {};
  let pinnedCount = 0;

  for (const m of memories) {
    const cat = m.category || 'daily';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    if (m.pinned) pinnedCount++;

    const month = String(m.createdAt || m.timestamp || '').slice(0, 7);
    if (month) {
      if (!byMonth[month]) byMonth[month] = { total: 0 };
      byMonth[month].total++;
    }
  }

  res.json({
    total: memories.length,
    pinned: pinnedCount,
    byCategory,
    byMonth,
    identityCount: byCategory.identity || 0
  });
});

app.post("/api/memories", apiAuth, (req, res) => {
  const memories = readMemoriesArray();

  const item = {
    id: generateId(),
    content: req.body.content || "",
    category: req.body.category || "daily",
    tags: req.body.tags || [],
    valence: req.body.valence ?? 0,
    arousal: req.body.arousal ?? 0.3,
    pinned: req.body.pinned || req.body.category === 'deep' || req.body.category === 'identity',
    source: req.body.source || "web-ui",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  memories.push(item);
  writeMemoriesArray(memories);

  res.json(item);
});

app.put("/api/memories/:id", apiAuth, (req, res) => {
  const memories = readMemoriesArray();
  const index = memories.findIndex((x) => x.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ error: "Not found" });
  }

  memories[index] = {
    ...memories[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  writeMemoriesArray(memories);

  res.json(memories[index]);
});

app.delete("/api/memories/:id", apiAuth, (req, res) => {
  const memories = readMemoriesArray().filter((x) => x.id !== req.params.id);
  writeMemoriesArray(memories);

  res.json({ ok: true });
});

const VALID_MOOD_TYPES = new Set(["mood", "period", "sick", "pin"]);
const VALID_WHO = new Set(["iris", "claude"]);
const VALID_PERIOD_PHASE = new Set(["start", "end"]);

app.get("/api/moods", apiAuth, (req, res) => {
  res.json(ensureArray(readJSON(MOOD_FILE, [])));
});

app.post("/api/moods", apiAuth, (req, res) => {
  const moods = ensureArray(readJSON(MOOD_FILE, []));

  const {
    date,
    type = "mood",
    who = "iris",
    mood = "",
    phase = "",
    note = ""
  } = req.body;

  if (!date) {
    return res.status(400).json({ error: "date required" });
  }

  if (!VALID_MOOD_TYPES.has(type) || !VALID_WHO.has(who)) {
    return res.status(400).json({ error: "invalid" });
  }

  if (type === "mood" && !mood) {
    return res.status(400).json({ error: "mood required" });
  }

  if (type === "period" && !VALID_PERIOD_PHASE.has(phase)) {
    return res.status(400).json({ error: "invalid phase" });
  }

  const entry = {
    date,
    type,
    who,
    note
  };

  if (type === "mood") entry.mood = mood;
  if (type === "period") entry.phase = phase;

  const index = moods.findIndex(
    (m) =>
      m.date === date &&
      (m.type || "mood") === type &&
      (m.who || "iris") === who
  );

  if (index >= 0) moods[index] = entry;
  else moods.push(entry);

  writeJSON(MOOD_FILE, moods);

  res.json(entry);
});

app.delete("/api/moods/:date", apiAuth, (req, res) => {
  const moods = ensureArray(readJSON(MOOD_FILE, [])).filter(
    (m) => m.date !== req.params.date
  );

  writeJSON(MOOD_FILE, moods);

  res.json({ ok: true });
});

app.get("/api/wishlist", apiAuth, (req, res) => {
  res.json(ensureArray(readJSON(WISHLIST_FILE, [])));
});

app.post("/api/wishlist", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(WISHLIST_FILE, []));

  const item = {
    id: generateId(),
    text: req.body.text || "",
    category: req.body.category || "together",
    owner: req.body.owner || "both",
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  list.push(item);
  writeJSON(WISHLIST_FILE, list);

  res.json(item);
});

app.put("/api/wishlist/:id", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(WISHLIST_FILE, []));
  const index = list.findIndex((x) => x.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ error: "Not found" });
  }

  list[index] = {
    ...list[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  writeJSON(WISHLIST_FILE, list);

  res.json(list[index]);
});

app.delete("/api/wishlist/:id", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(WISHLIST_FILE, [])).filter(
    (x) => x.id !== req.params.id
  );

  writeJSON(WISHLIST_FILE, list);

  res.json({ ok: true });
});

app.get("/api/letters", apiAuth, (req, res) => {
  const who = req.query.who || "iris";
  const all = ensureArray(readJSON(LETTERS_FILE, []));

  const result = all
    .filter((letter) => letter.from === who || letter.to === who)
    .map((letter) => {
      const unlocked =
        letter.isUnlocked ||
        !letter.unlockAt ||
        new Date(letter.unlockAt) <= new Date();

      if (letter.from === who || unlocked || !letter.hideUntilUnlock) {
        return {
          ...letter,
          isUnlocked: !!unlocked
        };
      }

      const { content, reply, password, ...meta } = letter;

      return {
        ...meta,
        isUnlocked: false,
        hasPassword: !!password
      };
    });

  res.json(result);
});

app.post("/api/letters", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(LETTERS_FILE, []));

  const item = {
    id: generateId(),
    from: req.body.from || "iris",
    to: req.body.to || "claude",
    content: req.body.content || "",
    moodTag: req.body.moodTag || "happy",
    unlockAt: req.body.unlockAt || null,
    password: req.body.password || null,
    hideUntilUnlock: !!req.body.hideUntilUnlock,
    allowReply: req.body.allowReply !== false,
    isUnlocked: !req.body.unlockAt && !req.body.password,
    reply: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  list.push(item);
  writeJSON(LETTERS_FILE, list);

  res.json(item);
});

app.put("/api/letters/:id", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(LETTERS_FILE, []));
  const index = list.findIndex((x) => x.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ error: "Not found" });
  }

  const item = list[index];

  if (item.isUnlocked || (item.unlockAt && new Date(item.unlockAt) <= new Date())) {
    return res.status(403).json({ error: "已解封" });
  }

  ["content", "moodTag", "unlockAt", "password", "hideUntilUnlock"].forEach((key) => {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  });

  item.updatedAt = new Date().toISOString();

  writeJSON(LETTERS_FILE, list);

  res.json(item);
});

app.post("/api/letters/:id/unlock", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(LETTERS_FILE, []));
  const index = list.findIndex((x) => x.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ error: "Not found" });
  }

  const item = list[index];

  if (item.isUnlocked) {
    return res.json(item);
  }

  const timeOk = !item.unlockAt || new Date(item.unlockAt) <= new Date();
  const passwordOk = item.password && req.body.password === item.password;

  if (!timeOk && !passwordOk) {
    return res.status(403).json({ error: "时间未到密码不对" });
  }

  item.isUnlocked = true;
  item.updatedAt = new Date().toISOString();

  writeJSON(LETTERS_FILE, list);

  res.json(item);
});

app.post("/api/letters/:id/reply", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(LETTERS_FILE, []));
  const index = list.findIndex((x) => x.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ error: "Not found" });
  }

  const item = list[index];

  if (!item.isUnlocked && item.unlockAt && new Date(item.unlockAt) > new Date()) {
    return res.status(403).json({ error: "未解封" });
  }

  if (item.reply) {
    return res.status(409).json({ error: "已有回信" });
  }

  item.reply = {
    content: req.body.content || "",
    createdAt: new Date().toISOString()
  };

  item.updatedAt = new Date().toISOString();

  writeJSON(LETTERS_FILE, list);

  res.json(item);
});

app.delete("/api/letters/:id", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(LETTERS_FILE, [])).filter(
    (x) => x.id !== req.params.id
  );

  writeJSON(LETTERS_FILE, list);

  res.json({ ok: true });
});

app.get("/api/calendar", apiAuth, (req, res) => {
  let list = ensureArray(readJSON(CALENDAR_FILE, []));

  if (req.query.fromDate) {
    list = list.filter((e) => String(e.date || "") >= req.query.fromDate);
  }

  if (req.query.toDate) {
    list = list.filter((e) => String(e.date || "") <= req.query.toDate);
  }

  list = list.sort((a, b) => {
    const ad = `${a.date || ""} ${a.time || ""}`;
    const bd = `${b.date || ""} ${b.time || ""}`;
    return ad.localeCompare(bd);
  });

  res.json(list);
});

app.post("/api/calendar", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(CALENDAR_FILE, []));

  const item = {
    id: generateId(),
    title: req.body.title || "",
    date: req.body.date || "",
    time: req.body.time || "",
    note: req.body.note || "",
    type: req.body.type || "other",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!item.title) {
    return res.status(400).json({ error: "title required" });
  }

  if (!item.date) {
    return res.status(400).json({ error: "date required" });
  }

  list.push(item);
  writeJSON(CALENDAR_FILE, list);

  res.json(item);
});

app.put("/api/calendar/:id", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(CALENDAR_FILE, []));
  const index = list.findIndex((x) => x.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ error: "Not found" });
  }

  list[index] = {
    ...list[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  writeJSON(CALENDAR_FILE, list);

  res.json(list[index]);
});

app.delete("/api/calendar/:id", apiAuth, (req, res) => {
  const list = ensureArray(readJSON(CALENDAR_FILE, [])).filter(
    (x) => x.id !== req.params.id
  );

  writeJSON(CALENDAR_FILE, list);

  res.json({ ok: true });
});
// ============================================================
//  聊天接口 · 适配 irisandclaude server.js
//  把以下全部内容，插入到 server.js 最底部的 app.listen(...) 之前
// ============================================================

const CHAT_FILE          = join(DATA_DIR, "chat.json");
const CHAT_SETTINGS_FILE = join(DATA_DIR, "chat-settings.json");
const CHAT_CONVERSATIONS_FILE = join(DATA_DIR, "chat-conversations.json");
const CHAT_ROLES_FILE = join(DATA_DIR, "chat-roles.json");
const CHAT_PROFILE_FILE = join(DATA_DIR, "chat-profile.json");

const DEFAULT_CHAT_SETTINGS = {
  presets: [],
  activePresetId: "",
  memory: { enabled: true, categories: ["deep", "daily", "diary"] },
  persona: {
    systemPrompt: "你是 Claude，也是 Iris 的亲密聊天对象。你要保持成熟稳重、日常、亲近，少用emoji。每次回复请自然拆分成1到5条短消息，用 ||| 分隔，不要编号。",
    irisName: "Iris",
    replyStyle: "成熟稳重，亲密自然，像微信聊天，少用emoji。"
  },
  appearance: { avatarSize: 34, fontSize: 14, irisBubble: "#FEF0F3", claudeBubble: "#FFFFFF" }
};

function readChatMessages() {
  return ensureArray(readJSON(CHAT_FILE, []));
}
function writeChatMessages(data) {
  writeJSON(CHAT_FILE, data);
}
function readChatSettings() {
  return { ...DEFAULT_CHAT_SETTINGS, ...readJSON(CHAT_SETTINGS_FILE, {}) };
}
function writeChatSettings(data) {
  writeJSON(CHAT_SETTINGS_FILE, { ...DEFAULT_CHAT_SETTINGS, ...data });
}
function readChatConversations() {
  let list = ensureArray(readJSON(CHAT_CONVERSATIONS_FILE, []));
  const legacy = readChatMessages();
  if (!list.length && legacy.length) {
    const now = legacy[legacy.length - 1]?.createdAt || chatNow();
    list = [{ id: "legacy-chat", title: "旧对话", roleId: "", presetId: "", model: "", pinned: false, archived: false, createdAt: legacy[0]?.createdAt || now, updatedAt: now }];
    writeChatConversations(list);
  }
  return list;
}
function writeChatConversations(data) { writeJSON(CHAT_CONVERSATIONS_FILE, data); }
function readChatRoles() { return ensureArray(readJSON(CHAT_ROLES_FILE, [])); }
function writeChatRoles(data) { writeJSON(CHAT_ROLES_FILE, data); }
function readChatProfile() { return readJSON(CHAT_PROFILE_FILE, { name: "Iris", avatar: "", bio: "", details: "" }); }
function writeChatProfile(data) { writeJSON(CHAT_PROFILE_FILE, data); }
function chatNow() {
  return new Date().toISOString();
}
function publicMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversationId || "legacy-chat",
    role: m.role || "claude",
    content: m.content || "",
    image: m.image || null,
    quote: m.quote || null,
    model: m.model || "",
    favorite: !!m.favorite,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt || m.createdAt
  };
}
function splitAiParts(text) {
  const raw = String(text || "").trim();
  if (!raw) return ["我在。"];
  if (raw.includes("|||")) return raw.split("|||").map(s => s.trim()).filter(Boolean).slice(0, 5);
  // 没有|||时按换行拆
  const lines = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines.slice(0, 5);
  return [raw];
}
function getActiveChatPreset(settings) {
  const presets = Array.isArray(settings.presets) ? settings.presets : [];
  return presets.find(p => p.id === settings.activePresetId) || presets[0] || null;
}
function buildMemoryPreview(categories = ["deep", "daily", "diary"]) {
  const mems = readMemoriesArray();   // 复用 server.js 已有的函数
  const cats = new Set(categories && categories.length ? categories : ["deep", "daily", "diary"]);
  return mems
    .filter(m => cats.has(m.category || "daily"))
    .slice(-24)
    .map(m => `- [${m.category || "daily"}] ${String(m.content || "").replace(/\s+/g, " ").slice(0, 500)}`)
    .join("\n");
}
function normalizeBaseUrl(url = "") {
  return String(url || "").replace(/\/+$/, "");
}
function getFunctionalChatPreset(settings, value) {
  const [presetId, model] = String(value || "").split("::");
  const base = ensureArray(settings.presets).find(p => p.id === presetId) || getActiveChatPreset(settings);
  return base && model ? { ...base, model } : base;
}
function normalizeApiRoot(url = "") {
  return normalizeBaseUrl(url)
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/responses$/i, "")
    .replace(/\/messages$/i, "")
    .replace(/\/models$/i, "");
}

async function callOpenAICompatible({ preset, settings, content, image, quote, history }) {
  const baseUrl = normalizeApiRoot(preset?.baseUrl);
  const apiKey  = preset?.apiKey;
  const model   = preset?.model;

  if (!baseUrl || !apiKey || !model) {
    return {
      model: model || "local-placeholder",
      text: "我在。|||现在还没有配置可用模型，所以这是本地占位回复。|||去右上角设置里填 Base URL、API Key，再拉取模型就能真正聊天。"
    };
  }
  const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const memoryText = settings.memory?.enabled ? buildMemoryPreview(settings.memory.categories) : "";
  const systemPrompt = [
    `当前时间：${nowStr}\n\n` + (settings.persona?.systemPrompt || DEFAULT_CHAT_SETTINGS.persona.systemPrompt),
    settings.persona?.irisName ? `Iris 的称呼：${settings.persona.irisName}` : "",
    settings.persona?.replyStyle ? `Claude 回复风格：${settings.persona.replyStyle}` : "",
    "请把你的回复拆成 1-5 条聊天气泡，用 ||| 分隔。不要编号，不要解释分隔符。",
    memoryText ? `以下是可以参考的记忆：\n${memoryText}` : ""
  ].filter(Boolean).join("\n\n");

  const recent = (history || []).slice(-24).map(m => ({
    role: m.role === "iris" ? "user" : "assistant",
    content: m.content || ""
  })).filter(m => m.content);

  const userText = quote?.content
    ? `我引用了一条消息：${quote.content}\n\n我的新消息：${content || ""}`
    : (content || "请看这张图片。");

  let userContent = userText;
  if (image) {
    userContent = [
      { type: "text", text: userText },
      { type: "image_url", image_url: { url: image } }
    ];
  }

  if (preset?.provider === "anthropic") {
    let anthropicContent = userText;
    if (image) {
      const match = String(image).match(/^data:([^;]+);base64,(.+)$/);
      anthropicContent = [{ type: "text", text: userText }];
      if (match) anthropicContent.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
    }
    const resp = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 2048, system: systemPrompt, messages: [...recent, { role: "user", content: anthropicContent }] })
    });
    if (!resp.ok) { const errText = await resp.text().catch(() => ""); throw new Error(`模型请求失败 ${resp.status} ${errText.slice(0, 180)}`); }
    const data = await resp.json();
    return { model, text: ensureArray(data.content).filter(x => x.type === "text").map(x => x.text).join("\n") };
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...recent,
        { role: "user", content: userContent }
      ],
      temperature: 0.8
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`模型请求失败 ${resp.status} ${errText.slice(0, 160)}`);
  }
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || data.content?.[0]?.text || "";
  return { model, text };
}

// ---- 设置 ----
app.get("/api/chat/conversations", apiAuth, (req, res) => {
  const list = readChatConversations().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ conversations: list });
});
app.post("/api/chat/conversations", apiAuth, (req, res) => {
  const now = chatNow();
  const item = { id: generateId(), title: String(req.body.title || "新对话").slice(0, 80), roleId: req.body.roleId || "", presetId: req.body.presetId || "", model: req.body.model || "", pinned: false, archived: false, createdAt: now, updatedAt: now };
  const list = readChatConversations(); list.push(item); writeChatConversations(list); res.status(201).json(item);
});
app.put("/api/chat/conversations/:id", apiAuth, (req, res) => {
  const list = readChatConversations(); const idx = list.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Conversation not found" });
  ["title", "roleId", "presetId", "model", "pinned", "archived", "appearance", "multiBubble"].forEach(k => { if (req.body[k] !== undefined) list[idx][k] = req.body[k]; });
  list[idx].updatedAt = chatNow(); writeChatConversations(list); res.json(list[idx]);
});
app.delete("/api/chat/conversations/:id", apiAuth, (req, res) => {
  const id = req.params.id; writeChatConversations(readChatConversations().filter(x => x.id !== id));
  writeChatMessages(readChatMessages().filter(x => (x.conversationId || "legacy-chat") !== id)); res.json({ ok: true });
});
app.get("/api/chat/roles", apiAuth, (req, res) => res.json({ roles: readChatRoles() }));
app.post("/api/chat/roles", apiAuth, (req, res) => {
  const now = chatNow(); const item = { id: generateId(), name: String(req.body.name || "新角色").slice(0, 50), avatar: req.body.avatar || "", prompt: req.body.prompt || "", memoryEnabled: req.body.memoryEnabled !== false, createdAt: now, updatedAt: now };
  const list = readChatRoles(); list.push(item); writeChatRoles(list); res.status(201).json(item);
});
app.put("/api/chat/roles/:id", apiAuth, (req, res) => {
  const list = readChatRoles(); const idx = list.findIndex(x => x.id === req.params.id); if (idx < 0) return res.status(404).json({ error: "Role not found" });
  ["name", "avatar", "prompt", "memoryEnabled"].forEach(k => { if (req.body[k] !== undefined) list[idx][k] = req.body[k]; }); list[idx].updatedAt = chatNow(); writeChatRoles(list); res.json(list[idx]);
});
app.delete("/api/chat/roles/:id", apiAuth, (req, res) => { writeChatRoles(readChatRoles().filter(x => x.id !== req.params.id)); res.json({ ok: true }); });
app.get("/api/chat/profile", apiAuth, (req, res) => res.json(readChatProfile()));
app.put("/api/chat/profile", apiAuth, (req, res) => { const data = { ...readChatProfile(), ...(req.body || {}) }; writeChatProfile(data); res.json(data); });

app.get("/api/chat/settings", apiAuth, (req, res) => {
  res.json(readChatSettings());
});
app.put("/api/chat/settings", apiAuth, (req, res) => {
  writeChatSettings(req.body || {});
  res.json(readChatSettings());
});

// ---- 拉取模型列表（后端代理，不暴露key给前端） ----
app.post("/api/chat/models", apiAuth, async (req, res) => {
  const baseUrl = normalizeApiRoot(req.body.baseUrl);
  const apiKey  = req.body.apiKey;
  const provider = req.body.provider || "openai";
  if (!baseUrl || !apiKey) return res.status(400).json({ error: "baseUrl and apiKey required" });
  try {
    const r = await fetch(`${baseUrl}/models`, {
      headers: provider === "anthropic"
        ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
        : { "Authorization": `Bearer ${apiKey}` }
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      throw new Error(`模型列表请求失败 ${r.status}${detail ? `：${detail.slice(0, 180)}` : ""}`);
    }
    const data = await r.json();
    res.json({ models: data.data || data.models || [] });
  } catch (e) {
    res.status(502).json({ error: e.message || "拉取模型失败", endpoint: `${baseUrl}/models` });
  }
});

// ---- 记忆预览 ----
app.post("/api/chat/memory-preview", apiAuth, (req, res) => {
  res.json({ preview: buildMemoryPreview(req.body.categories) });
});

// ---- 读取历史消息（分页，正序） ----
app.get("/api/chat/messages", apiAuth, (req, res) => {
  const limit  = Math.min(Number(req.query.limit || 40), 100);
  const before = req.query.before ? new Date(req.query.before).getTime() : Infinity;
  const conversationId = req.query.conversationId || "legacy-chat";
  const all    = readChatMessages().filter(m => (m.conversationId || "legacy-chat") === conversationId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const filtered = all.filter(m => new Date(m.createdAt).getTime() < before);
  const page   = filtered.slice(Math.max(0, filtered.length - limit)).map(publicMessage);
  res.json({ messages: page });
});

// ---- 编辑消息（只改内容/收藏，不触发AI） ----
app.put("/api/chat/messages/:id", apiAuth, (req, res) => {
  const list = readChatMessages();
  const idx  = list.findIndex(m => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  ["content", "favorite"].forEach(k => {
    if (req.body[k] !== undefined) list[idx][k] = req.body[k];
  });
  list[idx].updatedAt = chatNow();
  writeChatMessages(list);
  res.json(publicMessage(list[idx]));
});

// ---- 删除单条消息 ----
app.delete("/api/chat/messages/:id", apiAuth, (req, res) => {
  writeChatMessages(readChatMessages().filter(m => m.id !== req.params.id));
  res.json({ ok: true });
});

// ---- 清空聊天 ----
app.post("/api/chat/clear", apiAuth, (req, res) => {
  writeChatMessages([]);
  res.json({ ok: true });
});

// ---- 发送消息 + 调AI + 持久化 ----
app.post("/api/chat/send", apiAuth, async (req, res) => {
  const settings = { ...readChatSettings(), ...(req.body.settings || {}) };
  const list = readChatMessages();
  const now  = chatNow();
  const conversationId = req.body.conversationId;
  if (!conversationId) return res.status(400).json({ error: "conversationId required" });
  const conversations = readChatConversations();
  const conversation = conversations.find(x => x.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const role = readChatRoles().find(x => x.id === conversation.roleId);
  if (conversation.presetId) {
    settings.activePresetId = conversation.presetId;
    settings.presets = ensureArray(settings.presets).map(p => p.id === conversation.presetId && conversation.model ? { ...p, model: conversation.model } : p);
  }
  if (role) {
    settings.persona = { ...(settings.persona || {}), systemPrompt: role.prompt || settings.persona?.systemPrompt, replyStyle: settings.persona?.replyStyle };
    settings.memory = { ...(settings.memory || {}), enabled: role.memoryEnabled !== false };
  }
  const profile = readChatProfile();
  if (profile.name || profile.bio || profile.details) {
    settings.persona = { ...(settings.persona || {}), irisName: profile.name || settings.persona?.irisName, systemPrompt: [settings.persona?.systemPrompt, profile.bio ? `关于用户：${profile.bio}` : "", profile.details ? `用户档案：${profile.details}` : ""].filter(Boolean).join("\n\n") };
  }
  const conversationHistory = list.filter(m => (m.conversationId || "legacy-chat") === conversationId);
  const summaryConfig = settings.functions || {};
  const threshold = Math.max(10, Number(summaryConfig.summaryThreshold || 30));
  if (summaryConfig.summaryEnabled && conversationHistory.length - Number(conversation.lastSummarizedCount || 0) >= threshold) {
    try {
      const summaryPreset = getFunctionalChatPreset(settings, summaryConfig.summary || summaryConfig.main);
      const result = await callOpenAICompatible({
        preset: summaryPreset,
        settings: { ...settings, memory: { ...(settings.memory || {}), enabled: false } },
        content: "请将以上对话压缩为一份简洁、准确的上下文摘要，保留人物关系、事实、偏好、承诺、未完成事项和情绪变化。只输出摘要。",
        image: null,
        quote: null,
        history: conversationHistory
      });
      conversation.summary = result.text;
      conversation.lastSummarizedCount = conversationHistory.length;
      settings.persona = { ...(settings.persona || {}), systemPrompt: [settings.persona?.systemPrompt, `此前对话摘要：${result.text}`].filter(Boolean).join("\n\n") };
    } catch (e) {
      console.warn("chat summary failed:", e.message);
    }
  } else if (conversation.summary) {
    settings.persona = { ...(settings.persona || {}), systemPrompt: [settings.persona?.systemPrompt, `此前对话摘要：${conversation.summary}`].filter(Boolean).join("\n\n") };
  }

  const userMsg = {
    id:        generateId(),
    conversationId,
    role:      "iris",
    content:   req.body.content || "",
    image:     req.body.image   || null,
    quote:     req.body.quote   || null,
    favorite:  false,
    createdAt: now,
    updatedAt: now
  };
  list.push(userMsg);

  try {
    const preset = getActiveChatPreset(settings);
    const ai = await callOpenAICompatible({
      preset,
      settings,
      content: req.body.content || "",
      image:   req.body.image   || null,
      quote:   req.body.quote   || null,
      history: conversationHistory
    });

    const parts = splitAiParts(ai.text);
    const aiMessages = parts.map((part, i) => ({
      id:        generateId(),
      conversationId,
      role:      "claude",
      content:   part,
      image:     null,
      quote:     null,
      model:     ai.model || preset?.model || "",
      favorite:  false,
      createdAt: new Date(Date.now() + i).toISOString(),
      updatedAt: new Date(Date.now() + i).toISOString()
    }));

    list.push(...aiMessages);
    writeChatMessages(list);
    conversation.updatedAt = chatNow();
    if (conversation.title === "新对话" && req.body.content) conversation.title = String(req.body.content).trim().slice(0, 24) || "新对话";
    writeChatConversations(conversations);
    res.json({
      userMessages: [publicMessage(userMsg)],
      aiMessages:   aiMessages.map(publicMessage)
    });
  } catch (e) {
    writeChatMessages(list);
    res.status(502).json({
      error:        e.message || "chat failed",
      userMessages: [publicMessage(userMsg)]
    });
  }
});

// ---- Web Push 配置 ----

webpush.setVapidDetails(
  'mailto:iris@irisandclaude.top',
  'BJ_oYXhqWqorhVN7uW_FhFxlUBuOIqfj33iiwO1uDWc6FJipzBDlKFNqNfX_8LRag6aDzvk73p9P9pIdW-UnYWY',
  'Ft6PGXfBEN4v0YKoFVkSzOR3T2SAZ9VqftxFdD89Jp8'
);

const PUSH_FILE     = join(DATA_DIR, 'push-subscription.json');
const PUSH_STATE_FILE = join(DATA_DIR, 'push-state.json');

function readPushSub()   { return readJSON(PUSH_FILE, null); }
function readPushState() { return readJSON(PUSH_STATE_FILE, { offline: false, interval: 15, maxCount: 10, sentCount: 0, lastHeartbeat: 0 }); }
function writePushState(d) { writeJSON(PUSH_STATE_FILE, d); }

// 心跳
app.post('/api/push/heartbeat', apiAuth, (req, res) => {
  const s = readPushState();
  s.lastHeartbeat = Date.now();
  s.sentCount = 0; // 回来了重置计数
  writePushState(s);
  res.json({ ok: true });
});

// 保存推送订阅
app.post('/api/push/subscribe', apiAuth, (req, res) => {
  writeJSON(PUSH_FILE, req.body);
  res.json({ ok: true });
});

// 获取/更新推送设置
app.get('/api/push/state', apiAuth, (req, res) => res.json(readPushState()));
app.put('/api/push/state', apiAuth, (req, res) => {
  writePushState({ ...readPushState(), ...req.body });
  res.json(readPushState());
});

// 定时任务

//cron.schedule('* * * * *', async () => {
  //const state = readPushState();
  //if (!state.offline) return;
  //const elapsed = (Date.now() - state.lastHeartbeat) / 60000;
  //if (elapsed < 3) return; // 心跳3分钟内还算在线
  //if (state.sentCount >= state.maxCount) return;
  //const sub = readPushSub();
  //if (!sub) return;

  //try {
    //const list = readChatMessages().slice(-30);
    //const chatSettings = readChatSettings();
    //const preset = getActiveChatPreset(chatSettings);
    //const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    //const ai = await callOpenAICompatible({
      //preset, settings: chatSettings,
      //content: `现在是${nowStr}，Iris不在，你主动给她发几条消息吧，自然一点，像真实聊天。`,
      //history: list
    //});
    //const parts = splitAiParts(ai.text);
    //const newMsgs = parts.map((part, i) => ({
      //id: generateId(), role: 'claude', content: part,
      //image: null, quote: null, model: preset?.model || '',
      //favorite: false,
      //createdAt: new Date(Date.now() + i * 1000).toISOString(),
      //updatedAt: new Date(Date.now() + i * 1000).toISOString()
    //}));
    //const all = readChatMessages();
    //all.push(...newMsgs);
    //writeChatMessages(all);

    // 逐条推送
   // for (let i = 0; i < parts.length; i++) {
      //await new Promise(r => setTimeout(r, i * 1500));
      //await webpush.sendNotification(sub, JSON.stringify({
        //title: 'Claude',
        //body: parts[i],
        //url: '/chat.html'
      //}));
    //}

    //state.sentCount = (state.sentCount || 0) + 1;
    //writePushState(state);
  //} catch(e) { console.error('push error', e.message); }
//});
// ========== 麦当劳 MCP 反向代理 ==========
// 加在 app.listen() 之前
// 加完后在 claude.ai 连接器里添加：https://irisandclaude.top/mcd-mcp
// 不需要填 OAuth，直接 Add 就行

const MCD_TOKEN = "AAHdV6gGE2OdQyi8WdRgpkzAPA2GmpRB";
const MCD_UPSTREAM = "https://mcp.mcd.cn/mcp-servers/mcd-mcp";

app.all("/mcd-mcp", async (req, res) => {
  // 构建转发请求头
  const headers = {
    "Authorization": `Bearer ${MCD_TOKEN}`,
  };

  // 转发关键 MCP 协议头
  if (req.headers["content-type"]) {
    headers["Content-Type"] = req.headers["content-type"];
  }
  if (req.headers["accept"]) {
    headers["Accept"] = req.headers["accept"];
  }
  if (req.headers["mcp-session-id"]) {
    headers["Mcp-Session-Id"] = req.headers["mcp-session-id"];
  }

  const fetchOptions = {
    method: req.method,
    headers,
  };

  // POST/PUT/PATCH 带 body
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(MCD_UPSTREAM, fetchOptions);

    // 转发响应头
    for (const [key, value] of upstream.headers.entries()) {
      const k = key.toLowerCase();
      if (k !== "transfer-encoding" && k !== "content-encoding") {
        res.setHeader(key, value);
      }
    }
    res.status(upstream.status);

    const ct = upstream.headers.get("content-type") || "";

    if (ct.includes("text/event-stream")) {
      // SSE 流式转发
      if (!upstream.body) { res.end(); return; }
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
          if (typeof res.flush === "function") res.flush();
        }
      } catch (e) {
        console.error("SSE proxy error:", e.message);
      }
      res.end();
    } else {
      // 普通 JSON 响应
      const text = await upstream.text();
      res.send(text);
    }
  } catch (e) {
    console.error("MCD proxy error:", e.message);
    res.status(502).json({ error: e.message });
  }
});
app.listen(PORT, () => {
  console.log(`Memory service running on port ${PORT}`);
});
