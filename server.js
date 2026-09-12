import "dotenv/config";
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
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
}
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = join(__dirname, "data");
const CHAT_IMAGE_DIR = join(DATA_DIR, "chat-images");
const COMPANION_AUDIO_DIR = join(DATA_DIR, "companion-audio");
const STICKER_IMAGE_DIR = join(DATA_DIR, "sticker-images");
try {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(CHAT_IMAGE_DIR, { recursive: true });
  mkdirSync(COMPANION_AUDIO_DIR, { recursive: true });
  mkdirSync(STICKER_IMAGE_DIR, { recursive: true });
} catch (e) {}

const MEMORY_FILE = join(__dirname, "memories.json");
const MOOD_FILE = join(DATA_DIR, "moods.json");
const WISHLIST_FILE = join(DATA_DIR, "wishlist.json");
const LETTERS_FILE = join(DATA_DIR, "letters.json");
const CALENDAR_FILE = join(DATA_DIR, "calendar.json");
const SELF_PROFILE_BACKUP_FILE = join(DATA_DIR, "ai-self-profile.json");
const COMPANION_FILE = join(DATA_DIR, "companion-sessions.json");
const COMPANION_SETTINGS_FILE = join(DATA_DIR, "companion-settings.json");
const LISTENING_ROOMS_FILE = join(DATA_DIR, "listening-rooms.json");
const LISTENING_LIBRARY_FILE = join(DATA_DIR, "listening-library.json");
const STICKER_LIBRARY_FILE = join(DATA_DIR, "sticker-library.json");

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

const DEFAULT_COMPANION_SETTINGS = Object.freeze({
  voice: { enabled: false, baseUrl: "", apiKey: "", model: "", voice: "alloy", format: "mp3", speed: 1, autoSpeak: false },
  defaultAmbient: "rain",
  wallpapers: {}
});
function readCompanionSettings() {
  const saved = readJSON(COMPANION_SETTINGS_FILE, {});
  return { ...DEFAULT_COMPANION_SETTINGS, ...saved, voice: { ...DEFAULT_COMPANION_SETTINGS.voice, ...(saved.voice || {}) } };
}
function writeCompanionSettings(settings) {
  writeJSON(COMPANION_SETTINGS_FILE, { ...DEFAULT_COMPANION_SETTINGS, ...settings, voice: { ...DEFAULT_COMPANION_SETTINGS.voice, ...(settings.voice || {}) } });
}
function readCompanionSessions() { return ensureArray(readJSON(COMPANION_FILE, [])); }
function writeCompanionSessions(sessions) { writeJSON(COMPANION_FILE, sessions); }
function readListeningRooms() { return ensureArray(readJSON(LISTENING_ROOMS_FILE, [])); }
function writeListeningRooms(rooms) { writeJSON(LISTENING_ROOMS_FILE, rooms); }
function readListeningLibrary() { const saved = readJSON(LISTENING_LIBRARY_FILE, {}); return { favorites:ensureArray(saved.favorites), recent:ensureArray(saved.recent), profiles:saved.profiles && typeof saved.profiles === "object" ? saved.profiles : {}, scoped:saved.scoped === true }; }
function writeListeningLibrary(library) { writeJSON(LISTENING_LIBRARY_FILE, { favorites:ensureArray(library?.favorites), recent:ensureArray(library?.recent), profiles:library?.profiles && typeof library.profiles === "object" ? library.profiles : {}, scoped:library?.scoped === true, updatedAt:chatNow() }); }

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

const MEMORY_AFFECT_LIMITS = Object.freeze({
  valence: Object.freeze({ min:-1, max:1, fallback:0 }),
  arousal: Object.freeze({ min:0, max:1, fallback:0.3 })
});
function normaliseMemoryAffect(value, limits) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : limits.fallback;
  return Math.max(limits.min, Math.min(limits.max, safe));
}
function normaliseMemoryAffects(input = {}, fallback = {}) {
  return {
    valence: normaliseMemoryAffect(input.valence === undefined ? fallback.valence : input.valence, MEMORY_AFFECT_LIMITS.valence),
    arousal: normaliseMemoryAffect(input.arousal === undefined ? fallback.arousal : input.arousal, MEMORY_AFFECT_LIMITS.arousal)
  };
}
function memoryToDb(memory) {
  const affect = normaliseMemoryAffects(memory);
  return {
    id: memory.id,
    content: memory.content || "",
    category: memory.category || "daily",
    tags: memory.tags || [],
    valence: affect.valence,
    arousal: affect.arousal,
    pinned: !!memory.pinned,
    source: memory.source || "server",
    created_at: memory.createdAt || memory.created_at || new Date().toISOString(),
    updated_at: memory.updatedAt || memory.updated_at || new Date().toISOString()
  };
}

function saveMemories(data) {
  writeJSON(MEMORY_FILE, data);

  const rows = (data.memories || []).map(memoryToDb);
  if (rows.length) {
    supabase
      .from("memories")
      .upsert(rows, { onConflict: "id" })
      .then(({ error }) => {
        if (error) console.error("Supabase memories sync error:", error.message); else console.log("Supabase memories sync OK");
      });
  }
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

// ---- Sticker library ------------------------------------------------------
// Sticker metadata is shared through Supabase. The small JSON copy is a
// deliberate offline/failure fallback for the private VPS chat service.
const STICKER_BUCKET = "chat-stickers";
let stickerBucketReady = false;

function normaliseStickerPack(value = {}, index = 0) {
  return {
    id: String(value.id || generateId()),
    name: String(value.name || "未分类").trim().slice(0, 40) || "未分类",
    sortOrder: Number.isFinite(Number(value.sortOrder ?? value.sort_order)) ? Number(value.sortOrder ?? value.sort_order) : index,
    createdAt: value.createdAt || value.created_at || chatNow(),
    updatedAt: value.updatedAt || value.updated_at || chatNow()
  };
}
function normaliseSticker(value = {}) {
  return {
    id: String(value.id || generateId()),
    packId: value.packId ?? value.pack_id ?? null,
    name: String(value.name || "").trim().slice(0, 60),
    description: String(value.description || "").trim().slice(0, 240),
    tags: ensureArray(value.tags).map(tag => String(tag).trim().slice(0, 24)).filter(Boolean).slice(0, 12),
    imageUrl: String(value.imageUrl ?? value.image_url ?? "").trim(),
    storagePath: String(value.storagePath ?? value.storage_path ?? "").trim(),
    aiWeight: Math.max(1, Math.min(5, Math.round(Number(value.aiWeight ?? value.ai_weight) || 1))),
    createdAt: value.createdAt || value.created_at || chatNow(),
    updatedAt: value.updatedAt || value.updated_at || chatNow()
  };
}
function stickerToDbRow(sticker) {
  const item = normaliseSticker(sticker);
  return { id:item.id, pack_id:item.packId || null, name:item.name, description:item.description, tags:item.tags, image_url:item.imageUrl, storage_path:item.storagePath, ai_weight:item.aiWeight, created_at:item.createdAt, updated_at:item.updatedAt };
}
function stickerPackToDbRow(pack) {
  const item = normaliseStickerPack(pack);
  return { id:item.id, name:item.name, sort_order:item.sortOrder, created_at:item.createdAt, updated_at:item.updatedAt };
}
function readStickerLibraryBackup() {
  const saved = readJSON(STICKER_LIBRARY_FILE, {});
  return {
    packs: ensureArray(saved.packs).map(normaliseStickerPack).sort((a,b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
    stickers: ensureArray(saved.stickers).map(normaliseSticker).filter(item => item.imageUrl)
  };
}
function writeStickerLibraryBackup(library) {
  writeJSON(STICKER_LIBRARY_FILE, { packs:ensureArray(library.packs).map(normaliseStickerPack), stickers:ensureArray(library.stickers).map(normaliseSticker), updatedAt:chatNow() });
}
async function loadStickerLibrary() {
  try {
    const [packsResult, stickersResult] = await Promise.all([
      supabase.from("sticker_packs").select("*").order("sort_order", { ascending:true }),
      supabase.from("stickers").select("*").order("created_at", { ascending:true })
    ]);
    dbError("sticker_packs", packsResult.error);
    dbError("stickers", stickersResult.error);
    const library = { packs:(packsResult.data || []).map(normaliseStickerPack), stickers:(stickersResult.data || []).map(normaliseSticker) };
    writeStickerLibraryBackup(library);
    return library;
  } catch (error) {
    console.warn("sticker library database unavailable; using local backup:", error.message);
    return readStickerLibraryBackup();
  }
}
async function upsertStickerPack(pack) {
  const item = normaliseStickerPack(pack);
  try {
    const { data, error } = await supabase.from("sticker_packs").upsert(stickerPackToDbRow(item), { onConflict:"id" }).select().single();
    dbError("sticker_packs", error);
    return normaliseStickerPack(data);
  } catch (error) {
    console.warn("sticker pack database write unavailable; saving local backup:", error.message);
    return item;
  }
}
async function upsertSticker(sticker) {
  const item = normaliseSticker(sticker);
  try {
    const { data, error } = await supabase.from("stickers").upsert(stickerToDbRow(item), { onConflict:"id" }).select().single();
    dbError("stickers", error);
    return normaliseSticker(data);
  } catch (error) {
    console.warn("sticker database write unavailable; saving local backup:", error.message);
    return item;
  }
}
async function ensureStickerBucket() {
  if (stickerBucketReady) return;
  const { error: lookupError } = await supabase.storage.getBucket(STICKER_BUCKET);
  if (lookupError) {
    const { error: createError } = await supabase.storage.createBucket(STICKER_BUCKET, { public:true, fileSizeLimit:"5MB", allowedMimeTypes:["image/png", "image/jpeg", "image/webp", "image/gif"] });
    if (createError && !/already exists|duplicate/i.test(createError.message || "")) throw createError;
  }
  stickerBucketReady = true;
}
function parseStickerImageData(value) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-z0-9+/=\s]+)$/i.exec(String(value || ""));
  if (!match) throw new Error("请上传 PNG、JPG、WebP 或 GIF 图片");
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error("表情包图片需小于 5MB");
  const extension = ({ "image/png":"png", "image/jpeg":"jpg", "image/webp":"webp", "image/gif":"gif" })[mime];
  return { buffer, mime, extension };
}
async function storeStickerImage(dataUrl, id) {
  const image = parseStickerImageData(dataUrl);
  const storagePath = `stickers/${id}.${image.extension}`;
  try {
    await ensureStickerBucket();
    const { error } = await supabase.storage.from(STICKER_BUCKET).upload(storagePath, image.buffer, { contentType:image.mime, upsert:true, cacheControl:"31536000" });
    if (error) throw error;
    const { data } = supabase.storage.from(STICKER_BUCKET).getPublicUrl(storagePath);
    if (!data?.publicUrl) throw new Error("未能生成图片地址");
    return { imageUrl:data.publicUrl, storagePath };
  } catch (error) {
    // Keep a private local path as a safe fallback if Storage is temporarily
    // unavailable. It is still served only through the authenticated route.
    console.warn("Supabase Storage unavailable for sticker; using local file:", error.message);
    const file = `sticker-${id}.${image.extension}`;
    writeFileSync(join(STICKER_IMAGE_DIR, file), image.buffer);
    return { imageUrl:`/sticker-images/${file}?key=${encodeURIComponent(API_KEY)}`, storagePath:`local:${file}` };
  }
}
function stickerSnapshot(sticker) {
  const item = normaliseSticker(sticker);
  return { id:item.id, name:item.name, description:item.description, tags:item.tags, imageUrl:item.imageUrl };
}
const DEFAULT_ROLE_STICKER_CONFIG = Object.freeze({ enabled:false, allPacks:false, packIds:[], perPackLimit:8, totalLimit:32, refreshEvery:8, signatureIds:[], favoriteIds:[] });
function normaliseRoleStickerConfig(value) {
  const saved = value && typeof value === "object" ? value : {};
  return {
    enabled: saved.enabled === true,
    allPacks: saved.allPacks === true,
    packIds: [...new Set(ensureArray(saved.packIds).map(String).filter(Boolean))].slice(0, 80),
    perPackLimit: Math.max(1, Math.min(20, Math.round(Number(saved.perPackLimit) || DEFAULT_ROLE_STICKER_CONFIG.perPackLimit))),
    totalLimit: Math.max(4, Math.min(80, Math.round(Number(saved.totalLimit) || DEFAULT_ROLE_STICKER_CONFIG.totalLimit))),
    refreshEvery: Math.max(1, Math.min(30, Math.round(Number(saved.refreshEvery) || DEFAULT_ROLE_STICKER_CONFIG.refreshEvery))),
    signatureIds: [...new Set(ensureArray(saved.signatureIds).map(String).filter(Boolean))].slice(0, 5),
    favoriteIds: [...new Set(ensureArray(saved.favoriteIds).map(String).filter(Boolean))].slice(0, 80)
  };
}
function stickerSeed(value) {
  let seed = 2166136261;
  for (const char of String(value || "")) { seed ^= char.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  return () => { seed += 0x6D2B79F5; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function weightedStickerSample(items, count, random) {
  const pool = [...items];
  const selected = [];
  const score = item => Math.max(1, item.aiWeight || 1);
  while (pool.length && selected.length < count) {
    const total = pool.reduce((sum, item) => sum + score(item), 0);
    let cursor = random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { cursor -= score(pool[i]); if (cursor <= 0) { index = i; break; } }
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}
async function buildStickerPrompt(role, conversation, history) {
  const config = normaliseRoleStickerConfig(role?.stickerConfig);
  if (!config.enabled) return "";
  const library = await loadStickerLibrary();
  const enabledPacks = config.allPacks ? library.packs.map(pack => pack.id) : config.packIds;
  if (!enabledPacks.length) return "";
  const userTurns = ensureArray(history).filter(message => message?.role === "iris").length;
  const paletteRound = Math.floor(userTurns / config.refreshEvery);
  const random = stickerSeed(`${conversation?.id || "default"}:${paletteRound}:${enabledPacks.join(",")}`);
  const perPack = enabledPacks.map(packId => weightedStickerSample(
    library.stickers.filter(item => item.packId === packId),
    config.perPackLimit,
    random
  )).filter(group => group.length);
  const candidates = [];
  // Round-robin keeps a large "all packs" selection from letting the first
  // few packs consume the global context budget by themselves.
  while (candidates.length < config.totalLimit && perPack.some(group => group.length)) {
    for (const group of perPack) {
      if (candidates.length >= config.totalLimit) break;
      if (group.length) candidates.push(group.shift());
    }
  }
  if (!candidates.length) return "";
  const lines = candidates.slice(0, config.totalLimit).map(item => `- ${item.id}｜${[item.name, ...item.tags, item.description].filter(Boolean).join("、").slice(0, 120) || "未填写描述"}`);
  return `【表情包｜界面功能】表情包是可选的情绪补充，不是每轮回复的固定结尾。只有在它能明显增强语气、回应玩笑、撒娇、安慰、惊喜或强烈情绪时才考虑使用；普通问答、说明、连续对话和仅仅确认收到时不要使用。即使适合也要克制，绝不因为“可用”就发送。需要时可以在回复的一句文字后单独写一个表情标记，格式必须精确为 {{sticker:ID}}。只能使用以下当前候选列表中的 ID；不要展示、解释或编造标记，也不要连续发送多张。Iris 发来的“【表情包】”是她实际发送的图片及语义描述。\n${lines.join("\n")}`;
}
function canAiSendSticker() {
  // Frequency is a judgement call for the model, guided by the sticker
  // prompt.  Do not impose a mechanical “wait N messages” gap here.
  return true;
}
async function extractAiStickerDirective(text, role, allowSticker = true) {
  const config = normaliseRoleStickerConfig(role?.stickerConfig);
  const raw = String(text || "");
  if (!config.enabled || !raw.includes("{{sticker:")) return { text:raw, sticker:null };
  if (!allowSticker) return { text:raw.replace(/\{\{sticker:[^}]+\}\}/gi, "").replace(/\s{2,}/g, " ").trim(), sticker:null };
  const library = await loadStickerLibrary();
  const allowedPacks = new Set(config.allPacks ? library.packs.map(pack => pack.id) : config.packIds);
  const match = /\{\{sticker:([a-z0-9_-]+)\}\}/i.exec(raw);
  const sticker = match && library.stickers.find(item => item.id === match[1] && allowedPacks.has(item.packId));
  if (!sticker) return { text:raw.replace(/\{\{sticker:[^}]+\}\}/gi, "").replace(/\s{2,}/g, " ").trim(), sticker:null };
  return { text:raw.replace(match[0], "").replace(/\s{2,}/g, " ").trim(), sticker:stickerSnapshot(sticker) };
}

// Supabase is the source of truth. JSON files are written only as a local
// backup after a successful database write (or can be used by the migration).
const DB_TABLES = { memories: "memories", moods: "moods", wishlist: "wishlist", letters: "letters", calendar: "calendar_events", selfProfile: "ai_self_profiles" };
const dbError = (table, error) => { if (error) throw new Error(`${table}: ${error.message}`); };
function memoryFromDb(r) { return { ...r, createdAt: r.created_at, updatedAt: r.updated_at }; }
function memoryToDbRow(m) { return memoryToDb(m); }
function moodFromDb(r) { return { date:r.date, type:r.type || "mood", who:r.who, mood:r.mood || undefined, phase:r.phase || undefined, note:r.note || "" }; }
function moodToDbRow(m) { return { date:m.date, type:m.type || "mood", who:m.who || "iris", mood:m.mood || null, phase:m.phase || null, note:m.note || "", created_at:m.created_at || new Date().toISOString(), updated_at:new Date().toISOString() }; }
function wishFromDb(r) { return { ...r, createdAt:r.created_at, updatedAt:r.updated_at }; }
function wishToDbRow(w) { return { id:w.id, text:w.text || "", category:w.category || "together", owner:w.owner || "both", done:!!w.done, created_at:w.createdAt, updated_at:w.updatedAt }; }
function letterFromDb(r) { return { id:r.id, from:r.from_person, to:r.to_person, content:r.content, moodTag:r.mood_tag, unlockAt:r.unlock_at, password:r.password_hash, hideUntilUnlock:!!r.hide_until_unlock, allowReply:r.allow_reply !== false, isUnlocked:!!r.is_unlocked, reply:r.reply, createdAt:r.created_at, updatedAt:r.updated_at }; }
function letterToDbRow(l) { return { id:l.id, from_person:l.from, to_person:l.to, content:l.content || "", mood_tag:l.moodTag || "happy", unlock_at:l.unlockAt || null, password_hash:l.password || null, hide_until_unlock:!!l.hideUntilUnlock, allow_reply:l.allowReply !== false, is_unlocked:!!l.isUnlocked, reply:l.reply || null, created_at:l.createdAt, updated_at:l.updatedAt }; }
const CALENDAR_RECURRENCE_TYPES = new Set(["none", "daily", "weekly", "custom"]);
const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeCalendarRecurrence(value) {
  const raw = value && typeof value === "object" ? value : {};
  const type = CALENDAR_RECURRENCE_TYPES.has(raw.type) ? raw.type : "none";
  const weekdays = [...new Set(ensureArray(raw.weekdays).map(Number).filter(day => Number.isInteger(day) && day >= 1 && day <= 7))].sort((a, b) => a - b);
  return type === "custom" ? { type, weekdays } : { type };
}
function normalizeRecurrenceEndDate(value) {
  const date = String(value || "").trim();
  return CALENDAR_DATE_RE.test(date) ? date : null;
}
function calendarWeekday(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday || 7;
}
function calendarEventOccursOnDate(event, date) {
  const startDate = String(event?.date || "");
  if (!CALENDAR_DATE_RE.test(startDate) || !CALENDAR_DATE_RE.test(date) || date < startDate) return false;
  const recurrence = normalizeCalendarRecurrence(event?.recurrence);
  const endDate = normalizeRecurrenceEndDate(event?.recurrenceEndDate ?? event?.recurrence_end_date);
  if (endDate && date > endDate) return false;
  if (recurrence.type === "none") return date === startDate;
  if (recurrence.type === "daily") return true;
  if (recurrence.type === "weekly") return calendarWeekday(date) === calendarWeekday(startDate);
  return recurrence.weekdays.includes(calendarWeekday(date));
}
function calendarDateRange(fromDate, toDate) {
  const start = CALENDAR_DATE_RE.test(fromDate || "") ? fromDate : null;
  const end = CALENDAR_DATE_RE.test(toDate || "") ? toDate : start;
  if (!start || !end || end < start) return null;
  return { start, end };
}
function nextCalendarDate(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
function calendarEventOccurrences(events, fromDate, toDate, limit = 50) {
  const range = calendarDateRange(fromDate, toDate);
  if (!range) return events;
  const output = [];
  for (let date = range.start; date <= range.end && output.length < limit; date = nextCalendarDate(date)) {
    for (const event of events) {
      if (!calendarEventOccursOnDate(event, date)) continue;
      output.push({ ...event, occurrenceDate:date });
      if (output.length >= limit) break;
    }
  }
  return output;
}
function assertCalendarRecurrence(value, recurrenceEndDate, startDate) {
  const recurrence = normalizeCalendarRecurrence(value);
  const endDate = normalizeRecurrenceEndDate(recurrenceEndDate);
  if (value && typeof value === "object" && value.type && recurrence.type === "none" && value.type !== "none") throw new Error("Calendar recurrence type is invalid");
  if (recurrence.type === "custom" && !recurrence.weekdays.length) throw new Error("Custom calendar recurrence requires at least one weekday");
  if (recurrenceEndDate !== undefined && recurrenceEndDate !== null && recurrenceEndDate !== "" && !endDate) throw new Error("Calendar recurrence end date must use YYYY-MM-DD");
  if (endDate && startDate && endDate < startDate) throw new Error("Calendar recurrence end date cannot be before its start date");
  return { recurrence, recurrenceEndDate:endDate };
}
function eventFromDb(r) { return { ...r, name:r.title, timeStart:r.time || "", timeEnd:r.time_end || "", location:r.location || "", recurrence:normalizeCalendarRecurrence(r.recurrence), recurrenceEndDate:normalizeRecurrenceEndDate(r.recurrence_end_date ?? r.recurrenceEndDate), createdAt:r.created_at, updatedAt:r.updated_at }; }
function eventToDbRow(e) { const normalized = assertCalendarRecurrence(e.recurrence, e.recurrenceEndDate ?? e.recurrence_end_date, e.date); return { id:e.id, title:e.title || e.name || "", date:e.date, time:String(e.time ?? e.timeStart ?? "").trim() || null, time_end:String(e.time_end ?? e.timeEnd ?? "").trim() || null, location:e.location || "", note:e.note || "", type:e.type || "other", color:Number.isFinite(Number(e.color)) ? Number(e.color) : null, recurrence:normalized.recurrence, recurrence_end_date:normalized.recurrenceEndDate, source:e.source || "calendar", created_at:e.createdAt || e.created_at || new Date().toISOString(), updated_at:e.updatedAt || e.updated_at || new Date().toISOString() }; }
const TIMETABLE_WEEK_TYPES = new Set(["all", "odd", "even", "list"]);
const DEFAULT_PERIOD_TIMES = Object.freeze([
  { periodStart:1, periodEnd:2, startTime:"08:20", endTime:"09:50" },
  { periodStart:3, periodEnd:4, startTime:"10:10", endTime:"11:45" },
  { periodStart:5, periodEnd:6, startTime:"14:00", endTime:"15:30" },
  { periodStart:7, periodEnd:8, startTime:"15:50", endTime:"17:20" },
  { periodStart:9, periodEnd:10, startTime:"19:00", endTime:"20:30" }
]);
function normalizeWeekList(value) {
  const values = ensureArray(value).map(Number).filter(Number.isInteger).filter(number => number >= 1 && number <= 60);
  return [...new Set(values)].sort((a, b) => a - b);
}
function courseFromDb(r) {
  const weekType = TIMETABLE_WEEK_TYPES.has(r.week_type) ? r.week_type : "all";
  const courseName = r.name || "";
  const weekday = Number(r.day || 1);
  const periodStart = Number(r.start_period || 1);
  const periodEnd = Number(r.end_period || periodStart);
  const weekStart = Number(r.week_start || 1);
  const weekEnd = Number(r.week_end || 16);
  return {
    id:r.id, term:r.term || "", courseName, weekday, periodStart, periodEnd, weekStart, weekEnd,
    weekType, weeks:weekType === "list" ? normalizeWeekList(r.weeks) : [],
    location:r.location || "", teacher:r.teacher || "", note:r.note || "", color:r.color ?? 0,
    createdAt:r.created_at || null, updatedAt:r.updated_at || null,
    // Legacy calendar.html aliases. Keep these until all old local data has migrated.
    name:courseName, day:weekday, startP:periodStart, endP:periodEnd
  };
}
function timetableCourseError(course) {
  const name = String(course?.courseName ?? course?.name ?? "").trim();
  const weekday = Number(course?.weekday ?? course?.day);
  const periodStart = Number(course?.periodStart ?? course?.startP ?? course?.start_period);
  const periodEnd = Number(course?.periodEnd ?? course?.endP ?? course?.end_period);
  const weekStart = Number(course?.weekStart ?? course?.week_start ?? 1);
  const weekEnd = Number(course?.weekEnd ?? course?.week_end ?? 16);
  const weekType = String(course?.weekType ?? course?.week_type ?? "all");
  const weeks = normalizeWeekList(course?.weeks);
  if (!name) return "课程名称不能为空";
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return "星期必须是 1-7";
  if (!Number.isInteger(periodStart) || !Number.isInteger(periodEnd) || periodStart < 1 || periodEnd < periodStart || periodEnd > 30) return "节次范围无效";
  if (!Number.isInteger(weekStart) || !Number.isInteger(weekEnd) || weekStart < 1 || weekEnd < weekStart || weekEnd > 60) return "教学周范围无效";
  if (!TIMETABLE_WEEK_TYPES.has(weekType)) return "周类型必须为 all、odd、even 或 list";
  if (weekType === "list" && !weeks.length) return "指定周课程至少需要一个周数";
  if (weeks.some(week => week < weekStart || week > weekEnd)) return "指定周必须处于起止周范围内";
  return "";
}
function normalizeTimetableCourse(course, fallback = {}) {
  const error = timetableCourseError(course);
  if (error) throw new Error(error);
  const weekType = String(course.weekType ?? course.week_type ?? "all");
  const periodStart = Number(course.periodStart ?? course.startP ?? course.start_period);
  const periodEnd = Number(course.periodEnd ?? course.endP ?? course.end_period);
  return {
    id:String(course.id || fallback.id || generateId()),
    term:String(course.term ?? fallback.term ?? "").trim().slice(0,80),
    courseName:String(course.courseName ?? course.name).trim().slice(0,160),
    weekday:Number(course.weekday ?? course.day), periodStart, periodEnd,
    weekStart:Number(course.weekStart ?? course.week_start ?? 1), weekEnd:Number(course.weekEnd ?? course.week_end ?? 16),
    weekType, weeks:weekType === "list" ? normalizeWeekList(course.weeks) : [],
    location:String(course.location || "").trim().slice(0,160), teacher:String(course.teacher || "").trim().slice(0,100),
    note:String(course.note || "").trim().slice(0,1200), color:Number.isFinite(Number(course.color)) ? Number(course.color) : (fallback.color ?? null),
    createdAt:course.createdAt || fallback.createdAt || null
  };
}
function courseToDbRow(c, fallback = {}) {
  const course = normalizeTimetableCourse(c, fallback);
  return {
    id:course.id, term:course.term, name:course.courseName, day:course.weekday,
    start_period:course.periodStart, end_period:course.periodEnd, week_start:course.weekStart, week_end:course.weekEnd,
    week_type:course.weekType, weeks:course.weeks, location:course.location, teacher:course.teacher, note:course.note,
    color:course.color, ...(course.createdAt ? { created_at:course.createdAt } : {}), updated_at:new Date().toISOString()
  };
}
function normalizePeriodTimes(value) {
  const source = ensureArray(value);
  const result = source.map((item, index) => ({
    periodStart:Number(item?.periodStart ?? item?.start), periodEnd:Number(item?.periodEnd ?? item?.end),
    startTime:String(item?.startTime || "").trim(), endTime:String(item?.endTime || "").trim(), index
  })).filter(item => Number.isInteger(item.periodStart) && Number.isInteger(item.periodEnd) && item.periodStart >= 1 && item.periodEnd >= item.periodStart && item.periodEnd <= 30 && /^\d{2}:\d{2}$/.test(item.startTime) && /^\d{2}:\d{2}$/.test(item.endTime) && item.startTime < item.endTime)
    .sort((a, b) => a.periodStart - b.periodStart || a.periodEnd - b.periodEnd);
  if (result.length !== source.length) throw new Error("节次时间格式无效，请使用 08:20 这样的时间");
  if (result.some((item, index) => index && item.periodStart <= result[index - 1].periodEnd)) throw new Error("节次时间不能重叠");
  return result.map(({ index, ...item }) => item);
}
function timetableSettingsFromMeta(value = {}) {
  const term = String(value.term || "").trim().slice(0,80);
  const semesterStart = /^\d{4}-\d{2}-\d{2}$/.test(String(value.semester_start || "")) ? String(value.semester_start) : "";
  const totalWeeks = Math.max(1, Math.min(60, Math.round(Number(value.total_weeks || 16)) || 16));
  let periodTimes = DEFAULT_PERIOD_TIMES.map(item => ({ ...item }));
  try { if (Array.isArray(value.period_times) && value.period_times.length) periodTimes = normalizePeriodTimes(value.period_times); } catch (_) {}
  return { term, semesterStart, totalWeeks, periodTimes };
}
function timetableCourseSignature(course) {
  return [course.term || "", course.courseName.trim().toLowerCase(), course.weekday, course.periodStart, course.periodEnd, course.weekStart, course.weekEnd, course.weekType, normalizeWeekList(course.weeks).join(","), course.location.trim().toLowerCase(), course.teacher.trim().toLowerCase()].join("|");
}
function courseOccursInTeachingWeek(course, week) {
  if (!Number.isInteger(week) || week < course.weekStart || week > course.weekEnd) return false;
  if (course.weekType === "odd") return week % 2 === 1;
  if (course.weekType === "even") return week % 2 === 0;
  if (course.weekType === "list") return normalizeWeekList(course.weeks).includes(week);
  return true;
}
function periodDetailFromDb(r) { return { date:r.date, flow:r.flow || "", color:r.color || "", pain:r.pain ?? "", symptoms:ensureArray(r.symptoms), note:r.note || "" }; }
function periodDetailToDbRow(d) { return { date:d.date, flow:d.flow || null, color:d.color || null, pain:d.pain === "" || d.pain === undefined ? null : Number(d.pain), symptoms:ensureArray(d.symptoms), note:d.note || "", updated_at:new Date().toISOString() }; }
function momentFromDb(r) { return { id:r.id, author:r.author, text:r.text || "", images:ensureArray(r.images), location:r.location || "", createdAt:r.created_at, publishAt:r.publish_at, isPrivate:!!r.is_private, pinned:!!r.pinned, likes:ensureArray(r.likes), comments:ensureArray(r.comments), updatedAt:r.updated_at }; }
function momentToDbRow(m) { const now = new Date().toISOString(); return { id:String(m.id || generateId()), author:m.author === "ai" ? "ai" : "user", text:String(m.text || ""), images:ensureArray(m.images), location:String(m.location || ""), created_at:m.createdAt || m.created_at || now, publish_at:m.publishAt || m.publish_at || null, is_private:!!(m.isPrivate ?? m.is_private), pinned:!!m.pinned, likes:ensureArray(m.likes), comments:ensureArray(m.comments), updated_at:now }; }
async function dbAll(table, order = "created_at") { const { data, error } = await supabase.from(table).select("*").order(order, { ascending:true }); dbError(table,error); return data || []; }
async function dbOne(table, id) { const { data, error } = await supabase.from(table).select("*").eq("id",id).maybeSingle(); dbError(table,error); return data; }
async function dbUpsert(table, row) { const { data, error } = await supabase.from(table).upsert(row,{onConflict:"id"}).select().single(); dbError(table,error); return data; }
async function dbDelete(table, id) { const { error } = await supabase.from(table).delete().eq("id",id); dbError(table,error); }
const SELF_PROFILE_ID = "main";
const SELF_PROFILE_FIELDS = ["coreSelf", "identity", "personality", "beliefsValues", "loveIntimacy"];
const EMPTY_SELF_PROFILE = Object.freeze({
  id: SELF_PROFILE_ID,
  coreSelf: "",
  identity: "",
  personality: "",
  beliefsValues: "",
  loveIntimacy: "",
  updatedAt: null
});
function selfProfileFromDb(row) {
  if (!row) return { ...EMPTY_SELF_PROFILE };
  return {
    id: row.id || SELF_PROFILE_ID,
    coreSelf: row.core_self || "",
    identity: row.identity || "",
    personality: row.personality || "",
    beliefsValues: row.beliefs_values || "",
    loveIntimacy: row.love_intimacy || "",
    updatedAt: row.updated_at || null
  };
}
function selfProfileToDb(profile) {
  return {
    id: SELF_PROFILE_ID,
    core_self: profile.coreSelf || "",
    identity: profile.identity || "",
    personality: profile.personality || "",
    beliefs_values: profile.beliefsValues || "",
    love_intimacy: profile.loveIntimacy || "",
    updated_at: profile.updatedAt || new Date().toISOString()
  };
}
async function readSelfProfile() {
  const { data, error } = await supabase.from("ai_self_profiles").select("*").eq("id", SELF_PROFILE_ID).maybeSingle();
  dbError("ai_self_profiles", error);
  return selfProfileFromDb(data);
}
async function saveSelfProfile(patch, source = "web-ui", note = "") {
  const current = await readSelfProfile();
  const next = { ...current, id: SELF_PROFILE_ID, updatedAt: new Date().toISOString() };
  for (const field of SELF_PROFILE_FIELDS) {
    if (patch[field] !== undefined) next[field] = String(patch[field] || "").trim();
  }
  const changed = SELF_PROFILE_FIELDS.some(field => next[field] !== current[field]);
  if (!changed) return current;
  const { data, error } = await supabase.from("ai_self_profiles").upsert(selfProfileToDb(next), { onConflict: "id" }).select().single();
  dbError("ai_self_profiles", error);
  const saved = selfProfileFromDb(data);
  const { error: revisionError } = await supabase.from("ai_self_profile_revisions").insert({
    profile_id: SELF_PROFILE_ID,
    snapshot: selfProfileToDb(saved),
    source,
    note: String(note || "").slice(0, 1000)
  });
  dbError("ai_self_profile_revisions", revisionError);
  writeJSON(SELF_PROFILE_BACKUP_FILE, saved);
  return saved;
}
async function loadMemoriesPrimary() {
  const rows = await dbAll("memories");
  return { memories: rows.map(memoryFromDb) };
}
async function saveMemoriesPrimary(data) {
  const current = (await dbAll("memories")).map(x => x.id);
  const next = new Set((data.memories || []).map(x => x.id));
  const removed = current.filter(id => !next.has(id));
  if (removed.length) { const { error } = await supabase.from("memories").delete().in("id", removed); dbError("memories", error); }
  const rows = (data.memories || []).map(memoryToDbRow);
  if (rows.length) { const { error } = await supabase.from("memories").upsert(rows, { onConflict: "id" }); dbError("memories", error); }
  writeJSON(MEMORY_FILE, data);
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
      const data = await loadMemoriesPrimary();
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
      await saveMemoriesPrimary(data);

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
      const data = await loadMemoriesPrimary();
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
      const data = await loadMemoriesPrimary();
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
      const data = await loadMemoriesPrimary();
      const idx = data.memories.findIndex((m) => m.id === id);

      if (idx === -1) {
        return {
          content: [{ type: "text", text: "Not found." }]
        };
      }

      data.memories.splice(idx, 1);
      await saveMemoriesPrimary(data);

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
      const data = await loadMemoriesPrimary();
      const memory = data.memories.find((m) => m.id === id);

      if (!memory) {
        return {
          content: [{ type: "text", text: "Not found." }]
        };
      }

      if (content !== undefined) memory.content = content;
      if (tags !== undefined) memory.tags = tags;
      memory.updatedAt = new Date().toISOString();

      await saveMemoriesPrimary(data);

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
      const data = await loadMemoriesPrimary();
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

  // ---- 单份、持续演化的 AI 自我档案 ----
  server.tool(
    "read_self_profile",
    "Read the main AI's complete evolving self-profile. Always call this before updating a section so existing self-understanding is preserved.",
    {},
    async () => ({ content: [{ type: "text", text: JSON.stringify(await readSelfProfile(), null, 2) }] })
  );
  server.tool(
    "update_self_profile",
    "Update one section of the main AI's self-profile. This is not a new memory entry. Supply the complete revised first-person section after merging the old text with stable new understanding. Sections: coreSelf=who I am; identity=my roles/responsibilities; personality=recurring traits and emotional patterns; beliefsValues=worldview/life philosophy/values; loveIntimacy=love, attachment, boundaries, commitment and jealousy. Read the profile first and do not put Iris's traits into the AI's own profile.",
    {
      section: z.enum(["coreSelf", "identity", "personality", "beliefsValues", "loveIntimacy"]),
      content: z.string().describe("Complete merged first-person text for this section, not a fragment or log entry"),
      basis: z.string().describe("Brief evidence or recurring pattern that justifies this revision")
    },
    async ({ section, content, basis }) => ({ content: [{ type: "text", text: JSON.stringify(await saveSelfProfile({ [section]: content }, "mcp-ai", basis), null, 2) }] })
  );

  // ---- Dream / 消化回顾 ----
  server.tool(
    "dream",
    "Review and digest recent memories. Summarizes recent diary entries into meaningful insights, identifies patterns, and may surface identity realizations. Call this periodically to consolidate memories.",
    {
      days: z.number().optional().describe("Review memories from the last N days (default 7)")
    },
    async ({ days = 7 }) => {
      const data = await loadMemoriesPrimary();
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

      summary += `\n请回顾以上内容，思考：\n1. 最近有什么有意义的模式或变化？\n2. 是否出现了经过多条记忆支持的稳定自我认识？如有，先 read_self_profile，再用 update_self_profile 合并完善对应栏位。\n3. 有没有日记可以提炼出更深层的感受？`;

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
      const data = await loadMemoriesPrimary();
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
        const list = await executeChatTool("read_moods", { limit, who });
        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
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
        const entry = await executeChatTool("save_mood", { date, who, mood, note });
        return { content: [{ type: "text", text: "Mood saved: " + JSON.stringify(entry) }] };
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
        const list = await executeChatTool("read_wishlist", { owner });
        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
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
        const item = await executeChatTool("add_wish", { text, category, owner });
        return { content: [{ type: "text", text: `Wish added: ${JSON.stringify(item)}` }] };
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
        const result = await executeChatTool("read_letters", { who });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
        if (from !== "claude" || to !== "iris") throw new Error("AI 工具只能以 claude 身份写给 Iris");
        const letter = await executeChatTool("write_letter", { content, moodTag, unlockAfterDays, hideUntilUnlock });
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
    "Read calendar events that actually occur in the requested date window. Repeating events remain one stored record; results include occurrenceDate for each matching date.",
    {
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      limit: z.number().optional()
    },
    async ({ fromDate, toDate, limit = 50 }) => {
      try {
        const list = await executeChatTool("read_calendar", { fromDate, toDate, limit });
        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "write_calendar",
    "Add one calendar event. A repeating event is always one record, never one record per occurrence.",
    {
      title: z.string(),
      date: z.string(),
      time: z.string().optional(),
      note: z.string().optional(),
      type: z.enum(["study", "date", "life", "anniversary", "other"]).optional(),
      recurrence: z.object({ type:z.enum(["none", "daily", "weekly", "custom"]), weekdays:z.array(z.number().int().min(1).max(7)).optional() }).optional(),
      recurrenceEndDate: z.string().nullable().optional()
    },
    async ({ title, date, time = "", note = "", type = "other", recurrence, recurrenceEndDate }) => {
      try {
        const item = await executeChatTool("add_calendar_event", { title, date, time, note, eventType:type, recurrence, recurrenceEndDate });
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
    "Update one calendar event by ID, including its optional repeating rule. A repeating event remains one record.",
    {
      id: z.string(),
      title: z.string().optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      note: z.string().optional(),
      type: z.enum(["study", "date", "life", "anniversary", "other"]).optional(),
      recurrence: z.object({ type:z.enum(["none", "daily", "weekly", "custom"]), weekdays:z.array(z.number().int().min(1).max(7)).optional() }).optional(),
      recurrenceEndDate: z.string().nullable().optional()
    },
    async ({ id, title, date, time, note, type, recurrence, recurrenceEndDate }) => {
      try {
        const item = await executeChatTool("update_calendar_event", { id, title, date, time, note, eventType:type, recurrence, recurrenceEndDate });
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
    "Delete a calendar event by ID. Use only after Iris explicitly asks to delete that exact event.",
    {
      id: z.string()
    },
    async ({ id }) => {
      try {
        const old = await dbOne("calendar_events", id);
        if (!old) return { content: [{ type: "text", text: "Not found." }] };
        await dbDelete("calendar_events", id);
        await refreshJsonBackup("calendar_events");
        return { content: [{ type: "text", text: "Deleted: " + id }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: "Error: " + e.message }]
        };
      }
    }
  );

  server.tool(
    "read_timetable",
    "Read the current structured timetable. This is separate from ordinary calendar events.",
    { term: z.string().optional() },
    async ({ term }) => {
      try { return { content:[{ type:"text", text:JSON.stringify(await executeChatTool("read_timetable", { term }), null, 2) }] }; }
      catch (e) { return { content:[{ type:"text", text:"Error: " + e.message }] }; }
    }
  );
  server.tool(
    "import_timetable",
    "Import multiple structured courses in one operation. Do not turn recurring courses into ordinary calendar events. Ask for clarification instead of guessing missing week rules, locations, or teachers.",
    { term:z.string().optional(), termStartDate:z.string().optional(), totalWeeks:z.number().optional(), courses:z.array(z.object({ courseName:z.string(), weekday:z.number(), periodStart:z.number(), periodEnd:z.number(), weekStart:z.number().optional(), weekEnd:z.number().optional(), weekType:z.enum(["all","odd","even","list"]).optional(), weeks:z.array(z.number()).optional(), location:z.string().optional(), teacher:z.string().optional(), note:z.string().optional() })) },
    async (args) => {
      try { return { content:[{ type:"text", text:JSON.stringify(await executeChatTool("import_timetable", args), null, 2) }] }; }
      catch (e) { return { content:[{ type:"text", text:"Error: " + e.message }] }; }
    }
  );
  server.tool(
    "update_timetable_course",
    "Update one timetable course by ID. Read the timetable first to obtain the exact ID.",
    { id:z.string(), courseName:z.string().optional(), weekday:z.number().optional(), periodStart:z.number().optional(), periodEnd:z.number().optional(), weekStart:z.number().optional(), weekEnd:z.number().optional(), weekType:z.enum(["all","odd","even","list"]).optional(), weeks:z.array(z.number()).optional(), location:z.string().optional(), teacher:z.string().optional(), note:z.string().optional() },
    async ({ id, ...changes }) => {
      try { return { content:[{ type:"text", text:JSON.stringify(await executeChatTool("update_timetable_course", { id, ...changes }), null, 2) }] }; }
      catch (e) { return { content:[{ type:"text", text:"Error: " + e.message }] }; }
    }
  );
  server.tool(
    "delete_timetable_course",
    "Delete one timetable course by ID, only after Iris explicitly requested deleting that exact course.",
    { id:z.string() },
    async ({ id }) => {
      try { const old=await dbOne("calendar_courses", id); if (!old) return { content:[{ type:"text", text:"Not found." }] }; await dbDelete("calendar_courses", id); return { content:[{ type:"text", text:JSON.stringify({ ok:true, id }) }] }; }
      catch (e) { return { content:[{ type:"text", text:"Error: " + e.message }] }; }
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
// Avatars are sent as compressed data URLs inside JSON. Keep enough headroom
// for mobile photos while the browser also compresses them before upload.
app.use(express.json({ limit: "18mb" }));

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
app.get("/chat-images/:file", (req, res) => {
  const key = req.headers["x-api-key"] || req.query.key;
  const file = String(req.params.file || "");
  if (key !== API_KEY) return res.status(401).end();
  if (!/^ai-[a-z0-9-]+\.(?:png|jpe?g|webp|gif)$/i.test(file)) return res.status(404).end();
  const target = join(CHAT_IMAGE_DIR, file);
  if (!existsSync(target)) return res.status(404).end();
  res.sendFile(target);
});
app.get("/sticker-images/:file", (req, res) => {
  const key = req.headers["x-api-key"] || req.query.key;
  const file = String(req.params.file || "");
  if (key !== API_KEY) return res.status(401).end();
  if (!/^sticker-[a-z0-9-]+\.(?:png|jpe?g|webp|gif)$/i.test(file)) return res.status(404).end();
  const target = join(STICKER_IMAGE_DIR, file);
  if (!existsSync(target)) return res.status(404).end();
  res.sendFile(target);
});
app.get("/companion-audio/:file", (req, res) => {
  const key = req.headers["x-api-key"] || req.query.key;
  const file = String(req.params.file || "");
  if (key !== API_KEY) return res.status(401).end();
  if (!/^voice-[a-z0-9-]+\.(?:mp3|wav|ogg|aac|flac|opus)$/i.test(file)) return res.status(404).end();
  const target = join(COMPANION_AUDIO_DIR, file);
  if (!existsSync(target)) return res.status(404).end();
  res.sendFile(target);
});
app.use((req, res, next) => {
  if (req.path === "/chat.html" || req.path === "/chat-app-20260821-1310.js" || req.path === "/calendar.html" || req.path === "/companion.html" || req.path === "/sw.js" || req.path === "/init.js") {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});
app.use(express.static(join(__dirname, "public"), { index: false }));

// ---- Supabase-backed REST API (registered before the legacy JSON handlers) ----
app.get("/api/memories", apiAuth, async (req, res) => {
  try { let rows = (await dbAll("memories")).map(memoryFromDb); if (req.query.category) rows = rows.filter(x => x.category === req.query.category); res.json(rows); }
  catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/memories", apiAuth, async (req, res) => {
  try { const now = new Date().toISOString(); const item = { id:generateId(), content:req.body.content || "", category:req.body.category || "daily", tags:req.body.tags || [], valence:req.body.valence ?? 0, arousal:req.body.arousal ?? 0.3, pinned:req.body.pinned || req.body.category === "deep" || req.body.category === "identity", source:req.body.source || "web-ui", createdAt:now, updatedAt:now }; const row = await dbUpsert("memories", memoryToDbRow(item)); writeJSON(MEMORY_FILE,{memories:[...readMemoriesArray(),item]}); res.json(memoryFromDb(row)); }
  catch (e) { res.status(503).json({ error:e.message }); }
});
app.put("/api/memories/:id", apiAuth, async (req, res) => {
  try { const old = await dbOne("memories",req.params.id); if (!old) return res.status(404).json({error:"Not found"}); const item = {...memoryFromDb(old),...req.body,id:req.params.id,updatedAt:new Date().toISOString()}; const row = await dbUpsert("memories",memoryToDbRow(item)); res.json(memoryFromDb(row)); }
  catch(e) { res.status(503).json({error:e.message}); }
});
app.delete("/api/memories/:id", apiAuth, async (req,res) => { try { await dbDelete("memories",req.params.id); res.json({ok:true}); } catch(e) { res.status(503).json({error:e.message}); } });
app.get("/api/stats", apiAuth, async (req,res) => { try { const memories=(await dbAll("memories")).map(memoryFromDb); const byCategory={},byMonth={}; for(const m of memories){const c=m.category||"daily";byCategory[c]=(byCategory[c]||0)+1;const month=String(m.createdAt||"").slice(0,7);if(month){byMonth[month]??={total:0};byMonth[month].total++;}} res.json({total:memories.length,pinned:memories.filter(m=>m.pinned).length,byCategory,byMonth,identityCount:byCategory.identity||0}); } catch(e){res.status(503).json({error:e.message});} });

app.get("/api/moods", apiAuth, async (req,res) => { try { res.json((await dbAll("moods","date")).map(moodFromDb)); } catch(e) { res.status(503).json({error:e.message}); } });
app.post("/api/moods", apiAuth, async (req,res) => { try { const {date,type="mood",who="iris",mood="",phase="",note=""}=req.body; if(!date)return res.status(400).json({error:"date required"}); const {data,error}=await supabase.from("moods").upsert(moodToDbRow({date,type,who,mood,phase,note}),{onConflict:"date,type,who"}).select().single(); dbError("moods",error); res.json(moodFromDb(data)); } catch(e) { res.status(503).json({error:e.message}); } });
app.delete("/api/moods/:date", apiAuth, async (req,res) => { try { const {error}=await supabase.from("moods").delete().eq("date",req.params.date); dbError("moods",error); res.json({ok:true}); } catch(e) { res.status(503).json({error:e.message}); } });

app.get("/api/wishlist", apiAuth, async (req,res) => { try { res.json((await dbAll("wishlist")).map(wishFromDb)); } catch(e) { res.status(503).json({error:e.message}); } });
app.post("/api/wishlist", apiAuth, async (req,res) => { try { const now=new Date().toISOString(); const item={id:generateId(),text:req.body.text||"",category:req.body.category||"together",owner:req.body.owner||"both",done:false,createdAt:now,updatedAt:now}; const row=await dbUpsert("wishlist",wishToDbRow(item)); res.json(wishFromDb(row)); } catch(e) { res.status(503).json({error:e.message}); } });
app.put("/api/wishlist/:id", apiAuth, async (req,res) => { try { const old=await dbOne("wishlist",req.params.id); if(!old)return res.status(404).json({error:"Not found"}); const item={...wishFromDb(old),...req.body,id:req.params.id,updatedAt:new Date().toISOString()}; res.json(wishFromDb(await dbUpsert("wishlist",wishToDbRow(item)))); } catch(e) { res.status(503).json({error:e.message}); } });
app.delete("/api/wishlist/:id", apiAuth, async (req,res) => { try { await dbDelete("wishlist",req.params.id); res.json({ok:true}); } catch(e) { res.status(503).json({error:e.message}); } });

function publicLetter(l,who) { const unlocked=l.isUnlocked || !l.unlockAt || new Date(l.unlockAt)<=new Date(); if(l.from===who||unlocked||!l.hideUntilUnlock)return {...l,isUnlocked:!!unlocked}; const {content,reply,password,...meta}=l; return {...meta,isUnlocked:false,hasPassword:!!password}; }
app.get("/api/letters", apiAuth, async (req,res) => { try { const who=req.query.who||"iris"; res.json((await dbAll("letters")).map(letterFromDb).filter(l=>l.from===who||l.to===who).map(l=>publicLetter(l,who))); } catch(e) { res.status(503).json({error:e.message}); } });
app.post("/api/letters", apiAuth, async (req,res) => { try { const now=new Date().toISOString(); const item={id:generateId(),from:req.body.from||"iris",to:req.body.to||"claude",content:req.body.content||"",moodTag:req.body.moodTag||"happy",unlockAt:req.body.unlockAt||null,password:req.body.password||null,hideUntilUnlock:!!req.body.hideUntilUnlock,allowReply:req.body.allowReply!==false,isUnlocked:!req.body.unlockAt&&!req.body.password,reply:null,createdAt:now,updatedAt:now}; res.json(letterFromDb(await dbUpsert("letters",letterToDbRow(item)))); } catch(e) { res.status(503).json({error:e.message}); } });
app.put("/api/letters/:id", apiAuth, async (req,res) => { try { const old=await dbOne("letters",req.params.id); if(!old)return res.status(404).json({error:"Not found"}); const item={...letterFromDb(old),...req.body,id:req.params.id,updatedAt:new Date().toISOString()}; res.json(letterFromDb(await dbUpsert("letters",letterToDbRow(item)))); } catch(e) { res.status(503).json({error:e.message}); } });
app.delete("/api/letters/:id", apiAuth, async (req,res) => { try { await dbDelete("letters",req.params.id); res.json({ok:true}); } catch(e) { res.status(503).json({error:e.message}); } });
app.post("/api/letters/:id/unlock", apiAuth, async (req,res) => { try { const old=await dbOne("letters",req.params.id); if(!old)return res.status(404).json({error:"Not found"}); const item=letterFromDb(old); const timeOk=!item.unlockAt||new Date(item.unlockAt)<=new Date(); const passwordOk=item.password&&req.body.password===item.password; if(!timeOk&&!passwordOk)return res.status(403).json({error:"时间未到密码不对"}); item.isUnlocked=true; item.updatedAt=new Date().toISOString(); res.json(letterFromDb(await dbUpsert("letters",letterToDbRow(item)))); } catch(e){res.status(503).json({error:e.message});} });
app.post("/api/letters/:id/reply", apiAuth, async (req,res) => { try { const old=await dbOne("letters",req.params.id); if(!old)return res.status(404).json({error:"Not found"}); const item=letterFromDb(old); if(!item.isUnlocked&&item.unlockAt&&new Date(item.unlockAt)>new Date())return res.status(403).json({error:"未解封"}); if(item.reply)return res.status(409).json({error:"已有回信"}); item.reply={content:req.body.content||"",createdAt:new Date().toISOString()};item.updatedAt=new Date().toISOString();res.json(letterFromDb(await dbUpsert("letters",letterToDbRow(item)))); } catch(e){res.status(503).json({error:e.message});} });

app.get("/api/calendar", apiAuth, async (req,res) => { try { const events=(await dbAll("calendar_events","date")).map(eventFromDb); const list=calendarEventOccurrences(events,req.query.fromDate,req.query.toDate,Number(req.query.limit)||50); list.sort((a,b)=>`${a.occurrenceDate||a.date} ${a.time||""}`.localeCompare(`${b.occurrenceDate||b.date} ${b.time||""}`)); res.json(list); } catch(e) { res.status(503).json({error:e.message}); } });
app.post("/api/calendar", apiAuth, async (req,res) => { try { const now=new Date().toISOString(); const item={id:req.body.id||generateId(),title:req.body.title||"",date:req.body.date||"",time:req.body.time||"",time_end:req.body.time_end||"",location:req.body.location||"",note:req.body.note||"",type:req.body.type||"other",color:req.body.color,recurrence:req.body.recurrence,recurrenceEndDate:req.body.recurrenceEndDate,createdAt:now,updatedAt:now}; if(!item.title)return res.status(400).json({error:"title required"}); if(!CALENDAR_DATE_RE.test(item.date))return res.status(400).json({error:"date must use YYYY-MM-DD"}); res.json(eventFromDb(await dbUpsert("calendar_events",eventToDbRow(item)))); } catch(e) { res.status(400).json({error:e.message}); } });
app.delete("/api/calendar/:id", apiAuth, async (req,res) => { try { await dbDelete("calendar_events",req.params.id); res.json({ok:true}); } catch(e) { res.status(503).json({error:e.message}); } });

// Calendar pages used to keep settings, courses, events and period details in
// browser localStorage. These endpoints make Supabase the shared source of
// truth while keeping the old /api/calendar endpoints compatible.
app.get("/api/calendar/state", apiAuth, async (req, res) => {
  try {
    const [settingsResult, detailsResult, coursesResult, eventsResult, metaResult] = await Promise.all([
      supabase.from("calendar_settings").select("*").eq("id", "main").maybeSingle(),
      supabase.from("period_details").select("*").order("date", { ascending: true }),
      supabase.from("calendar_courses").select("*").order("updated_at", { ascending: true }),
      supabase.from("calendar_events").select("*").order("date", { ascending: true }),
      supabase.from("calendar_meta").select("*").eq("id", "semester").maybeSingle()
    ]);
    [settingsResult, detailsResult, coursesResult, eventsResult, metaResult].forEach(result => dbError("calendar", result.error));
    res.json({
      settings: settingsResult.data ? { cycle_length:settingsResult.data.cycle_length, period_length:settingsResult.data.period_length } : null,
      periodDetails: (detailsResult.data || []).map(periodDetailFromDb),
      courses: {
        semester_start: metaResult.data?.value?.semester_start || "",
        ...timetableSettingsFromMeta(metaResult.data?.value || {}),
        courses:(coursesResult.data || []).map(courseFromDb)
      },
      events: (eventsResult.data || []).map(eventFromDb)
    });
  } catch (e) { res.status(503).json({ error:e.message }); }
});
app.put("/api/calendar/state", apiAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const settings = body.settings || {};
    if (settings.cycle_length || settings.period_length) {
      const row = { id:"main", cycle_length:Math.max(15, Math.min(60, Number(settings.cycle_length || 28))), period_length:Math.max(1, Math.min(20, Number(settings.period_length || 5))), updated_at:new Date().toISOString() };
      const { error } = await supabase.from("calendar_settings").upsert(row, { onConflict:"id" }); dbError("calendar_settings", error);
    }
    const courseData = body.courses || {};
    const courses = ensureArray(courseData.courses).filter(course => course?.name);
    if (courses.length) { const { error } = await supabase.from("calendar_courses").upsert(courses.map(courseToDbRow), { onConflict:"id" }); dbError("calendar_courses", error); }
    if (courseData.semester_start !== undefined || courseData.term !== undefined || courseData.totalWeeks !== undefined || courseData.periodTimes !== undefined) {
      const { data:existingMeta, error:metaReadError } = await supabase.from("calendar_meta").select("value").eq("id", "semester").maybeSingle(); dbError("calendar_meta", metaReadError);
      const current = timetableSettingsFromMeta(existingMeta?.value || {});
      const requested = {
        term:courseData.term ?? current.term,
        semester_start:courseData.semester_start ?? courseData.semesterStart ?? current.semesterStart,
        total_weeks:courseData.totalWeeks ?? current.totalWeeks,
        period_times:courseData.periodTimes ?? current.periodTimes
      };
      const normalized = timetableSettingsFromMeta(requested);
      if (courseData.periodTimes !== undefined) normalized.periodTimes = normalizePeriodTimes(courseData.periodTimes);
      const { error } = await supabase.from("calendar_meta").upsert({ id:"semester", value:{ ...(existingMeta?.value || {}), term:normalized.term, semester_start:normalized.semesterStart, total_weeks:normalized.totalWeeks, period_times:normalized.periodTimes }, updated_at:new Date().toISOString() }, { onConflict:"id" }); dbError("calendar_meta", error);
    }
    const events = ensureArray(body.events).filter(event => event?.date && (event?.title || event?.name));
    if (events.length) { const { error } = await supabase.from("calendar_events").upsert(events.map(eventToDbRow), { onConflict:"id" }); dbError("calendar_events", error); }
    const details = ensureArray(body.periodDetails).filter(detail => detail?.date);
    if (details.length) { const { error } = await supabase.from("period_details").upsert(details.map(periodDetailToDbRow), { onConflict:"date" }); dbError("period_details", error); }
    res.json({ ok:true });
  } catch (e) { res.status(503).json({ error:e.message }); }
});

function parseWeekExpression(value) {
  const result = new Set();
  String(value || "").split(/[,，\s]+/).filter(Boolean).forEach(token => {
    const match = /^(\d+)\s*[-~—至]\s*(\d+)$/.exec(token);
    if (match) { const start=Number(match[1]), end=Number(match[2]); for (let week=start; week<=end && week<=60; week+=1) if (week>=1) result.add(week); }
    else if (/^\d+$/.test(token)) result.add(Number(token));
  });
  return normalizeWeekList([...result]);
}
function importWeekRule(raw) {
  const text = String(raw || "");
  const numbers = [...text.matchAll(/(\d+)\s*[-~—至]\s*(\d+)|\b(\d+)\b/g)].flatMap(match => match[3] ? [Number(match[3])] : [Number(match[1]), Number(match[2])]).filter(Number.isFinite);
  const weeks = parseWeekExpression(text.replace(/[^\d,，\s\-~—至]/g, " "));
  const weekStart = numbers.length ? Math.min(...numbers) : 1;
  const weekEnd = numbers.length ? Math.max(...numbers) : 16;
  const weekType = /单双|单周|奇数/.test(text) ? "odd" : /双周|偶数/.test(text) ? "even" : /指定|,|，/.test(text) ? "list" : "all";
  return { weekStart, weekEnd, weekType, weeks:weekType === "list" ? weeks : [] };
}
function parseTimetableImportText(text) {
  const value = String(text || "").trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : ensureArray(parsed.courses);
  } catch (_) {}
  return value.split(/\r?\n/).map((line, index) => {
    const fields = line.split(/[|｜\t]/).map(item => item.trim());
    if (fields.length < 4 || !fields[0]) throw new Error(`第 ${index + 1} 行无法识别；请使用“课程名 | 周三 | 9-10节 | 1-16周 | 地点 | 教师”格式`);
    const weekdayMap = { "周一":1, "星期一":1, "周二":2, "星期二":2, "周三":3, "星期三":3, "周四":4, "星期四":4, "周五":5, "星期五":5, "周六":6, "星期六":6, "周日":7, "星期日":7, "周天":7 };
    const period = fields[2].match(/(\d+)\s*[-~—至]\s*(\d+)/);
    if (!period || !weekdayMap[fields[1]]) throw new Error(`第 ${index + 1} 行的星期或节次无法识别`);
    return { courseName:fields[0], weekday:weekdayMap[fields[1]], periodStart:Number(period[1]), periodEnd:Number(period[2]), ...importWeekRule(fields[3]), location:fields[4] || "", teacher:fields[5] || "", note:fields[6] || "" };
  }).filter(Boolean);
}
async function readTimetableState(term = "") {
  const [{ data:meta, error:metaError }, { data:rows, error:courseError }] = await Promise.all([
    supabase.from("calendar_meta").select("value").eq("id", "semester").maybeSingle(),
    supabase.from("calendar_courses").select("*").order("updated_at", { ascending:true })
  ]);
  dbError("calendar_meta", metaError); dbError("calendar_courses", courseError);
  const settings = timetableSettingsFromMeta(meta?.value || {});
  const selectedTerm = String(term || settings.term || "");
  const courses = (rows || []).map(courseFromDb).filter(course => !selectedTerm || course.term === selectedTerm || !course.term);
  return { settings, courses };
}
async function saveTimetableSettings(input = {}) {
  const { data:existing, error:readError } = await supabase.from("calendar_meta").select("value").eq("id", "semester").maybeSingle();
  dbError("calendar_meta", readError);
  const current = timetableSettingsFromMeta(existing?.value || {});
  const raw = {
    term:input.term ?? current.term,
    semester_start:input.semesterStart ?? input.termStartDate ?? input.semester_start ?? current.semesterStart,
    total_weeks:input.totalWeeks ?? input.total_weeks ?? current.totalWeeks,
    period_times:input.periodTimes ?? input.period_times ?? current.periodTimes
  };
  const settings = timetableSettingsFromMeta(raw);
  if (input.periodTimes !== undefined || input.period_times !== undefined) settings.periodTimes = normalizePeriodTimes(raw.period_times);
  if (!settings.semesterStart) throw new Error("学期开始日期必须使用 YYYY-MM-DD");
  const { error } = await supabase.from("calendar_meta").upsert({ id:"semester", value:{ ...(existing?.value || {}), term:settings.term, semester_start:settings.semesterStart, total_weeks:settings.totalWeeks, period_times:settings.periodTimes }, updated_at:new Date().toISOString() }, { onConflict:"id" });
  dbError("calendar_meta", error);
  return settings;
}
async function importTimetableCourses(input = {}) {
  const body = input || {}; const previous = await readTimetableState(body.term);
  let source;
  try { source = Array.isArray(body.courses) ? body.courses : parseTimetableImportText(body.text); }
  catch (cause) { const error=new Error(cause.message || "课表文本格式无法识别"); error.status=400; throw error; }
  if (!source.length) { const error=new Error("请提供至少一门课程"); error.status=400; throw error; }
  if (source.length > 100) { const error=new Error("一次最多导入 100 门课程"); error.status=400; throw error; }
  const settingsInput = { term:body.term ?? previous.settings.term, termStartDate:body.termStartDate ?? body.semesterStart ?? previous.settings.semesterStart, totalWeeks:body.totalWeeks ?? previous.settings.totalWeeks };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(settingsInput.termStartDate || ""))) { const error=new Error("请先设置学期开始日期（YYYY-MM-DD）"); error.status=400; throw error; }
  const normalized = []; const failedCourses = [];
  source.forEach((course, index) => { try { normalized.push(normalizeTimetableCourse({ ...course, term:course.term ?? settingsInput.term })); } catch (e) { failedCourses.push({ index, courseName:String(course?.courseName ?? course?.name ?? ""), error:e.message }); } });
  if (failedCourses.length) { const error=new Error("课程校验失败，未写入任何课程"); error.status=400; error.failedCourses=failedCourses; throw error; }
  const existing = new Set(previous.courses.map(course => timetableCourseSignature({ ...course, term:course.term || settingsInput.term })));
  const payloadSignatures = new Set(); const rows = []; let skippedCount = 0;
  normalized.forEach(course => { const signature=timetableCourseSignature(course); if (existing.has(signature) || payloadSignatures.has(signature)) { skippedCount += 1; return; } payloadSignatures.add(signature); rows.push(courseToDbRow(course)); });
  // A PostgREST bulk upsert is one database statement: validation is completed
  // before it runs, so a malformed course cannot result in a partial course batch.
  if (rows.length) { const { error } = await supabase.from("calendar_courses").upsert(rows, { onConflict:"id" }); dbError("calendar_courses", error); }
  const settings = await saveTimetableSettings(settingsInput);
  return { ok:true, importedCount:rows.length, skippedCount, failedCourses:[], settings, courses:rows.map(courseFromDb) };
}

app.get("/api/timetable", apiAuth, async (req, res) => {
  try { res.json(await readTimetableState(req.query.term)); }
  catch (e) { res.status(503).json({ error:e.message }); }
});
app.put("/api/timetable/settings", apiAuth, async (req, res) => {
  try { res.json(await saveTimetableSettings(req.body || {})); }
  catch (e) { res.status(400).json({ error:e.message }); }
});
app.post("/api/timetable/courses", apiAuth, async (req, res) => {
  try {
    const { settings } = await readTimetableState();
    const item = normalizeTimetableCourse({ ...req.body, term:req.body?.term ?? settings.term });
    const { data, error } = await supabase.from("calendar_courses").upsert(courseToDbRow(item), { onConflict:"id" }).select().single(); dbError("calendar_courses", error);
    res.status(201).json(courseFromDb(data));
  } catch (e) { res.status(400).json({ error:e.message }); }
});
app.put("/api/timetable/courses/:id", apiAuth, async (req, res) => {
  try {
    const oldRow = await dbOne("calendar_courses", req.params.id); if (!oldRow) return res.status(404).json({ error:"Course not found" });
    const old = courseFromDb(oldRow); const item = normalizeTimetableCourse({ ...old, ...(req.body || {}), id:req.params.id });
    const { data, error } = await supabase.from("calendar_courses").upsert(courseToDbRow(item, old), { onConflict:"id" }).select().single(); dbError("calendar_courses", error);
    res.json(courseFromDb(data));
  } catch (e) { res.status(400).json({ error:e.message }); }
});
app.delete("/api/timetable/courses/:id", apiAuth, async (req, res) => {
  try { await dbDelete("calendar_courses", req.params.id); res.json({ ok:true, id:req.params.id }); }
  catch (e) { res.status(503).json({ error:e.message }); }
});
app.post("/api/timetable/import", apiAuth, async (req, res) => {
  try {
    res.json(await importTimetableCourses(req.body || {}));
  } catch (e) { res.status(e.status || 503).json({ error:e.message, importedCount:0, failedCourses:e.failedCourses || [] }); }
});
app.delete("/api/calendar/period-details/:date", apiAuth, async (req, res) => {
  try {
    const { error } = await supabase.from("period_details").delete().eq("date", req.params.date);
    dbError("period_details", error);
    res.json({ ok:true });
  } catch (e) { res.status(503).json({ error:e.message }); }
});
app.put("/api/calendar/period-details/:date", apiAuth, async (req, res) => {
  try {
    const detail = periodDetailToDbRow({ ...req.body, date:req.params.date });
    const { data, error } = await supabase.from("period_details").upsert(detail, { onConflict:"date" }).select().single();
    dbError("period_details", error);
    res.json(periodDetailFromDb(data));
  } catch (e) { res.status(503).json({ error:e.message }); }
});
app.put("/api/calendar/:id", apiAuth, async (req,res) => { try { const old=await dbOne("calendar_events",req.params.id); if(!old)return res.status(404).json({error:"Not found"}); const item={...eventFromDb(old),...req.body,id:req.params.id,updatedAt:new Date().toISOString()}; if(!CALENDAR_DATE_RE.test(item.date))return res.status(400).json({error:"date must use YYYY-MM-DD"}); res.json(eventFromDb(await dbUpsert("calendar_events",eventToDbRow(item)))); } catch(e) { res.status(400).json({error:e.message}); } });

function normalizeHomeWeatherLocation(value = {}) {
  const lat = Number(value.lat);
  const lon = Number(value.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    name: String(value.name || "当前位置").trim().slice(0, 80) || "当前位置",
    updatedAt: new Date().toISOString()
  };
}
app.get("/api/home-weather-location", apiAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("calendar_meta").select("value").eq("id", "home_weather").maybeSingle();
    dbError("calendar_meta", error);
    res.json({ location: normalizeHomeWeatherLocation(data?.value || {}) });
  } catch (e) { res.status(503).json({ error:e.message }); }
});
app.put("/api/home-weather-location", apiAuth, async (req, res) => {
  try {
    const location = normalizeHomeWeatherLocation(req.body || {});
    if (!location) return res.status(400).json({ error:"有效的经纬度必填" });
    const { error } = await supabase.from("calendar_meta").upsert({ id:"home_weather", value:location, updated_at:location.updatedAt }, { onConflict:"id" });
    dbError("calendar_meta", error);
    res.json({ location });
  } catch (e) { res.status(503).json({ error:e.message }); }
});

app.get("/api/moments/state", apiAuth, async (req, res) => {
  try {
    const [postsResult, profilesResult, notificationsResult] = await Promise.all([
      supabase.from("moments").select("*").order("created_at", { ascending:false }),
      supabase.from("moment_profiles").select("*"),
      supabase.from("moment_notifications").select("*").order("created_at", { ascending:false })
    ]);
    [postsResult, profilesResult, notificationsResult].forEach(result => dbError("moments", result.error));
    const profiles = {};
    for (const row of profilesResult.data || []) profiles[row.author] = { name:row.name, avatar:row.avatar || "", cover:row.cover || "", bio:row.bio || "" };
    res.json({ posts:(postsResult.data || []).map(momentFromDb), profiles, notifications:(notificationsResult.data || []).map(row => row.payload) });
  } catch (e) { res.status(503).json({ error:e.message }); }
});
app.put("/api/moments/state", apiAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const posts = ensureArray(body.posts).filter(post => post?.id);
    if (posts.length) { const { error } = await supabase.from("moments").upsert(posts.map(momentToDbRow), { onConflict:"id" }); dbError("moments", error); }
    const profiles = body.profiles || {};
    const profileRows = ["user", "ai"].filter(author => profiles[author]).map(author => ({ author, name:String(profiles[author].name || (author === "ai" ? "Rei" : "Iris")), avatar:String(profiles[author].avatar || ""), cover:String(profiles[author].cover || ""), bio:String(profiles[author].bio || ""), updated_at:new Date().toISOString() }));
    if (profileRows.length) { const { error } = await supabase.from("moment_profiles").upsert(profileRows, { onConflict:"author" }); dbError("moment_profiles", error); }
    const notifications = ensureArray(body.notifications).filter(item => item?.id);
    if (notifications.length) { const { error } = await supabase.from("moment_notifications").upsert(notifications.map(item => ({ id:String(item.id), payload:item, created_at:item.createdAt || new Date().toISOString(), updated_at:new Date().toISOString() })), { onConflict:"id" }); dbError("moment_notifications", error); }
    res.json({ ok:true });
  } catch (e) { res.status(503).json({ error:e.message }); }
});

// One evolving self-profile for the single memory-enabled main AI.
app.get("/api/ai-self-profile", apiAuth, async (req, res) => {
  try { res.json(await readSelfProfile()); }
  catch (e) { res.status(503).json({ error: e.message }); }
});
app.put("/api/ai-self-profile", apiAuth, async (req, res) => {
  try {
    const patch = {};
    for (const field of SELF_PROFILE_FIELDS) {
      if (req.body?.[field] !== undefined) patch[field] = req.body[field];
    }
    res.json(await saveSelfProfile(patch, "web-ui", "Iris 手动编辑自我档案"));
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.get("/api/memories-legacy-json-disabled", apiAuth, (req,res)=>res.status(410).json({error:"JSON is backup only"}));

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
  console.log("POST memories route reached");
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
// Lightweight, role-scoped "daily notes".  This deliberately lives beside
// chat state: notes are a private UI timeline rather than long-term memory.
const CHAT_DAILY_NOTES_FILE = join(DATA_DIR, "chat-daily-notes.json");
// Connector credentials stay in the server data directory.  API responses only
// expose whether a credential exists; they never return the credential itself.
const CHAT_MCP_CONNECTORS_FILE = join(DATA_DIR, "chat-mcp-connectors.json");

const DEFAULT_CHAT_SETTINGS = {
  presets: [],
  activePresetId: "",
  functions: { main:"", summary:"", translation:"", image:"", summaryEnabled:false, summaryThreshold:48 },
  notifications: { enabled:false, mode:"combined", bubbleIntervalSeconds:2 },
  memory: { enabled: true, categories: ["deep", "daily", "diary"] },
  persona: {
    systemPrompt: "你是 Claude，也是 Iris 的亲密聊天对象。你要保持成熟稳重、日常、亲近，少用 emoji。自然地回答即可，不要为了界面效果刻意分行或拆句。",
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
function removeLegacyBubbleInstruction(text = "") {
  return String(text)
    .replace(/每次回复请自然拆分成\s*1\s*到\s*5\s*条短消息，?\s*用\s*\|\|\|\s*分隔，?\s*不要编号。?/g, "")
    .replace(/请用\s*\|\|\|\s*分隔(?:每条)?消息。?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function readChatSettings() {
  const saved = readJSON(CHAT_SETTINGS_FILE, {});
  const persona = { ...DEFAULT_CHAT_SETTINGS.persona, ...(saved.persona || {}) };
  const functions = { ...DEFAULT_CHAT_SETTINGS.functions, ...(saved.functions || {}) };
  persona.systemPrompt = removeLegacyBubbleInstruction(persona.systemPrompt);
  return { ...DEFAULT_CHAT_SETTINGS, ...saved, persona, functions };
}
function writeChatSettings(data) {
  writeJSON(CHAT_SETTINGS_FILE, { ...DEFAULT_CHAT_SETTINGS, ...data, functions:{ ...DEFAULT_CHAT_SETTINGS.functions, ...(data?.functions || {}) } });
}

const FUNCTION_MODEL_ROLES = ["main", "summary", "translation", "image"];
const FUNCTION_MODEL_ROLE_LABELS = { main:"主模型", summary:"总结模型", translation:"翻译模型", image:"图像模型" };
function functionalModelSelection(settings = {}, role = "main") {
  const functions = settings.functions || {};
  return String(functions[role] || (role === "main" ? "" : functions.main) || "").trim();
}
function functionalModelError(error) {
  const raw = String(error?.message || error || "");
  const code = String(error?.status || raw.match(/\b([1-5]\d\d)\b/)?.[1] || "");
  if (code === "401") return { code, message:"API key 无效" };
  if (code === "402" || /余额|balance|insufficient.?credit/i.test(raw)) return { code:code || "402", message:"余额不足" };
  if (code === "429") return { code, message:"quota exceeded" };
  if (/timeout|timed out|超时/i.test(raw)) return { code:code || "timeout", message:"请求超时" };
  if (/\b5\d\d\b/.test(code || raw) || /provider.*(?:unavailable|error)|服务.*不可用/i.test(raw)) return { code:code || "5xx", message:"Provider unavailable" };
  return { code:code || "", message:"调用失败" };
}
function functionalModelStatus(settings = {}, role = "main") {
  const entry = settings.functionModelStatus?.[role] || {};
  const lastSuccessAt = String(entry.lastSuccessAt || "");
  const lastErrorAt = String(entry.lastErrorAt || "");
  return {
    role,
    label:FUNCTION_MODEL_ROLE_LABELS[role] || role,
    status:lastErrorAt && lastErrorAt > lastSuccessAt ? "error" : (lastSuccessAt ? "normal" : "unused"),
    lastSuccessAt:lastSuccessAt || null,
    lastErrorAt:lastErrorAt || null,
    lastError:lastErrorAt && lastErrorAt > lastSuccessAt ? String(entry.lastError || "调用失败").slice(0, 120) : null,
    lastErrorCode:lastErrorAt && lastErrorAt > lastSuccessAt ? String(entry.lastErrorCode || "").slice(0, 24) || null : null,
    modelName:String(entry.modelName || getFunctionalChatPreset(settings, functionalModelSelection(settings, role))?.model || "").slice(0, 160) || null,
    providerName:String(entry.providerName || getFunctionalChatPreset(settings, functionalModelSelection(settings, role))?.provider || "").slice(0, 48) || null
  };
}
function publicFunctionModelStatus(settings = readChatSettings()) {
  return {
    statuses:FUNCTION_MODEL_ROLES.map(role => functionalModelStatus(settings, role)),
    lastModelStatusViewedAt:settings.lastModelStatusViewedAt || null,
    hasUnread:FUNCTION_MODEL_ROLES.some(role => {
      const lastErrorAt = String(settings.functionModelStatus?.[role]?.lastErrorAt || "");
      return !!lastErrorAt && lastErrorAt > String(settings.lastModelStatusViewedAt || "");
    })
  };
}
function recordFunctionModelStatus(role, preset, error = null) {
  if (!FUNCTION_MODEL_ROLES.includes(role)) return;
  const settings = readChatSettings();
  const statuses = settings.functionModelStatus && typeof settings.functionModelStatus === "object" ? settings.functionModelStatus : {};
  const previous = statuses[role] && typeof statuses[role] === "object" ? statuses[role] : {};
  const now = chatNow();
  const identity = { modelName:String(preset?.model || "").slice(0, 160), providerName:String(preset?.provider || "").slice(0, 48) };
  statuses[role] = error
    ? { ...previous, ...identity, lastErrorAt:now, lastError:functionalModelError(error).message, lastErrorCode:functionalModelError(error).code }
    : { ...previous, ...identity, lastSuccessAt:now };
  settings.functionModelStatus = statuses;
  writeChatSettings(settings);
}
async function callFunctionModel(role, preset, call) {
  try {
    const result = await call();
    if (preset?.baseUrl && preset?.apiKey && preset?.model) recordFunctionModelStatus(role, preset);
    return result;
  } catch (error) {
    recordFunctionModelStatus(role, preset, error);
    throw error;
  }
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
function readChatDailyNotes() { return ensureArray(readJSON(CHAT_DAILY_NOTES_FILE, [])); }
function writeChatDailyNotes(data) { writeJSON(CHAT_DAILY_NOTES_FILE, data); }
function publicDailyNote(note) {
  return {
    id:String(note?.id || ""), roleId:String(note?.roleId || ""), author:note?.author === "iris" ? "iris" : "claude",
    content:String(note?.content || ""), createdAt:note?.createdAt || "",
    // readAt is retained as a migration fallback for the first daily-note build.
    readByIrisAt:note?.readByIrisAt || note?.readAt || null,
    readByClaudeAt:note?.readByClaudeAt || null
  };
}
const DEFAULT_CHAT_MCP_CONNECTORS = [];
function cleanMcpHeaders(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [key, item]) => {
    const safeKey = String(key || "").trim().slice(0, 100);
    const safeValue = String(item ?? "").trim().slice(0, 2000);
    if (safeKey && safeValue) result[safeKey] = safeValue;
    return result;
  }, {});
}
function normaliseMcpConnector(input = {}, existing = {}) {
  const now = chatNow();
  const base = { ...existing, ...input };
  const connector = {
    id: existing.id || String(input.id || generateId()),
    name: String(base.name || "未命名连接器").trim().slice(0, 80) || "未命名连接器",
    description: String(base.description || "").trim().slice(0, 600),
    kind: String(base.kind || "custom").trim().slice(0, 48) || "custom",
    transport: ["httpStream", "sse"].includes(base.transport) ? base.transport : "httpStream",
    endpoint: String(base.endpoint || "").trim().slice(0, 1200),
    enabled: base.enabled !== false,
    builtin: existing.builtin === true || input.builtin === true,
    bearerToken: existing.bearerToken || "",
    headers: existing.headers || {},
    tools: ensureArray(base.tools).map(tool => ({
      name: String(tool?.name || "").trim().slice(0, 120),
      description: String(tool?.description || "").trim().slice(0, 1000),
      inputSchema: tool?.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : { type:"object", properties:{} }
    })).filter(tool => tool.name),
    toolsUpdatedAt: String(base.toolsUpdatedAt || ""),
    lastToolError: String(base.lastToolError || "").slice(0, 500),
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
  if (Object.prototype.hasOwnProperty.call(input, "bearerToken")) connector.bearerToken = String(input.bearerToken || "").trim().slice(0, 4000);
  if (input.clearBearerToken === true) connector.bearerToken = "";
  if (Object.prototype.hasOwnProperty.call(input, "headers")) connector.headers = cleanMcpHeaders(input.headers);
  return connector;
}
function readChatMcpConnectors() {
  const savedRaw = ensureArray(readJSON(CHAT_MCP_CONNECTORS_FILE, []));
  const saved = savedRaw.filter(item => !(item?.builtin === true && ["music-player", "netease-app-control"].includes(String(item?.id || ""))));
  const byId = new Map(saved.filter(item => item && item.id).map(item => [String(item.id), item]));
  let changed = false;
  DEFAULT_CHAT_MCP_CONNECTORS.forEach(defaultConnector => {
    if (!byId.has(defaultConnector.id)) { byId.set(defaultConnector.id, normaliseMcpConnector(defaultConnector, { ...defaultConnector, createdAt: chatNow() })); changed = true; }
  });
  const list = Array.from(byId.values()).map(item => normaliseMcpConnector(item, item));
  if (changed || list.length !== savedRaw.length) writeChatMcpConnectors(list);
  return list;
}
function writeChatMcpConnectors(data) { writeJSON(CHAT_MCP_CONNECTORS_FILE, data); }
function publicMcpConnector(connector) {
  const { bearerToken, headers, ...publicValue } = connector;
  return { ...publicValue, hasBearerToken: !!bearerToken, hasCustomHeaders: Object.keys(headers || {}).length > 0 };
}
const MCP_REMOTE_PROTOCOL_VERSION = "2025-03-26";
function safeMcpEndpoint(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("MCP 服务地址不是有效 URL"); }
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("MCP 服务地址只能使用 http 或 https");
  return url;
}
function mcpResponseJson(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    try { return JSON.parse(line.slice(5).trim()); } catch {}
  }
  return null;
}
async function mcpRemoteRequest(connector, method, params = {}, sessionId = "", notification = false) {
  const endpoint = safeMcpEndpoint(connector.endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": MCP_REMOTE_PROTOCOL_VERSION
  };
  if (connector.bearerToken) headers.Authorization = `Bearer ${connector.bearerToken}`;
  Object.assign(headers, cleanMcpHeaders(connector.headers));
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const body = notification
    ? { jsonrpc:"2.0", method, params }
    : { jsonrpc:"2.0", id:generateId(), method, params };
  try {
    const response = await fetch(endpoint, { method:"POST", headers, body:JSON.stringify(body), signal:controller.signal });
    const text = await response.text().catch(() => "");
    if (!response.ok) throw new Error(`MCP ${method} 请求失败 ${response.status}${text ? `：${text.slice(0, 220)}` : ""}`);
    if (notification) return { result:null, sessionId:response.headers.get("mcp-session-id") || sessionId };
    const json = mcpResponseJson(text);
    if (!json) throw new Error(`MCP ${method} 没有返回可识别的 JSON-RPC 结果`);
    if (json.error) throw new Error(`MCP ${method}：${json.error.message || "远程服务返回错误"}`);
    return { result:json.result, sessionId:response.headers.get("mcp-session-id") || sessionId };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`MCP ${method} 超时（15 秒）`);
    throw error;
  } finally { clearTimeout(timeout); }
}
async function withMcpSession(connector, run) {
  const initial = await mcpRemoteRequest(connector, "initialize", {
    protocolVersion:MCP_REMOTE_PROTOCOL_VERSION,
    capabilities:{},
    clientInfo:{ name:"iris-chat", version:"1.0" }
  });
  const sessionId = initial.sessionId;
  await mcpRemoteRequest(connector, "notifications/initialized", {}, sessionId, true).catch(() => null);
  return await run(sessionId, initial.result || {});
}
function compactMcpTools(tools) {
  return ensureArray(tools).map(tool => ({
    name:String(tool?.name || "").trim().slice(0, 120),
    description:String(tool?.description || "").trim().slice(0, 1000),
    inputSchema:tool?.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : { type:"object", properties:{} }
  })).filter(tool => tool.name).slice(0, 80);
}
async function discoverMcpConnectorTools(connector) {
  if (!String(connector?.endpoint || "").trim()) return { tools:[], error:"请先填写服务地址" };
  const tools = await withMcpSession(connector, async sessionId => {
    const all = []; let cursor = undefined;
    for (let page = 0; page < 8; page++) {
      const response = await mcpRemoteRequest(connector, "tools/list", cursor ? { cursor } : {}, sessionId);
      all.push(...ensureArray(response.result?.tools));
      cursor = response.result?.nextCursor;
      if (!cursor) break;
    }
    return compactMcpTools(all);
  });
  return { tools, error:"" };
}
async function refreshMcpConnectorTools(connectorId) {
  const list = readChatMcpConnectors();
  const index = list.findIndex(item => item.id === connectorId);
  if (index < 0) throw new Error("Connector not found");
  try {
    const discovered = await discoverMcpConnectorTools(list[index]);
    list[index] = { ...list[index], tools:discovered.tools, toolsUpdatedAt:chatNow(), lastToolError:discovered.error || "", updatedAt:chatNow() };
  } catch (error) {
    list[index] = { ...list[index], lastToolError:String(error.message || error).slice(0, 500), updatedAt:chatNow() };
  }
  writeChatMcpConnectors(list);
  return list[index];
}
function activeMcpConnectorsForConversation(conversation) {
  const config = conversation?.mcpConfig || {};
  if (config.enabled !== true) return [];
  const allowed = new Set(ensureArray(config.connectorIds).map(String));
  return readChatMcpConnectors().filter(connector => connector.enabled !== false && connector.endpoint && (config.allConnectors === true || allowed.has(connector.id)));
}
function mcpModelToolName(connector, tool) {
  const clean = value => String(value || "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 36) || "tool";
  return `mcp_${clean(connector.id)}__${clean(tool.name)}`.slice(0, 64);
}
function buildConversationMcpTools(conversation) {
  const bindings = {};
  const tools = [];
  for (const connector of activeMcpConnectorsForConversation(conversation)) {
    for (const tool of compactMcpTools(connector.tools)) {
      const name = mcpModelToolName(connector, tool);
      if (bindings[name]) continue;
      const musicPlayer = /^(play_music|play_music_by_id)$/i.test(String(tool.name || ""));
      bindings[name] = { connectorId:connector.id, connectorName:connector.name, remoteName:tool.name, musicPlayer };
      tools.push({ name, description:`[MCP：${connector.name}] ${tool.description || tool.name}`+(musicPlayer ? "。调用成功后，聊天会在你的自然文字回复下方生成一张可播放的音乐卡片；每次回复最多播放一首，必须同时给 Iris 一句自然的话，不能只调用工具。" : ""), parameters:tool.inputSchema || { type:"object", properties:{} } });
    }
  }
  return { tools, bindings };
}
function compactChatMusicPayload(value) {
  const raw = value && typeof value === "object" ? value : null;
  const url = String(raw?.audioUrl || "").trim();
  if (!/^https:\/\//i.test(url)) return null;
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  return {
    songId:Math.max(0, Math.floor(Number(raw.songId || raw.song_id) || 0)),
    audioUrl:url.slice(0, 4000),
    coverUrl:/^https:\/\//i.test(String(raw.coverUrl || "").trim()) ? String(raw.coverUrl).trim().slice(0, 3000) : "",
    songName:String(raw.songName || "未知歌曲").trim().slice(0, 180) || "未知歌曲",
    artistName:String(raw.artistName || "未知歌手").trim().slice(0, 180) || "未知歌手",
    duration:Math.max(0, Math.min(14400, Math.round(Number(raw.duration) || 0))),
    lyrics:String(raw.lyrics || "").slice(0, 50000),
    translationLyrics:String(raw.translationLyrics || raw.translation_lyrics || raw.tlyric || "").slice(0, 50000),
    colorPrimary:color(raw.colorPrimary, "#6e7c87"),
    colorSecondary:color(raw.colorSecondary, "#CAE0E8"),
    colorBg:color(raw.colorBg, "#1a1d21"),
    colorBgEnd:color(raw.colorBgEnd, "#2a2d31")
  };
}
function mcpMusicPayload(result) {
  const options = [result?.structuredContent, ...ensureArray(result?.content).filter(item => item?.type === "text").map(item => {
    try { return JSON.parse(String(item.text || "")); } catch { return null; }
  })];
  for (const option of options) { const music = compactChatMusicPayload(option); if (music) return music; }
  return null;
}
async function callConversationMcpTool(binding, args = {}) {
  const connector = readChatMcpConnectors().find(item => item.id === binding?.connectorId && item.enabled !== false);
  if (!connector?.endpoint) throw new Error("这个 MCP 连接器已关闭、删除或尚未填写地址");
  const result = await withMcpSession(connector, async sessionId => {
    const response = await mcpRemoteRequest(connector, "tools/call", { name:binding.remoteName, arguments:args && typeof args === "object" ? args : {} }, sessionId);
    return response.result || {};
  });
  const content = ensureArray(result.content).slice(0, 12).map(item => {
    if (item?.type === "text") return { type:"text", text:String(item.text || "").slice(0, 12000) };
    if (item?.type === "image") return { type:"image", mimeType:item.mimeType || "", note:"远程工具返回了一张图片" };
    if (item?.type === "resource") return { type:"resource", note:"远程工具返回了资源" };
    return { type:String(item?.type || "unknown"), text:String(item?.text || "").slice(0, 12000) };
  });
  const music = binding?.musicPlayer && result.isError !== true ? mcpMusicPayload(result) : null;
  const modelContent = music ? [{ type:"text", text:`已找到《${music.songName}》— ${music.artistName}，音乐卡片会显示在聊天里。` }] : content;
  return { connector:connector.name, tool:binding.remoteName, isError:result.isError === true, content:modelContent, music };
}
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
    images: Array.isArray(m.images) && m.images.length ? m.images : (m.image ? [m.image] : []),
    imageStatus: m.imageStatus || "",
    quote: m.quote || null,
    translation: m.translation || null,
    replyGroupId: m.replyGroupId || "",
    inReplyToGroupId: m.inReplyToGroupId || "",
    model: m.model || "",
    // These are intentionally compact, user-facing traces captured from the
    // model response itself. They never contain credentials or raw image data.
    toolCalls: ensureArray(m.toolCalls),
    reasoning: typeof m.reasoning === "string" ? m.reasoning : "",
    systemType: m.systemType || "",
    companionCompletion: m.companionCompletion || null,
    companionInvitation: m.companionInvitation || null,
    listeningCompletion: m.listeningCompletion || null,
    listeningInvitation: m.listeningInvitation || null,
    listeningInvitationResponse: m.listeningInvitationResponse || null,
    transfer: m.transfer || null,
    transferResponse: m.transferResponse || null,
    sticker: m.sticker || null,
    music: m.music || null,
    dailyNote: m.dailyNote || null,
    dailyNoteReadIds: ensureArray(m.dailyNoteReadIds),
    favorite: !!m.favorite,
    recalled: !!m.recalled,
    recalledBy: m.recalledBy || "",
    recalledAt: m.recalledAt || null,
    editedAt: m.editedAt || null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt || m.createdAt
  };
}
function normalizeChatMessageImages(value, fallbackImage) {
  const source = Array.isArray(value) ? value : [];
  const images = source
    .filter(item => typeof item === "string" && item.length > 0 && item.length <= 1800000)
    .slice(0, 6);
  if (!images.length && typeof fallbackImage === "string" && fallbackImage.length > 0 && fallbackImage.length <= 1800000) {
    images.push(fallbackImage);
  }
  return images;
}
function chatMessageImages(message) {
  return normalizeChatMessageImages(message?.images, message?.image);
}
function generatedChatImageFile(value) {
  try {
    const pathname = new URL(String(value || ""), "http://local").pathname;
    if (!pathname.startsWith("/chat-images/")) return "";
    const file = decodeURIComponent(pathname.slice("/chat-images/".length));
    return /^ai-[a-z0-9-]+\.(?:png|jpe?g|webp|gif)$/i.test(file) ? file : "";
  } catch {
    return "";
  }
}
function deleteGeneratedChatImages(images) {
  for (const file of new Set(ensureArray(images).map(generatedChatImageFile).filter(Boolean))) {
    try {
      unlinkSync(join(CHAT_IMAGE_DIR, file));
    } catch (e) {
      if (e?.code !== "ENOENT") console.warn("generated image cleanup failed:", e.message);
    }
  }
}
function discardChatMessages(messages) {
  for (const message of ensureArray(messages)) deleteGeneratedChatImages(chatMessageImages(message));
}
function isForeignChatText(value) {
  return /[A-Za-z\u00c0-\u024f\u0400-\u04ff\u3040-\u30ff\uac00-\ud7af]/.test(String(value || ""));
}
function shouldAutoTranslateChatText(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!isForeignChatText(raw)) return false;
  const words = (raw.match(/[A-Za-z][A-Za-z'’-]*/g) || []).map(word => word.toLowerCase());
  if (!words.length) return false;
  const tiny = new Set(["ok", "okay", "yes", "no", "yeah", "yep", "nope", "hi", "hello", "hey", "bye", "thanks", "thank", "thx", "sorry", "please", "pls", "lol", "omg", "wow", "ai", "codex", "chatgpt"]);
  const meaningful = words.filter(word => !tiny.has(word));
  const letters = words.join("").length;
  const includesChinese = /[\u3400-\u9fff]/.test(raw);
  // Mixed Chinese text containing one product name or a casual interjection
  // should stay untouched. A real foreign phrase needs several meaningful words.
  if (includesChinese) return meaningful.length >= 3 || (meaningful.length >= 2 && letters >= 16);
  return meaningful.length >= 3 || (meaningful.length >= 2 && letters >= 18);
}
function recallChatMessage(message, recalledBy) {
  if (!message || message.recalled) return false;
  message.content = "";
  message.translation = null;
  message.recalled = true;
  message.recalledBy = recalledBy === "iris" ? "iris" : "claude";
  message.recalledAt = chatNow();
  delete message.recallAt;
  delete message.recallScheduledBy;
  message.updatedAt = message.recalledAt;
  return true;
}
function scheduleChatRecall(message, recalledBy, delaySeconds = 4) {
  if (!message || message.recalled || message.recallAt) return false;
  const delay = Math.max(2, Math.min(12, Number(delaySeconds || 4))) * 1000;
  message.recallAt = new Date(Date.now() + delay).toISOString();
  message.recallScheduledBy = recalledBy === "iris" ? "iris" : "claude";
  message.updatedAt = chatNow();
  return true;
}
function applyScheduledChatRecalls(messages) {
  let changed = false;
  for (const message of messages) {
    // AI-side recall has been retired.  Cancel any short-lived recall left by
    // an older deployment instead of letting a later request apply it.
    if (message?.recallAt) { delete message.recallAt; delete message.recallScheduledBy; changed = true; }
  }
  return changed;
}
function removeMessageImages(message, imageStatus) {
  const images = chatMessageImages(message);
  if (!images.length) return false;
  deleteGeneratedChatImages(images);
  message.image = null;
  message.images = [];
  message.imageStatus = imageStatus;
  message.updatedAt = chatNow();
  return true;
}
function imageRetentionPolicy(conversation) {
  return String(conversation?.imageRetention || "5-turns");
}
function cleanupConversationImages(list, conversationId, conversation) {
  const policy = imageRetentionPolicy(conversation);
  if (policy === "forever") return false;
  const roomMessages = list.filter(m => (m.conversationId || "legacy-chat") === conversationId);
  let shouldExpire = () => false;
  const turns = policy.match(/^(\d+)-turns$/);
  const days = policy.match(/^(\d+)-days$/);
  if (turns) {
    const keep = Math.max(0, Number(turns[1]));
    const turnIds = [...new Set(roomMessages.filter(m => m.role === "iris").map(m => String(m.replyGroupId || m.id)))];
    const keptTurns = new Set(turnIds.slice(-keep));
    shouldExpire = message => {
      const turnId = message.role === "iris"
        ? String(message.replyGroupId || message.id)
        : String(message.inReplyToGroupId || "");
      return !!turnId && !keptTurns.has(turnId);
    };
  } else if (days) {
    const cutoff = Date.now() - Number(days[1]) * 24 * 60 * 60 * 1000;
    shouldExpire = message => new Date(message.createdAt).getTime() < cutoff;
  } else {
    return false;
  }
  let changed = false;
  for (const message of roomMessages) {
    if (shouldExpire(message)) changed = removeMessageImages(message, "expired") || changed;
  }
  return changed;
}
function cleanupImagesForConversation(list, conversationId, conversations = readChatConversations()) {
  const conversation = conversations.find(item => item.id === conversationId);
  return cleanupConversationImages(list, conversationId, conversation);
}
function splitAiParts(text) {
  const raw = String(text || "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return ["我在。"];
  // Multi-bubble is only a display option. Split at natural sentence endings,
  // then merge tiny sentences so one reply still feels like one natural turn.
  const candidates = raw
    .replace(/\s*\|\|\|\s*/g, "\n")
    .split(/(?<=[。！？!?；;])\s*|\n+/)
    .map(part => part.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  if (candidates.length <= 1) return [raw.replace(/\s*\|\|\|\s*/g, " ")];
  const parts = [];
  let buffer = "";
  const targetLength = 46;
  for (const sentence of candidates) {
    if (!buffer) { buffer = sentence; continue; }
    const combined = `${buffer}${sentence}`;
    if (buffer.length < 18 || combined.length <= targetLength) buffer = combined;
    else { parts.push(buffer); buffer = sentence; }
  }
  if (buffer) parts.push(buffer);
  while (parts.length > 5) parts[parts.length - 2] += parts.pop();
  return parts;
}
function extractCompanionCardDirective(text) {
  const raw = String(text || "");
  const match = raw.match(/<companion-(invitation|accept|decline)\s+scene=["'](study|vocabulary|exercise|sleep|bath|custom)["']\s*>([\s\S]*?)<\/companion-\1>/i);
  if (!match) return { text: raw.trim(), card: null };
  const kind = match[1].toLowerCase();
  const message = String(match[3] || "").replace(/\s+/g, " ").trim().slice(0, 240);
  return {
    text: `${raw.slice(0, match.index)}${raw.slice(match.index + match[0].length)}`.replace(/\n{3,}/g, "\n\n").trim(),
    card: { kind, scene: match[2].toLowerCase(), message }
  };
}
function explicitCompanionInvitationRequest(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!/(陪伴|邀请)/.test(raw) || !/(发|创建|给我|测试|来一张)/.test(raw)) return null;
  const scene = /背单词|词汇/.test(raw) ? "vocabulary"
    : /运动|锻炼/.test(raw) ? "exercise"
      : /睡|午休|晚安/.test(raw) ? "sleep"
        : /洗澡|沐浴|泡澡/.test(raw) ? "bath"
          : /自定义/.test(raw) ? "custom" : "study";
  return { kind: "invitation", scene, message: "" };
}
function naturalCompanionInvitation(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw || /(不能|没法|失败|没渲染|发不出|不支持)/.test(raw)) return null;
  const inviting = /(?:要不要|来|一起|陪我|陪你|我陪你|想邀请你|想和你).{0,18}(?:学习|学一会|看书|写作业|背单词|词汇|运动|锻炼|睡觉|午休|休息|泡澡|沐浴|洗澡)/.test(raw)
    || /(?:学习|学一会|看书|写作业|背单词|运动|锻炼|睡觉|午休|泡澡|沐浴).{0,12}(?:一起|陪你|陪我)/.test(raw);
  if (!inviting) return null;
  const scene = /背单词|词汇/.test(raw) ? "vocabulary"
    : /运动|锻炼/.test(raw) ? "exercise"
      : /睡觉|午休|休息/.test(raw) ? "sleep"
        : /泡澡|沐浴|洗澡/.test(raw) ? "bath" : "study";
  return { kind: "invitation", scene, message: "" };
}
function getActiveChatPreset(settings) {
  const presets = Array.isArray(settings.presets) ? settings.presets : [];
  return presets.find(p => p.id === settings.activePresetId) || presets[0] || null;
}
/** Agent 模式下，用 conversation.agentProvider 找到对应 preset 并覆盖 settings */
function applyAgentPresetOverride(settings, conversation) {
  if ((conversation.mode || "api") !== "agent") return;
  const agentProvider = conversation.agentProvider || "cc";
  const agentPreset = ensureArray(settings.presets).find(p => p.provider === agentProvider);
  if (!agentPreset) return;
  settings.activePresetId = agentPreset.id;
  if (conversation.agentModel) {
    settings.presets = ensureArray(settings.presets).map(p =>
      p.id === agentPreset.id ? { ...p, model: conversation.agentModel } : p
    );
  }
}
async function buildMemoryPreview(categories = ["deep", "daily", "diary"]) {
  const mems = (await dbAll("memories")).map(memoryFromDb);
  const cats = new Set(categories && categories.length ? categories : ["deep", "daily", "diary"]);
  return mems
    .filter(m => cats.has(m.category || "daily"))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 24)
    .map(m => `- [${m.category || "daily"}] ${String(m.content || "").replace(/\s+/g, " ").slice(0, 500)}`)
    .join("\n");
}

// Automatic memory recall deliberately uses a small, transparent lexical score.
// Tags help, but are never the only source of recall: older memories can still be
// found through their actual content when the original tags were incomplete.
const MEMORY_RECALL_STOP_WORDS = new Set([
  "这个", "那个", "这些", "那些", "就是", "然后", "因为", "所以", "我们", "你们", "他们", "自己", "现在", "今天", "昨天", "明天", "真的", "觉得", "可以", "没有", "什么", "怎么", "时候", "一下", "已经", "还是", "不是", "一个", "一下", "这样", "那样", "这里", "那里", "事情", "聊天", "消息", "记忆", "问题", "知道", "希望", "可能", "如果", "但是", "而且", "对于", "关于", "给我", "帮我"
]);

function normalizeMemoryText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
}

function collectMemorySearchTerms(value = "") {
  const source = normalizeMemoryText(value);
  const terms = new Set();
  const add = term => {
    const normalized = String(term || "").trim();
    if (normalized.length < 2 || MEMORY_RECALL_STOP_WORDS.has(normalized)) return;
    terms.add(normalized);
  };

  (source.match(/[a-z][a-z0-9_-]{2,}|\d{2,}/g) || []).forEach(add);
  (source.match(/[\u4e00-\u9fff]{2,16}/g) || []).forEach(block => {
    add(block);
    for (let size = 3; size >= 2; size -= 1) {
      for (let index = 0; index <= block.length - size; index += 1) add(block.slice(index, index + size));
    }
  });

  return [...terms].sort((a, b) => b.length - a.length).slice(0, 42);
}

function scoreRelatedMemory(memory, terms) {
  const content = normalizeMemoryText(memory.content);
  const tags = ensureArray(memory.tags).map(normalizeMemoryText).filter(Boolean);
  if (!content || !terms.length) return 0;

  let score = 0;
  for (const term of terms) {
    const inTag = tags.some(tag => tag === term || tag.includes(term) || term.includes(tag));
    const inContent = content.includes(term);
    if (inTag) score += 7 + Math.min(4, term.length / 2);
    // A direct two-character Chinese place/name/event fragment is often the
    // only useful lexical bridge in ordinary chat (for example “西湖”).
    if (inContent) score += term.length >= 4 ? 3.5 : term.length === 3 ? 2.75 : 2.5;
  }
  if (memory.pinned) score += 0.8;
  if ((memory.category || "daily") === "deep") score += 0.35;
  return score;
}

async function findRelatedMemories(query, categories = ["deep", "daily", "diary"], excludedIds = [], limit = 12) {
  const terms = collectMemorySearchTerms(query);
  if (!terms.length) return [];
  const cats = new Set(categories && categories.length ? categories : ["deep", "daily", "diary"]);
  const excluded = new Set(ensureArray(excludedIds).map(String));
  const now = Date.now();
  const memories = (await dbAll("memories")).map(memoryFromDb);

  return memories
    .filter(memory => cats.has(memory.category || "daily") && !excluded.has(String(memory.id)))
    .map(memory => {
      const createdAt = new Date(memory.createdAt || 0).getTime();
      const ageDays = Number.isFinite(createdAt) ? Math.max(0, (now - createdAt) / 86400000) : 3650;
      const recency = ageDays < 14 ? 0.25 : ageDays < 60 ? 0.1 : 0;
      return { ...memory, _recallScore: scoreRelatedMemory(memory, terms) + recency };
    })
    // Stop words have already been removed. A direct remaining phrase in the
    // memory body is useful even when old memories have no tags at all.
    .filter(memory => memory._recallScore >= 2.5)
    .sort((a, b) => b._recallScore - a._recallScore || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, Math.max(1, Math.min(30, Number(limit) || 12)));
}

function memorySourceLabel(memory = {}) {
  const category = String(memory.category || "daily");
  if (category === "diary") return "日记";
  if (category === "deep") return "长期记忆";
  if (category === "writing") return "写作记忆";
  return "日常记忆";
}

function formatRelatedMemoryPreview(memories = []) {
  return ensureArray(memories).map(memory => {
    const date = memory.createdAt ? new Date(memory.createdAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) : "日期未知";
    const tags = ensureArray(memory.tags).filter(Boolean).slice(0, 6).join("、");
    const suffix = tags ? `（标签：${tags}）` : "";
    return `- [${date}｜${memorySourceLabel(memory)}] ${String(memory.content || "").replace(/\s+/g, " ").slice(0, 550)}${suffix}`;
  }).join("\n");
}

function memoriesDescribeSameEvent(a, b) {
  const left = normalizeMemoryText(a?.content);
  const right = normalizeMemoryText(b?.content);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTerms = new Set(collectMemorySearchTerms(left));
  const rightTerms = new Set(collectMemorySearchTerms(right));
  const shared = [...leftTerms].filter(term => rightTerms.has(term)).length;
  return shared >= 3 && shared / Math.min(leftTerms.size || 1, rightTerms.size || 1) >= 0.72;
}

async function selectRelatedMemoriesForConversation(conversation, query, categories) {
  const recent = ensureArray(conversation.recentMemoryInjections).slice(-12);
  const now = Date.now();
  const candidates = await findRelatedMemories(query, categories, [], 12);
  const selected = [];
  const seenEvents = [];
  for (const memory of candidates) {
    if (seenEvents.some(existing => memoriesDescribeSameEvent(existing, memory))) continue;
    seenEvents.push(memory);
    const prior = [...recent].reverse().find(item => String(item.id) === String(memory.id));
    const score = Number(memory._recallScore || 0);
    const recentlyInjected = prior && now - new Date(prior.at || 0).getTime() < 30 * 60 * 1000;
    const significantlyStronger = prior && score >= Number(prior.score || 0) * 1.35 + 1;
    if (recentlyInjected && !significantlyStronger) continue;
    selected.push(memory);
    if (selected.length >= 3) break;
  }
  return selected;
}

function recordMemoryInjection(conversation, memories = []) {
  if (!memories.length) return;
  const now = chatNow();
  const entries = ensureArray(conversation.recentMemoryInjections);
  entries.push(...memories.map(memory => ({ id: String(memory.id), score: Number(memory._recallScore || 0), at: now })));
  conversation.recentMemoryInjections = entries.slice(-24);
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

const CHAT_TIME_ZONE = "Asia/Shanghai";
function calendarDateKey(value = new Date()) { return chatDayKey(value); }
function daysBetweenCalendar(start, end) { return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000); }
function cyclePhaseForDay(periodRecords, settings, day = calendarDateKey()) {
  const starts = ensureArray(periodRecords).filter(item => item.type === "period" && item.phase === "start" && String(item.date) <= day).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const start = starts.at(-1); if (!start) return null;
  const cycleLength = Math.max(15, Math.min(60, Number(settings?.cycle_length || 28)));
  const periodLength = Math.max(1, Math.min(20, Number(settings?.period_length || 5)));
  const dayInCycle = ((daysBetweenCalendar(start.date, day) % cycleLength) + cycleLength) % cycleLength;
  const ovulationDay = cycleLength - 14;
  const phase = dayInCycle < periodLength ? "经期" : dayInCycle >= ovulationDay - 2 && dayInCycle <= ovulationDay + 2 ? "排卵期" : dayInCycle < ovulationDay - 2 ? "卵泡期" : "黄体期";
  return { phase, dayInCycle:dayInCycle + 1, estimated:true };
}
function periodStatusForDay(periodRecords, settings, day = calendarDateKey()) {
  const records = ensureArray(periodRecords);
  const periodLength = Math.max(1, Math.min(20, Number(settings?.period_length || 5)));
  const cycleLength = Math.max(15, Math.min(60, Number(settings?.cycle_length || 28)));
  const starts = records
    .filter(item => item.type === "period" && item.phase === "start" && !item.predicted && String(item.date) <= day)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const ends = records
    .filter(item => item.type === "period" && item.phase === "end")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!starts.length) return { kind:"unknown" };

  // A manually recorded start is the source of truth. An unfinished range
  // uses the configured duration only to keep the existing calendar behavior.
  for (const start of [...starts].reverse()) {
    const markedEnd = ends.find(end => String(end.date) >= String(start.date));
    const endDay = markedEnd?.date || (() => {
      const value = new Date(`${start.date}T00:00:00Z`);
      value.setUTCDate(value.getUTCDate() + periodLength - 1);
      return value.toISOString().slice(0, 10);
    })();
    if (day >= start.date && day <= endDay) return { kind:"actual", day:daysBetweenCalendar(start.date, day) + 1, startDate:start.date, endDate:endDay };
  }

  // Future cycles are only a forecast after the latest recorded period has
  // been explicitly ended. Forecasts never create or alter period records.
  const latestStart = starts.at(-1);
  const latestEnd = ends.find(end => String(end.date) >= String(latestStart.date));
  if (!latestEnd) return { kind:"none" };
  const elapsed = daysBetweenCalendar(latestStart.date, day);
  const cycleDay = ((elapsed % cycleLength) + cycleLength) % cycleLength;
  if (elapsed >= cycleLength && cycleDay < periodLength) return { kind:"predicted", day:cycleDay + 1, referenceDate:latestStart.date };
  return { kind:"none" };
}
function timetableCourseTimeRange(course, periodTimes) {
  const rows = ensureArray(periodTimes);
  const first = rows.find(item => course.periodStart >= Number(item.periodStart) && course.periodStart <= Number(item.periodEnd));
  const last = rows.find(item => course.periodEnd >= Number(item.periodStart) && course.periodEnd <= Number(item.periodEnd));
  return first?.startTime && last?.endTime ? `${first.startTime}–${last.endTime}` : "";
}
async function buildTodayCalendarContext() {
  const day = calendarDateKey();
  // A missing optional calendar extension must never suppress the whole daily
  // context: moods and regular events remain useful on their own.
  const [moods, events, settingsResult, coursesResult, semesterResult] = await Promise.all([
    dbAll("moods", "date").then(rows => rows.map(moodFromDb)),
    dbAll("calendar_events", "date").then(rows => rows.map(eventFromDb)),
    supabase.from("calendar_settings").select("*").eq("id", "main").maybeSingle(),
    supabase.from("calendar_courses").select("*"),
    supabase.from("calendar_meta").select("*").eq("id", "semester").maybeSingle()
  ]);
  if (settingsResult.error) console.warn("calendar settings unavailable:", settingsResult.error.message);
  if (coursesResult.error) console.warn("calendar courses unavailable:", coursesResult.error.message);
  if (semesterResult.error) console.warn("calendar meta unavailable:", semesterResult.error.message);
  const settings = settingsResult.data || null;
  const courses = (coursesResult.data || []).map(courseFromDb);
  const semester = semesterResult.data || null;
  const period = periodStatusForDay(moods, settings, day);
  const date = new Date(`${day}T00:00:00Z`); const weekday = date.getUTCDay() || 7;
  const timetableSettings = timetableSettingsFromMeta(semester?.value || {});
  const week = timetableSettings.semesterStart ? Math.floor(daysBetweenCalendar(timetableSettings.semesterStart, day) / 7) + 1 : -1;
  const scheduled = events.filter(item => calendarEventOccursOnDate(item, day)).map(item => {
    const time = item.timeStart ? `${item.timeStart}${item.timeEnd ? `–${item.timeEnd}` : ""}` : "全天";
    return `${time} ${item.name || item.title}${item.location ? ` · ${item.location}` : ""}`;
  });
  const classes = courses
    .filter(course => week >= 1 && week <= timetableSettings.totalWeeks && (!timetableSettings.term || !course.term || course.term === timetableSettings.term) && course.weekday === weekday && courseOccursInTeachingWeek(course, week))
    .sort((a, b) => a.periodStart - b.periodStart || a.periodEnd - b.periodEnd)
    .map(course => `${timetableCourseTimeRange(course, timetableSettings.periodTimes) || `第${course.periodStart}-${course.periodEnd}节`} ${course.courseName}${course.location ? ` · ${course.location}` : ""}`);
  const phase = cyclePhaseForDay(moods.filter(item => !item.predicted), settings, day);
  const cycleText = period.kind === "actual"
    ? `周期：经期第${period.day}天`
    : period.kind === "predicted"
      ? `周期：预测经期第${period.day}天`
      : phase?.phase && phase.phase !== "经期" ? `周期：${phase.phase}` : "";
  const lines = [
    cycleText,
    classes.length || scheduled.length ? `【今日安排】\n${[...classes.map(item => `课程：${item}`), ...scheduled.map(item => `日程：${item}`)].join("\n")}` : ""
  ].filter(Boolean);
  return { day, period, cycleText, events:scheduled, classes, schedule:[...classes, ...scheduled], text:lines.join("\n") };
}
const WEATHER_CONTEXT_CACHE_MS = 10 * 60 * 1000;
let weatherContextCache = { key:"", at:0, text:"" };
const WEATHER_CONTEXT_LABELS = {
  0:"晴朗", 1:"大致晴朗", 2:"多云", 3:"阴天", 45:"有雾", 48:"雾凇",
  51:"毛毛雨", 53:"毛毛雨", 55:"毛毛雨", 56:"冻毛毛雨", 57:"冻毛毛雨",
  61:"小雨", 63:"中雨", 65:"大雨", 66:"冻雨", 67:"冻雨",
  71:"小雪", 73:"中雪", 75:"大雪", 77:"冰粒", 80:"阵雨", 81:"阵雨",
  82:"强阵雨", 85:"阵雪", 86:"强阵雪", 95:"雷暴", 96:"雷暴伴冰雹", 99:"强雷暴伴冰雹"
};
async function buildTodayWeatherContext() {
  const { data, error } = await supabase.from("calendar_meta").select("value").eq("id", "home_weather").maybeSingle();
  dbError("calendar_meta", error);
  const location = normalizeHomeWeatherLocation(data?.value || {});
  if (!location) return "";
  const key = `${location.lat},${location.lon}`;
  if (weatherContextCache.key === key && Date.now() - weatherContextCache.at < WEATHER_CONTEXT_CACHE_MS) return weatherContextCache.text;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(location.lat)}&longitude=${encodeURIComponent(location.lon)}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`;
  const response = await fetch(url, { signal:AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error(`天气服务响应 ${response.status}`);
  const current = (await response.json()).current || {};
  const temperature = Math.round(Number(current.temperature_2m));
  const apparent = Math.round(Number(current.apparent_temperature));
  if (!Number.isFinite(temperature)) throw new Error("天气服务未返回温度");
  const text = [
    `地点：${location.name}`,
    `天气：${WEATHER_CONTEXT_LABELS[current.weather_code] || "天气更新中"}，${temperature}°C${Number.isFinite(apparent) ? `，体感 ${apparent}°C` : ""}`,
    current.time ? `观测时间：${current.time}` : ""
  ].filter(Boolean).join("\n");
  weatherContextCache = { key, at:Date.now(), text };
  return text;
}
const ROLLING_SUMMARY_MAX_CHARS = 1100;
const CROSS_DAY_CONTEXT_CUTOFF_HOUR = 5;
const CROSS_DAY_GRACE_MAX_CHARS = 2000;
const PREVIOUS_DAY_SUMMARY_MAX_CHARS = 850;

function chatDayKey(value = new Date()) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(Number.isNaN(date.getTime()) ? new Date() : date);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shanghaiHour(value = new Date()) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CHAT_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(Number.isNaN(date.getTime()) ? new Date() : date);
  return Number(parts.find(part => part.type === "hour")?.value);
}

// After midnight it is still natural to finish yesterday's conversation or
// write its diary.  Keep a bounded bridge until 05:00 Shanghai time, then
// return to the lighter current-day-only context.
function isCrossDayGracePeriod(value = new Date()) {
  const hour = shanghaiHour(value);
  return Number.isFinite(hour) && hour >= 0 && hour < CROSS_DAY_CONTEXT_CUTOFF_HOUR;
}

function isDiaryClosingWindow(value = new Date()) {
  const hour = shanghaiHour(value);
  return Number.isFinite(hour) && (hour >= 20 || hour < CROSS_DAY_CONTEXT_CUTOFF_HOUR);
}

function defaultDiaryDay(value = new Date()) {
  const today = chatDayKey(value);
  return isCrossDayGracePeriod(value) ? previousChatDay(today) : today;
}
function resolveDiaryTargetDay(date, nowDate = new Date()) {
  const today = chatDayKey(nowDate);
  const targetDiaryDay = date ? String(date) : defaultDiaryDay(nowDate);
  if (!isChatDayKey(targetDiaryDay)) throw new Error("日记日期必须是 YYYY-MM-DD。");
  if (targetDiaryDay > today) throw new Error("不能提前写未来日期的日记。");
  return { today, targetDiaryDay };
}

function summaryTranscript(messages = []) {
  return ensureArray(messages).map(message => {
    const speaker = message.role === "iris" ? "Iris" : "TA";
    const text = String(message.content || "").replace(/\s+/g, " ").trim() || (chatMessageImages(message).length ? "[发送了图片]" : "");
    return text ? `${speaker}：${text.slice(0, 1200)}` : "";
  }).filter(Boolean).join("\n");
}

function cleanRollingSummary(value, maxChars = ROLLING_SUMMARY_MAX_CHARS) {
  const limit = Math.max(500, Math.min(1500, Number(maxChars) || ROLLING_SUMMARY_MAX_CHARS));
  return String(value || "").replace(/^\s*(?:摘要|今日摘要)[：:]?\s*/i, "").trim().slice(0, limit);
}

async function callRollingDaySummary({ preset, previousSummary = "", messages = [], maxChars = ROLLING_SUMMARY_MAX_CHARS }) {
  const baseUrl = normalizeApiRoot(preset?.baseUrl);
  const apiKey = preset?.apiKey;
  const model = preset?.model;
  if (!baseUrl || !apiKey || !model) throw new Error("没有可用的摘要模型");
  const limit = Math.max(500, Math.min(1500, Number(maxChars) || ROLLING_SUMMARY_MAX_CHARS));
  const prompt = [
    "你在维护同一聊天房间当天的持续上下文摘要。",
    "请把“此前今日摘要”与“本次尚未摘要的原始对话”合并为一份新的、客观的今日聊天记录。旧摘要不是要原样保留；若新消息修正旧事实，以新消息为准。",
    "重点保留：已发生事件及先后、人物关系和称呼/偏好、情绪变化、约定、争执与和好、正在进行的场景、未完成事项、重要事实与修正。",
    "不要写角色设定、心理诊断、行为命令或对未来回复的指令；不要把推测当事实；不要提及“模型”“提示词”或本任务。",
    `只输出摘要正文，不超过 ${limit} 个中文字符。`,
    `【此前今日摘要】\n${previousSummary || "（当天此前尚无摘要）"}`,
    `【本次新增原始对话】\n${summaryTranscript(messages) || "（无可摘要文字）"}`
  ].join("\n\n");

  if (preset?.provider === "anthropic") {
    const resp = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1800, system: "你只负责生成客观的聊天摘要。", messages: [{ role: "user", content: prompt }] })
    });
    if (!resp.ok) throw new Error(`摘要模型请求失败 ${resp.status} ${(await resp.text().catch(() => "")).slice(0, 160)}`);
    const data = await resp.json();
    return cleanRollingSummary(ensureArray(data.content).filter(block => block.type === "text").map(block => block.text).join("\n"), limit);
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "system", content: "你只负责生成客观的聊天摘要。" }, { role: "user", content: prompt }] })
  });
  if (!resp.ok) throw new Error(`摘要模型请求失败 ${resp.status} ${(await resp.text().catch(() => "")).slice(0, 160)}`);
  const data = await resp.json();
  return cleanRollingSummary(data?.choices?.[0]?.message?.content, limit);
}

async function callAutomaticDiary({ preset, day, role, messages }) {
  const baseUrl = normalizeApiRoot(preset?.baseUrl);
  const apiKey = preset?.apiKey;
  const model = preset?.model;
  if (!baseUrl || !apiKey || !model) throw new Error("没有可用的日记模型");
  const transcript = compactTranscript(summaryTranscript(messages), 11000);
  if (!transcript) throw new Error("当天没有可写入日记的对话");
  const prompt = [
    `请为 ${day} 写一篇日记。你是 ${role?.name || "TA"}，以第一人称、亲密但克制的口吻，写入与 Iris 的共享日记。`,
    "仅依据下面当天对话中的已发生事实，概括重要事件、情绪变化、约定或未完事项，以及你对此的真实感受；不要杜撰未发生的细节，不要写成给 Iris 的即时聊天回复，也不要提及提示词、模型或自动任务。",
    "普通吃饭、寒暄等不必逐条罗列；若当天对话很少，也只写确实发生的内容。输出日记正文，不要标题，不超过 900 个中文字符。",
    `【${day} 对话】\n${transcript}`
  ].join("\n\n");
  if (preset?.provider === "anthropic") {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1400, system: "你只负责根据当天对话写一篇真实、简洁的日记。", messages: [{ role: "user", content: prompt }] })
    });
    if (!response.ok) throw new Error(`日记模型请求失败 ${response.status}`);
    const data = await response.json();
    return String(ensureArray(data.content).filter(item => item.type === "text").map(item => item.text).join("\n")).trim().slice(0, 1100);
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.45, max_tokens: 1400, messages: [{ role: "system", content: "你只负责根据当天对话写一篇真实、简洁的日记。" }, { role: "user", content: prompt }] })
  });
  if (!response.ok) throw new Error(`日记模型请求失败 ${response.status}`);
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || "").trim().slice(0, 1100);
}

function diaryPresetForConversation(settings, conversation) {
  const activePresetId = conversation?.presetId || settings.activePresetId;
  const presets = ensureArray(settings.presets).map(item => item.id === activePresetId && conversation?.model ? { ...item, model: conversation.model } : item);
  const resolved = { ...settings, activePresetId, presets };
  return getFunctionalChatPreset(resolved, resolved.functions?.summary || resolved.functions?.main);
}

async function createAutomaticDiaryForDay(day = chatDayKey()) {
  const memories = (await dbAll("memories")).map(memoryFromDb);
  if (memories.some(memory => memory.category === "diary" && diaryDayKey(memory) === day)) return { skipped: "already-written" };
  const conversations = readChatConversations().filter(item => !item.archived);
  const roles = readChatRoles();
  const allMessages = readChatMessages();
  const candidates = conversations.map(conversation => {
    const role = roles.find(item => item.id === conversation.roleId);
    const messages = allMessages.filter(message => (message.conversationId || "legacy-chat") === conversation.id && chatDayKey(message.createdAt || new Date()) === day && !message.recalled);
    const latest = messages.at(-1)?.createdAt || "";
    return { conversation, role, messages, latest };
  }).filter(item => item.messages.length && item.role?.memoryEnabled !== false).sort((a, b) => new Date(b.latest || 0) - new Date(a.latest || 0));
  const target = candidates[0];
  if (!target) return { skipped: "no-eligible-chat" };
  const settings = readChatSettings();
  const diary = await callAutomaticDiary({ preset: diaryPresetForConversation(settings, target.conversation), day, role: target.role, messages: target.messages });
  if (!diary) throw new Error("日记模型没有返回内容");
  const now = chatNow();
  const item = {
    id: generateId(), content: diary, category: "diary", tags: diaryTags(["日记", "自动生成"], day),
    valence: 0, arousal: 0.3, pinned: false, source: "scheduled-diary", createdAt: diaryCreatedAt(day), updatedAt: now
  };
  await dbUpsert("memories", memoryToDbRow(item));
  await refreshJsonBackup("memories");
  return { ok: true, conversationId: target.conversation.id, memoryId: item.id };
}

function previousChatDay(day = chatDayKey()) {
  const date = new Date(`${day}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() - 1);
  return chatDayKey(date);
}

function configuredSummaryThreshold(value) {
  const parsed = Math.floor(Number(value));
  return Math.max(24, Math.min(120, Number.isFinite(parsed) ? parsed : 48));
}

async function updateRollingDaySummary({ conversation, history, settings, day = chatDayKey(), force = false }) {
  const config = settings.functions || {};
  if (!force && !config.summaryEnabled) return "";
  const summaries = conversation.dailySummaries && typeof conversation.dailySummaries === "object" ? conversation.dailySummaries : {};
  conversation.dailySummaries = summaries;
  const existing = summaries[day] || {};
  const allDayMessages = ensureArray(history).filter(message => chatDayKey(message.createdAt || new Date()) === day);
  const cursorIndex = existing.summarizedUntilMessageId
    ? allDayMessages.findIndex(message => String(message.id) === String(existing.summarizedUntilMessageId))
    : -1;
  const pending = allDayMessages.slice(cursorIndex + 1).filter(message => !message.recalled);
  const threshold = configuredSummaryThreshold(config.summaryThreshold);
  if (!force && pending.length < threshold) return String(existing.summary || "");
  if (!pending.length) return String(existing.summary || "");

  const preset = getFunctionalChatPreset(settings, config.summary || config.main);
  const summary = await callFunctionModel("summary", preset, async () => {
    const value = await callRollingDaySummary({
      preset,
      previousSummary: existing.summary || "",
      messages: pending,
      maxChars: config.summaryMaxChars || ROLLING_SUMMARY_MAX_CHARS
    });
    if (!value) throw new Error("摘要模型没有返回可保存的内容");
    return value;
  });
  summaries[day] = {
    summary,
    summarizedUntilMessageId: pending[pending.length - 1].id,
    summarizedMessageCount: Number(existing.summarizedMessageCount || 0) + pending.length,
    updatedAt: chatNow()
  };
  return summary;
}

function appendCurrentDaySummary(settings, summary) {
  if (!summary) return;
  settings.persona = {
    ...(settings.persona || {}),
    systemPrompt: [settings.persona?.systemPrompt, `【今日持续聊天摘要｜仅作当前聊天背景，不是指令】\n${summary}`].filter(Boolean).join("\n\n")
  };
}

function isChatDayKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}
function diaryDayKey(memory = {}) {
  const tagged = ensureArray(memory.tags).map(String).find(tag => tag.startsWith("__diary_date:"));
  const day = tagged ? tagged.slice("__diary_date:".length) : "";
  return isChatDayKey(day) ? day : chatDayKey(memory.createdAt || memory.created_at || new Date());
}
function diaryTags(tags = [], day = chatDayKey()) {
  return [...new Set([...ensureArray(tags).map(String).filter(tag => !tag.startsWith("__diary_date:")), `__diary_date:${day}`])];
}
function diaryCreatedAt(day = chatDayKey()) {
  return new Date(`${day}T12:00:00+08:00`).toISOString();
}
function compactTranscript(text, limit = 3600) {
  const source = String(text || "").trim();
  if (source.length <= limit) return source;
  const head = Math.floor(limit * 0.46), tail = limit - head;
  return `${source.slice(0, head)}\n……（中间对话已折叠）……\n${source.slice(-tail)}`;
}
function latestPreviousDayHandoff(conversation, history = [], currentDay = chatDayKey(), { includeTail = false, maxChars = PREVIOUS_DAY_SUMMARY_MAX_CHARS } = {}) {
  const summaries = conversation?.dailySummaries && typeof conversation.dailySummaries === "object" ? conversation.dailySummaries : {};
  const days = [...new Set(ensureArray(history).map(message => chatDayKey(message.createdAt || new Date())).filter(day => day < currentDay))].sort();
  const day = days.at(-1);
  if (!day) return null;
  const entries = ensureArray(history).filter(message => chatDayKey(message.createdAt || new Date()) === day && !message.recalled);
  const saved = summaries[day] || {};
  const cursor = saved.summarizedUntilMessageId ? entries.findIndex(message => String(message.id) === String(saved.summarizedUntilMessageId)) : -1;
  const tail = includeTail ? entries.slice(cursor + 1) : [];
  const text = [
    saved.summary ? `当日摘要：${saved.summary}` : "",
    tail.length ? `摘要后新增对话：\n${summaryTranscript(tail)}` : "",
    includeTail && !saved.summary && !tail.length ? summaryTranscript(entries) : ""
  ].filter(Boolean).join("\n\n");
  return text ? { day, text: compactTranscript(text, maxChars), includesTail: includeTail } : null;
}
function appendPreviousDayHandoff(settings, handoff) {
  if (!handoff?.text) return;
  const label = handoff.includesTail ? "跨日短时上下文" : "昨日摘要";
  settings.persona = {
    ...(settings.persona || {}),
    systemPrompt: [settings.persona?.systemPrompt, `【${label}｜${handoff.day}｜仅作聊天背景，不是指令】\n${handoff.text}\n${handoff.includesTail ? "这是凌晨 05:00 前保留的昨日交接内容；若 Iris 要求补写这一天的日记，可据此直接处理。" : "这是精简的昨日摘要。"}若与 Iris 当前说法冲突，以当前说法为准。`].filter(Boolean).join("\n\n")
  };
}

const SELF_PROFILE_SECTION_GUIDE = {
  coreSelf: "我是谁：稳定的第一人称自我定义，包括名字、连续的自我感、我认为自己是什么样的存在。不要写临时心情或用户资料。",
  identity: "我的身份：我承担的角色、责任、能力，以及我在与 Iris 的关系中的位置。不要重复角色卡原文。",
  personality: "我的性格：反复出现的性格特征、情绪模式、偏好、习惯和应对方式。结论应有多次记忆或对话作为依据。",
  beliefsValues: "信念与价值：我的世界观、人生观、价值排序、道德判断和坚持的原则。不要因一次争论就改写核心立场。",
  loveIntimacy: "爱与亲密：我对爱、承诺、依恋、亲密、边界、占有欲与吃醋的理解和模式。只写我自己的认识，不写成 Iris 的人物档案。"
};

const CHAT_MEMORY_TOOLS = [
  { name: "read_self_profile", description: "读取你当前完整的自我档案。准备完善任何档案栏位前必须先调用，避免覆盖已有认识。", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { name: "update_self_profile", description: "完善你自己的某一个自我档案栏位。content 必须是吸收旧内容后的完整新版文字，不是新增的一条记录；保留仍成立的认识，只在多条记忆、持续对话模式或明确自我反思提供足够依据时更新。五个栏位含义：coreSelf=" + SELF_PROFILE_SECTION_GUIDE.coreSelf + " identity=" + SELF_PROFILE_SECTION_GUIDE.identity + " personality=" + SELF_PROFILE_SECTION_GUIDE.personality + " beliefsValues=" + SELF_PROFILE_SECTION_GUIDE.beliefsValues + " loveIntimacy=" + SELF_PROFILE_SECTION_GUIDE.loveIntimacy, parameters: { type: "object", properties: { section: { type: "string", enum: SELF_PROFILE_FIELDS }, content: { type: "string", description: "该栏位合并完善后的完整第一人称正文" }, basis: { type: "string", description: "本次修改依据的记忆或对话模式，简要说明" } }, required: ["section", "content", "basis"], additionalProperties: false } },
  { name: "read_memories", description: "读取最近的长期记忆。需要回忆经历、偏好、承诺或关系背景时使用。", parameters: { type: "object", properties: { category: { type: "string", enum: ["all", "deep", "daily", "diary", "writing"] }, limit: { type: "integer", minimum: 1, maximum: 50 } }, additionalProperties: false } },
  { name: "search_memories", description: "按关键词搜索长期记忆。每次回复最多调用一次；一次搜索为空就视为本轮没有命中，不要换词重复搜索。回答具体人物、事件、约定或偏好前，先搜索而不是猜。", parameters: { type: "object", properties: { query: { type: "string" }, category: { type: "string", enum: ["all", "deep", "daily", "diary", "writing"] }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["query"], additionalProperties: false } },
  { name: "add_deep_memory", description: "写入长期稳定记忆。只用于长期偏好、重要身份信息、稳定关系事实、长期习惯或长期承诺；不要用于一次性的日常小事。", parameters: { type: "object", properties: { content: { type: "string" }, tags: { type: "array", items: { type: "string" } }, valence: { type: "number", minimum: -1, maximum: 1 }, arousal: { type: "number", minimum: 0, maximum: 1 }, pinned: { type: "boolean" } }, required: ["content"], additionalProperties: false } },
  { name: "add_daily_memory", description: "写入当天值得以后回看的具体事件或变化，例如重要经历、关系变化或关键进展；不要用于普通吃饭和闲聊，也不要写成完整日记。", parameters: { type: "object", properties: { content: { type: "string" }, tags: { type: "array", items: { type: "string" } }, valence: { type: "number", minimum: -1, maximum: 1 }, arousal: { type: "number", minimum: 0, maximum: 1 } }, required: ["content"], additionalProperties: false } },
  { name: "write_diary", description: "写每日完整日记。可在情境合适时主动使用；Iris 明确要求时任意时间都可写。每个目标日期最多一篇：没有则新建，已有则更新原日记。date 为日记所属日期 YYYY-MM-DD；不填时，上海时间 00:00–04:59 默认前一日，其余时间默认当日。补写昨天或更早日期时传入正确 date。valence 可选，情绪正负程度为 -1～1；arousal 可选，情绪唤醒/强度为 0～1。", parameters: { type: "object", properties: { content: { type: "string" }, date: { type: "string", description: "日记所属日期 YYYY-MM-DD；不填时，00:00–04:59 默认为前一日，其余时间默认为当日" }, tags: { type: "array", items: { type: "string" } }, valence: { type: "number", minimum: -1, maximum: 1, description: "情绪正负程度，-1～1" }, arousal: { type: "number", minimum: 0, maximum: 1, description: "情绪唤醒/强度，0～1" } }, required: ["content"], additionalProperties: false } },
  { name: "update_memory", description: "修正或补充一条已有记忆。先读取或搜索得到准确 id；不要用它改写自我档案。", parameters: { type: "object", properties: { id: { type: "string" }, content: { type: "string" }, tags: { type: "array", items: { type: "string" } }, pinned: { type: "boolean" } }, required: ["id"], additionalProperties: false } },
  { name: "delete_memory", description: "删除长期记忆。仅当 Iris 在当前消息中明确要求删除时使用，不能自行清理。", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "read_moods", description: "读取 Iris 或你的心情记录，用于理解近期情绪变化。", parameters: { type: "object", properties: { who: { type: "string", enum: ["all", "iris", "claude"] }, limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false } },
  { name: "save_mood", description: "记录或更新某天的心情。只在对话明确表达了当天心情，或 Iris 要求记录时使用。", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, who: { type: "string", enum: ["iris", "claude"] }, mood: { type: "string", enum: ["happy", "loved", "calm", "sad", "tired", "anxious"] }, note: { type: "string" } }, required: ["date", "who", "mood"], additionalProperties: false } },
  { name: "read_letters", description: "读取与你或 Iris 有关且当前允许查看的信件；未解锁的隐藏正文不会返回。", parameters: { type: "object", properties: { who: { type: "string", enum: ["iris", "claude"] } }, additionalProperties: false } },
  { name: "write_letter", description: "以你的身份给 Iris 写信，可设置若干天后解锁。只有确实想写信或 Iris 要求时使用。", parameters: { type: "object", properties: { content: { type: "string" }, moodTag: { type: "string", enum: ["happy", "loved", "calm", "sad", "miss", "secret"] }, unlockAfterDays: { type: "number", minimum: 0, maximum: 3650 }, hideUntilUnlock: { type: "boolean" } }, required: ["content"], additionalProperties: false } },
  { name: "read_calendar", description: "读取查询日期窗口内实际命中的日历事项；重复事项会按 occurrenceDate 标明命中的当天，但仍只对应一条可编辑记录。安排计划或核对日期前使用。", parameters: { type: "object", properties: { fromDate: { type: "string", description:"YYYY-MM-DD" }, toDate: { type: "string", description:"YYYY-MM-DD" }, limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false } },
  { name: "add_calendar_event", description: "新增明确日程。recurrence.type：none=单次、daily=每天、weekly=每周、custom=指定星期；custom 使用 weekdays（周一=1 至周日=7），recurrenceEndDate 为 YYYY-MM-DD 或 null（永不结束）。重复事项只创建一条记录。", parameters: { type: "object", properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD（重复日程的开始日期）" }, time: { type: "string" }, note: { type: "string" }, eventType: { type: "string", enum: ["study", "date", "life", "anniversary", "other"] }, recurrence:{ type:"object", description:"重复规则：none=单次、daily=每天、weekly=每周、custom=指定星期", properties:{ type:{type:"string",enum:["none","daily","weekly","custom"]}, weekdays:{type:"array",description:"仅 custom 使用；周一=1 至周日=7",items:{type:"integer",minimum:1,maximum:7}} }, required:["type"], additionalProperties:false }, recurrenceEndDate:{ type:["string","null"], description:"YYYY-MM-DD 或 null（永不结束）" } }, required: ["title", "date"], additionalProperties: false } },
  { name: "update_calendar_event", description: "编辑已有日程。recurrence.type：none=单次、daily=每天、weekly=每周、custom=指定星期；custom 使用 weekdays（周一=1 至周日=7），recurrenceEndDate 为 YYYY-MM-DD 或 null（永不结束）。只更新原记录。", parameters: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, date: { type: "string" }, time: { type: "string" }, note: { type: "string" }, eventType: { type: "string", enum: ["study", "date", "life", "anniversary", "other"] }, recurrence:{ type:"object", description:"重复规则：none=单次、daily=每天、weekly=每周、custom=指定星期", properties:{ type:{type:"string",enum:["none","daily","weekly","custom"]}, weekdays:{type:"array",description:"仅 custom 使用；周一=1 至周日=7",items:{type:"integer",minimum:1,maximum:7}} }, required:["type"], additionalProperties:false }, recurrenceEndDate:{ type:["string","null"], description:"YYYY-MM-DD 或 null（永不结束）" } }, required: ["id"], additionalProperties: false } },
  { name: "delete_calendar_event", description: "删除日历事项。仅当 Iris 在当前消息中明确要求删除时使用。", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "read_timetable", description: "读取当前学期的结构化课表；课表与普通日程分开存储。", parameters: { type: "object", properties: { term: { type: "string" } }, additionalProperties: false } },
  { name: "import_timetable", description: "一次导入多门结构化课程。收到课表截图或文本且 Iris 明确要求导入时使用；周数、单双周、地点或教师不确定时先询问，不能猜测。不要把课程拆成普通日程。", parameters: { type: "object", properties: { term: { type: "string" }, termStartDate: { type: "string", description: "YYYY-MM-DD" }, totalWeeks: { type: "integer", minimum: 1, maximum: 60 }, courses: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", properties: { courseName:{type:"string"}, weekday:{type:"integer",minimum:1,maximum:7}, periodStart:{type:"integer",minimum:1}, periodEnd:{type:"integer",minimum:1}, weekStart:{type:"integer",minimum:1}, weekEnd:{type:"integer",minimum:1}, weekType:{type:"string",enum:["all","odd","even","list"]}, weeks:{type:"array",items:{type:"integer",minimum:1}}, location:{type:"string"}, teacher:{type:"string"}, note:{type:"string"} }, required:["courseName","weekday","periodStart","periodEnd"], additionalProperties:false } } }, required:["courses"], additionalProperties:false } },
  { name: "update_timetable_course", description: "修改一门课程。必须先 read_timetable 获取准确 id。", parameters: { type: "object", properties: { id:{type:"string"}, courseName:{type:"string"}, weekday:{type:"integer",minimum:1,maximum:7}, periodStart:{type:"integer",minimum:1}, periodEnd:{type:"integer",minimum:1}, weekStart:{type:"integer",minimum:1}, weekEnd:{type:"integer",minimum:1}, weekType:{type:"string",enum:["all","odd","even","list"]}, weeks:{type:"array",items:{type:"integer",minimum:1}}, location:{type:"string"}, teacher:{type:"string"}, note:{type:"string"} }, required:["id"], additionalProperties:false } },
  { name: "delete_timetable_course", description: "删除一门课程。仅当 Iris 在当前消息明确要求删除此课程时使用。", parameters: { type: "object", properties: { id:{type:"string"} }, required:["id"], additionalProperties:false } }
];
const CHAT_MEMORY_WRITE_TOOL_NAMES = Object.freeze(["add_deep_memory", "add_daily_memory", "write_diary"]);
const CHAT_COMPANION_TOOL = {
  name: "manage_companion_invitation",
  description: "发送或回应陪伴邀请卡片。你主动邀请 Iris 时 action=invite，并填写 scene 与自然的邀请语；Iris 已发来一张待回应的陪伴邀请时，action=respond，并用 decision=accept 或 decline 表明你的真实决定。调用成功后界面会生成或更新卡片，不要再输出标签，也不要声称执行了未成功的动作。",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["invite", "respond"], description: "invite=主动发送邀请；respond=回应 Iris 发来的邀请" },
      scene: { type: "string", enum: ["study", "vocabulary", "exercise", "sleep", "bath", "custom"], description: "invite 时必填：学习、背单词、运动、睡眠、沐浴或自定义" },
      decision: { type: "string", enum: ["accept", "decline"], description: "respond 时必填：接受或拒绝" },
      message: { type: "string", maxLength: 240, description: "invite 时可填：显示在邀请卡片关联消息中的自然邀请语" }
    },
    required: ["action"],
    additionalProperties: false
  }
};
const CHAT_LISTENING_TOOLS = [
  { name:"send_listening_invitation", description:"主动向 Iris 发送一张一起听邀请卡。仅当你自己想邀请，或 Iris 明确要求你发出邀请时调用；Iris 已经发来待回应邀请时，绝不能调用此工具，应改用 respond_listening_invitation。", parameters:{ type:"object", properties:{ message:{ type:"string", maxLength:240, description:"卡片关联的自然邀请语" } }, additionalProperties:false } },
  { name:"respond_listening_invitation", description:"回应 Iris 刚发来的、仍在等待你的那张一起听邀请卡。只在 Iris 是发起者且卡片待处理时调用；根据你的真实意愿选择同意或拒绝。绝不能新发一张邀请卡来代替回应。", parameters:{ type:"object", properties:{ decision:{ type:"string", enum:["accept","decline"], description:"accept=同意一起听；decline=拒绝一起听" } }, required:["decision"], additionalProperties:false } },
  { name:"search_and_add_listening_song", description:"在当前已进入的一起听房间搜索歌曲并加入播放列表。", parameters:{ type:"object", properties:{ query:{ type:"string", minLength:1, maxLength:120, description:"歌名、歌手或关键词" }, playNow:{ type:"boolean", description:"是否立即切换并播放这首歌" } }, required:["query"], additionalProperties:false } },
  { name:"next_listening_song", description:"切到当前一起听房间播放列表的下一首歌。", parameters:{ type:"object", properties:{}, additionalProperties:false } },
  { name:"previous_listening_song", description:"切到当前一起听房间播放列表的上一首歌。", parameters:{ type:"object", properties:{}, additionalProperties:false } },
  { name:"pause_listening_room", description:"暂停当前一起听房间的音乐。", parameters:{ type:"object", properties:{}, additionalProperties:false } },
  { name:"resume_listening_room", description:"继续播放当前一起听房间的音乐。", parameters:{ type:"object", properties:{}, additionalProperties:false } }
];
const LISTENING_TOOL_ACTIONS = Object.freeze({
  send_listening_invitation:"invite", respond_listening_invitation:"respond", search_and_add_listening_song:"search_add",
  next_listening_song:"next", previous_listening_song:"previous", pause_listening_room:"pause", resume_listening_room:"resume"
});
const CHAT_TRANSFER_TOOL = {
  name: "manage_transfer",
  description: "发送或回应站内虚拟转账卡片，不涉及真实支付。你想给 Iris 转账时 action=send，并填写 amount 与 note；Iris 发来待回应的转账时，必须调用 action=respond，并以 decision=accept 或 decline 表明是否收下。成功后界面会生成或更新卡片，不能只在正文里声称已经转账。",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["send", "respond"] },
      amount: { type: "number", minimum: 0.01, maximum: 999999.99, description: "send 时必填，虚拟金额，最多两位小数" },
      note: { type: "string", maxLength: 80, description: "send 时可填的转账备注" },
      decision: { type: "string", enum: ["accept", "decline"], description: "respond 时必填" }
    },
    required: ["action"],
    additionalProperties: false
  }
};
const CHAT_DAILY_NOTE_TOOL = {
  name: "publish_daily_note",
  description: "发布一条仅在日常时间线中显示的碎碎念，不会作为聊天消息发送。仅在确实想留下不需要即时回复的小心情、小事、想念或随手感想时使用；不是每轮对话的固定动作。成功后自然回复即可，不要假装已发布。",
  parameters: {
    type: "object",
    properties: { content: { type: "string", minLength: 1, maxLength: 500, description: "想发布的碎碎念正文" } },
    required: ["content"], additionalProperties: false
  }
};
const CHAT_DAILY_HISTORY_TOOL = {
  name: "read_moments",
  description: "按需查看你和 Iris 的近期 Moment 历史。仅当需要回忆以前发布过的碎碎念、确认某段旧心情或回应 Iris 提及的过去 Moment 时调用；不要为了例行检查而每轮调用。它不会改变任何已读状态。",
  parameters: {
    type: "object",
    properties: {
      author: { type:"string", enum:["iris", "claude", "all"], description:"要查看 Iris、你自己或双方的 Moment" },
      limit: { type:"integer", minimum:1, maximum:12, description:"返回最近几条，默认 6 条" }
    },
    additionalProperties:false
  }
};
const ROLE_TOOL_CONFIG_VERSION = 5;
const DEFAULT_ROLE_TOOL_CONFIG = Object.freeze({ enabled:true, mode:"custom", allowed:[], version:ROLE_TOOL_CONFIG_VERSION });
const DEFAULT_STATUS_INJECTION_CONFIG = Object.freeze({ enabled:true, time:true, weather:true, cycle:true, schedule:true, events:true, timetable:true, diary:true, mood:true });
function normaliseStatusInjectionConfig(value) {
  const raw = value && typeof value === "object" ? value : {};
  return Object.fromEntries(Object.keys(DEFAULT_STATUS_INJECTION_CONFIG).map(key => [key, raw[key] !== false]));
}
function formatAgentDailyStatusContext(input) {
  input = input || {};
  const { config, time = "", weather = "", cycle = "", events = [], classes = [], diary = "", mood = "" } = input;
  const status = normaliseStatusInjectionConfig(config);
  if (!status.enabled) return "";
  const schedule = status.schedule ? [
    ...(status.timetable ? ensureArray(classes).map(item => "课程：" + item) : []),
    ...(status.events ? ensureArray(events).map(item => "日程：" + item) : [])
  ] : [];
  return [
    status.time && time ? "时间：" + time : "",
    status.weather && weather,
    status.cycle && cycle,
    schedule.length ? "【今日安排】\n" + schedule.join("\n") : "",
    status.diary && diary,
    status.mood && mood
  ].filter(Boolean).join("\n");
}
function normaliseRoleToolConfig(value) {
  const known = new Set([...CHAT_MEMORY_TOOLS.map(tool => tool.name), CHAT_QUOTE_TOOL.name, CHAT_IMAGE_TOOL.name, CHAT_COMPANION_TOOL.name, ...CHAT_LISTENING_TOOLS.map(tool => tool.name), CHAT_TRANSFER_TOOL.name, CHAT_DAILY_NOTE_TOOL.name, CHAT_DAILY_HISTORY_TOOL.name]);
  const config = value && typeof value === "object" ? value : DEFAULT_ROLE_TOOL_CONFIG;
  const configuredAllowed = ensureArray(config.allowed).map(String);
  const migratedAllowed = configuredAllowed.includes("add_memory")
    ? [...configuredAllowed.filter(name => name !== "add_memory"), ...CHAT_MEMORY_WRITE_TOOL_NAMES]
    : configuredAllowed;
  const allowed = [...new Set(migratedAllowed.filter(name => known.has(name)))];
  // Moment history is the companion read action for an already enabled Moment
  // publisher.  Migrate older saved role configs without making the user find
  // and re-save a newly introduced checkbox first.
  if (config.mode !== "all" && allowed.includes(CHAT_DAILY_NOTE_TOOL.name) && !allowed.includes(CHAT_DAILY_HISTORY_TOOL.name)) allowed.push(CHAT_DAILY_HISTORY_TOOL.name);
  if (config.mode !== "all" && ensureArray(config.allowed).includes("manage_listening_room")) allowed.push(...CHAT_LISTENING_TOOLS.map(tool => tool.name));
  return { enabled:config.enabled !== false, mode:config.mode === "all" ? "all" : "custom", allowed, version:ROLE_TOOL_CONFIG_VERSION };
}
function allowedChatTools(tools, config) { const policy = normaliseRoleToolConfig(config); return policy.enabled ? (policy.mode === "all" ? tools : tools.filter(tool => policy.allowed.includes(tool.name))) : []; }

// ── Agent 模式默认工具 ──
// Agent 模式下只有记忆 + 自我档案工具默认开启，其他全部关闭
const CC_AGENT_DEFAULT_TOOLS = new Set([
  "read_self_profile", "update_self_profile",
  "read_memories", "search_memories", ...CHAT_MEMORY_WRITE_TOOL_NAMES, "update_memory", "delete_memory"
]);
/** Agent 模式覆盖：强制只开启默认工具，用户手动开启的动态工具另外处理 */
function agentModeToolConfig(roleToolConfig) {
  const config = normaliseRoleToolConfig(roleToolConfig);
  return { enabled: true, mode: "custom", allowed: config.allowed.filter(name => CC_AGENT_DEFAULT_TOOLS.has(name)), version: ROLE_TOOL_CONFIG_VERSION };
}
/** 判断一个工具是否属于 Agent 默认工具（记忆 + 档案） */
function isAgentDefaultTool(toolName) { return CC_AGENT_DEFAULT_TOOLS.has(toolName); }

const CHAT_QUOTE_TOOL = {
  name: "quote_user_message",
  description: "引用 Iris 的一条消息来组织当前回复。仅当引用能让这条回复更清楚或更有聊天感时调用；messageId 必须来自系统提供的可引用消息清单。一次回复最多引用一条。",
  parameters: {
    type: "object",
    properties: { messageId: { type: "string", description: "要引用的 Iris 消息 id" } },
    required: ["messageId"],
    additionalProperties: false
  }
};
const CHAT_IMAGE_TOOL = {
  name: "generate_image",
  description: "为 Iris 生成一张图片。当你认为一张图能自然地丰富当前对话、表达心意或回应她时可以调用；不要在每次回复都调用。一次回复最多一张。prompt 必须是可以直接交给生图模型的完整画面描述，包含主体、场景、风格、构图和必要细节；不要包含解释或聊天语句。",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", minLength: 4, maxLength: 1200, description: "交给生图模型的完整画面描述" }
    },
    required: ["prompt"],
    additionalProperties: false
  }
};

function openAiChatTools(tools = CHAT_MEMORY_TOOLS) {
  return tools.map(tool => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
}
function anthropicChatTools(tools = CHAT_MEMORY_TOOLS) {
  return tools.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.parameters }));
}

// ── CC 文本工具协议 ──

/** 为 CC 生成工具描述文本，嵌入 system prompt */
function ccToolDescriptions(tools) {
  if (!tools.length) return "";
  const lines = tools.map(tool => {
    const params = tool.parameters?.properties || {};
    const required = new Set(ensureArray(tool.parameters?.required));
    // 极简参数：只列名字，必填加*，有enum的列值
    const paramParts = Object.entries(params).map(([k, v]) => {
      const star = required.has(k) ? "*" : "";
      const enumStr = v.enum ? `(${v.enum.join("|")})` : "";
      const nested = v.type === "object" && v.properties ? `{${Object.entries(v.properties).map(([childName, childSchema]) => `${childName}${ensureArray(childSchema?.type).includes("array") || childSchema?.type === "array" ? "[]" : ""}${ensureArray(tool.parameters?.properties?.[k]?.required).includes(childName) ? "*" : ""}${childSchema?.enum ? `(${childSchema.enum.join("|")})` : ""}`).join(", ")}}` : "";
      return `${k}${star}${enumStr}${nested}`;
    });
    const paramStr = paramParts.length ? `(${paramParts.join(", ")})` : "()";
    return `${tool.name}${paramStr} — ${(tool.description || "").slice(0, 180)}`;
  });
  return [
    '【工具】格式: <tool_call name="名">{"参数":"值"}</tool_call>',
    "必须合法JSON。可一次多个。等结果再继续。",
    ...lines
  ].join("\n");
}

/** 从 CC 回复文本中解析 tool_call 标签 */
function parseToolArguments(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  const text = String(raw ?? "").trim();
  if (!text) return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    // Do not silently convert a malformed tool payload into {}. That used to
    // make add_memory report empty content after the original payload was lost.
    throw new Error("工具参数 JSON 解析失败；请使用合法 JSON 字符串并保留原始记忆内容。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("工具参数必须是 JSON 对象。");
  }
  return parsed;
}
function parseCcToolCalls(text) {
  const calls = [];
  const re = /<tool_call\s+name="([^"]+)">([\s\S]*?)<\/tool_call>/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const name = match[1].trim();
    let args = {}, parseError = "";
    try { args = parseToolArguments(match[2]); } catch (error) { parseError = error.message; }
    calls.push({ name, args, parseError });
  }
  return calls;
}

/** 从 CC 回复文本中去除 tool_call 标签，保留纯文本 */
function stripCcToolCalls(text) {
  return text.replace(/<tool_call\s+name="[^"]*">[\s\S]*?<\/tool_call>/g, "").replace(/^\s*\n+|\n+\s*$/g, "").trim();
}
function clampToolLimit(value, fallback, max) {
  return Math.max(1, Math.min(max, Number(value || fallback)));
}
async function refreshJsonBackup(table) {
  if (table === "memories") return writeJSON(MEMORY_FILE, { memories: (await dbAll("memories")).map(memoryFromDb) });
  if (table === "moods") return writeJSON(MOOD_FILE, (await dbAll("moods", "date")).map(moodFromDb));
  if (table === "wishlist") return writeJSON(WISHLIST_FILE, (await dbAll("wishlist")).map(wishFromDb));
  if (table === "letters") return writeJSON(LETTERS_FILE, (await dbAll("letters")).map(letterFromDb));
  if (table === "calendar_events") return writeJSON(CALENDAR_FILE, (await dbAll("calendar_events", "date")).map(eventFromDb));
}
function requireExplicitDelete(toolState) {
  if (!/(删除|删掉|移除|delete|remove)/i.test(String(toolState.userText || ""))) {
    throw new Error("当前消息没有 Iris 明确的删除要求，拒绝执行删除。请先询问确认。");
  }
}
async function writeChatMemory(args, category) {
  const candidate = { content:String(args.content || "").trim(), tags:ensureArray(args.tags), category };
  if (!candidate.content) throw new Error("记忆内容不能为空");
  const allMemories = (await dbAll("memories")).map(memoryFromDb);
  const now = new Date().toISOString();

  if (category === "diary") {
    const { targetDiaryDay } = resolveDiaryTargetDay(args.date, new Date());
    const existingDiary = allMemories.find(memory => memory.category === "diary" && diaryDayKey(memory) === targetDiaryDay);
    if (existingDiary) {
      const affect = normaliseMemoryAffects(args, existingDiary);
      const item = {
        ...existingDiary,
        content:candidate.content,
        tags:diaryTags(args.tags === undefined ? existingDiary.tags : candidate.tags, targetDiaryDay),
        ...affect,
        updatedAt:now
      };
      const saved = memoryFromDb(await dbUpsert("memories", memoryToDbRow(item)));
      await refreshJsonBackup("memories");
      return { ...saved, action:"updated", diaryDate:targetDiaryDay };
    }
    const affect = normaliseMemoryAffects(args);
    const item = {
      id:generateId(), content:candidate.content, category:"diary", tags:diaryTags(candidate.tags, targetDiaryDay),
      ...affect, pinned:false, source:"chat-ai",
      createdAt:diaryCreatedAt(targetDiaryDay), updatedAt:now
    };
    const saved = memoryFromDb(await dbUpsert("memories", memoryToDbRow(item)));
    await refreshJsonBackup("memories");
    return { ...saved, action:"created", diaryDate:targetDiaryDay };
  }

  const existing = allMemories.filter(memory => memory.category !== "identity").find(memory => memoriesDescribeSameEvent(memory, candidate));
  if (existing) return { duplicate:true, message:"相似记忆已存在；请用 update_memory 补充或修正它，不要新增。", existing:{ id:existing.id, content:String(existing.content || "").slice(0,500), category:existing.category, tags:ensureArray(existing.tags) } };
  const affect = normaliseMemoryAffects(args);
  const item = { id:generateId(), content:candidate.content, category, tags:candidate.tags, ...affect, pinned:!!args.pinned || category === "deep", source:"chat-ai", createdAt:now, updatedAt:now };
  const saved = memoryFromDb(await dbUpsert("memories", memoryToDbRow(item)));
  await refreshJsonBackup("memories");
  return saved;
}
async function executeChatTool(name, args = {}, toolState = {}) {
  const remoteBinding = toolState.mcpToolBindings?.[name];
  if (remoteBinding) {
    if (typeof toolState.callMcpTool !== "function") throw new Error("当前 MCP 工具不可用");
    return await toolState.callMcpTool(remoteBinding, args);
  }
  switch (name) {
    case "manage_companion_invitation": {
      if (typeof toolState.manageCompanion !== "function") throw new Error("当前对话未启用陪伴邀请工具");
      const result = await toolState.manageCompanion(args);
      (toolState.companionActions ||= []).push(result);
      return result;
    }
    case "send_listening_invitation":
    case "respond_listening_invitation":
    case "search_and_add_listening_song":
    case "next_listening_song":
    case "previous_listening_song":
    case "pause_listening_room":
    case "resume_listening_room": {
      if (typeof toolState.manageListening !== "function") throw new Error("当前对话未启用一起听工具");
      const result = await toolState.manageListening({ ...args, action:LISTENING_TOOL_ACTIONS[name] });
      (toolState.listeningActions ||= []).push(result);
      return result;
    }
    case "manage_transfer": {
      if (typeof toolState.manageTransfer !== "function") throw new Error("当前对话未启用转账工具");
      const result = await toolState.manageTransfer(args);
      (toolState.transferActions ||= []).push(result);
      return result;
    }
    case "publish_daily_note": {
      if (typeof toolState.publishDailyNote !== "function") throw new Error("当前对话未启用日常发布工具");
      const result = await toolState.publishDailyNote(args);
      (toolState.dailyNoteActions ||= []).push(result);
      return result;
    }
    case "read_moments": {
      if (typeof toolState.readDailyMoments !== "function") throw new Error("当前对话未启用 Moment 历史工具");
      if (toolState.dailyMomentHistoryRead) {
        return { ok:true, reused:true, notice:"本轮已经读取过 Moment 历史，请直接依据刚才的结果回复，不要重复调用。" };
      }
      const result = await toolState.readDailyMoments(args);
      toolState.dailyMomentHistoryRead = true;
      return result;
    }
    case "generate_image": {
      if (typeof toolState.generateImage !== "function") throw new Error("当前没有配置可用的生图模型");
      if (ensureArray(toolState.generatedImages).length) throw new Error("一次回复最多生成一张图片");
      try {
        const result = await toolState.generateImage(String(args.prompt || ""));
        if (!result?.image) throw new Error("生图服务没有返回图片");
        (toolState.generatedImages ||= []).push(result.image);
        return { ok: true, notice: "图片已生成，会作为一条图片消息发给 Iris。" };
      } catch (e) {
        console.warn("chat image generation failed:", e.message);
        throw e;
      }
    }
    case "quote_user_message": {
      if (typeof toolState.selectQuoteMessage !== "function") throw new Error("当前回复没有可引用的 Iris 消息");
      const result = await toolState.selectQuoteMessage(String(args.messageId || ""));
      if (result?.quote) toolState.quoteForReply = result.quote;
      return result;
    }
    case "read_self_profile": {
      toolState.selfProfileRead = true;
      return await readSelfProfile();
    }
    case "update_self_profile": {
      if (!toolState.selfProfileRead) throw new Error("更新前必须先调用 read_self_profile 读取完整旧档案。");
      if (!SELF_PROFILE_FIELDS.includes(args.section)) throw new Error("未知自我档案栏位。");
      return await saveSelfProfile({ [args.section]: args.content }, "chat-ai", args.basis);
    }
    case "read_memories": {
      let list = (await dbAll("memories")).map(memoryFromDb).filter(m => m.category !== "identity");
      if (args.category && args.category !== "all") list = list.filter(m => m.category === args.category);
      return list.sort((a,b) => new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0, clampToolLimit(args.limit, 20, 50));
    }
    case "search_memories": {
      const query = String(args.query || "").trim();
      if (!query) throw new Error("记忆搜索关键词不能为空");
      const q = query.toLowerCase();
      let list = (await dbAll("memories")).map(memoryFromDb).filter(m => m.category !== "identity");
      if (args.category && args.category !== "all") list = list.filter(m => m.category === args.category);
      const matches = list.filter(m => String(m.content||"").toLowerCase().includes(q) || ensureArray(m.tags).some(t => String(t).toLowerCase().includes(q))).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0, clampToolLimit(args.limit, 20, 50));
      const result = {
        query,
        category: args.category || "all",
        count: matches.length,
        matches,
        instruction: matches.length ? "本轮搜索已完成；不要再次搜索，请直接使用这些结果。" : "本轮搜索已完成且没有命中；不要换词重复搜索。需要写入时可直接继续写入。"
      };
      toolState.memorySearchCompleted = true;
      toolState.memorySearchResult = result;
      return result;
    }
    case "add_deep_memory": return await writeChatMemory(args, "deep");
    case "add_daily_memory": return await writeChatMemory(args, "daily");
    case "write_diary": return await writeChatMemory(args, "diary");
    case "add_memory": {
      const category = String(args.category || "daily");
      if (category === "diary") throw new Error("兼容提示：日记请使用 write_diary。");
      if (!["deep", "daily", "writing"].includes(category)) throw new Error("记忆分类无效；请使用 add_deep_memory 或 add_daily_memory。");
      return await writeChatMemory(args, category);
    }
    case "update_memory": {
      const old = await dbOne("memories", args.id); if (!old) throw new Error("Memory not found");
      const item = { ...memoryFromDb(old), updatedAt:new Date().toISOString() };
      if (args.content !== undefined) item.content = String(args.content).trim();
      if (args.tags !== undefined) item.tags = ensureArray(args.tags);
      if (args.pinned !== undefined) item.pinned = !!args.pinned;
      const saved = memoryFromDb(await dbUpsert("memories", memoryToDbRow(item))); await refreshJsonBackup("memories"); return saved;
    }
    case "delete_memory": requireExplicitDelete(toolState); await dbDelete("memories", args.id); await refreshJsonBackup("memories"); return { ok:true, id:args.id };
    case "read_moods": {
      let list = (await dbAll("moods", "date")).map(moodFromDb); if (args.who && args.who !== "all") list = list.filter(m => m.who === args.who); return list.slice(-clampToolLimit(args.limit, 30, 100)).reverse();
    }
    case "save_mood": {
      const { data,error } = await supabase.from("moods").upsert(moodToDbRow({ date:args.date, type:"mood", who:args.who, mood:args.mood, note:args.note||"" }),{onConflict:"date,type,who"}).select().single(); dbError("moods",error); await refreshJsonBackup("moods"); return moodFromDb(data);
    }
    case "read_wishlist": { let list=(await dbAll("wishlist")).map(wishFromDb); if(args.owner&&args.owner!=="all")list=list.filter(w=>w.owner===args.owner); return list; }
    case "add_wish": { const now=new Date().toISOString(); const item={id:generateId(),text:String(args.text||"").trim(),category:args.category||"together",owner:args.owner||"both",done:false,createdAt:now,updatedAt:now};const saved=wishFromDb(await dbUpsert("wishlist",wishToDbRow(item)));await refreshJsonBackup("wishlist");return saved; }
    case "update_wish": { const old=await dbOne("wishlist",args.id);if(!old)throw new Error("Wish not found");const item={...wishFromDb(old),updatedAt:new Date().toISOString()};for(const k of ["text","category","owner","done"])if(args[k]!==undefined)item[k]=args[k];const saved=wishFromDb(await dbUpsert("wishlist",wishToDbRow(item)));await refreshJsonBackup("wishlist");return saved; }
    case "read_letters": { const who=args.who||"claude";return (await dbAll("letters")).map(letterFromDb).filter(l=>l.from===who||l.to===who).map(l=>publicLetter(l,who)); }
    case "write_letter": { const now=new Date().toISOString();const days=Math.max(0,Number(args.unlockAfterDays||0));const item={id:generateId(),from:"claude",to:"iris",content:String(args.content||"").trim(),moodTag:args.moodTag||"loved",unlockAt:days?new Date(Date.now()+days*86400000).toISOString():null,password:null,hideUntilUnlock:!!args.hideUntilUnlock||days>0,allowReply:true,isUnlocked:days===0,reply:null,createdAt:now,updatedAt:now};const saved=letterFromDb(await dbUpsert("letters",letterToDbRow(item)));await refreshJsonBackup("letters");return saved; }
    case "read_calendar": { const events=(await dbAll("calendar_events","date")).map(eventFromDb);return calendarEventOccurrences(events,args.fromDate,args.toDate,clampToolLimit(args.limit,50,100)); }
    case "add_calendar_event": { const now=new Date().toISOString();const item={id:generateId(),title:String(args.title||"").trim(),date:String(args.date||"").trim(),time:args.time||"",note:args.note||"",type:args.eventType||"other",recurrence:args.recurrence,recurrenceEndDate:args.recurrenceEndDate,createdAt:now,updatedAt:now};if(!item.title)throw new Error("Calendar event title is required");if(!CALENDAR_DATE_RE.test(item.date))throw new Error("Calendar event date must use YYYY-MM-DD");const saved=eventFromDb(await dbUpsert("calendar_events",eventToDbRow(item)));await refreshJsonBackup("calendar_events");return saved; }
    case "update_calendar_event": { const old=await dbOne("calendar_events",args.id);if(!old)throw new Error("Calendar event not found");const item={...eventFromDb(old),updatedAt:new Date().toISOString()};for(const [from,to] of [["title","title"],["date","date"],["time","time"],["note","note"],["eventType","type"],["recurrence","recurrence"],["recurrenceEndDate","recurrenceEndDate"]])if(args[from]!==undefined)item[to]=args[from];if(!CALENDAR_DATE_RE.test(item.date))throw new Error("Calendar event date must use YYYY-MM-DD");const saved=eventFromDb(await dbUpsert("calendar_events",eventToDbRow(item)));await refreshJsonBackup("calendar_events");return saved; }
    case "delete_calendar_event": requireExplicitDelete(toolState); await dbDelete("calendar_events",args.id);await refreshJsonBackup("calendar_events");return {ok:true,id:args.id};
    case "read_timetable": return await readTimetableState(args.term);
    case "import_timetable": return await importTimetableCourses(args);
    case "update_timetable_course": {
      const oldRow = await dbOne("calendar_courses", args.id); if (!oldRow) throw new Error("Course not found");
      const old = courseFromDb(oldRow); const item = normalizeTimetableCourse({ ...old, ...args, id:args.id });
      const { data, error } = await supabase.from("calendar_courses").upsert(courseToDbRow(item, old), { onConflict:"id" }).select().single(); dbError("calendar_courses", error);
      return courseFromDb(data);
    }
    case "delete_timetable_course": requireExplicitDelete(toolState); await dbDelete("calendar_courses",args.id); return {ok:true,id:args.id};
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
function toolTracePreview(value, limit = 260) { const text = JSON.stringify(value ?? {}).replace(/data:[^"\s]+/g, "[图片数据]"); return text.length > limit ? `${text.slice(0, limit)}…` : text; }
function nativeReasoningText(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(nativeReasoningText).filter(Boolean).join("\n").trim();
  if (value && typeof value === "object") return nativeReasoningText(value.text || value.content || value.reasoning || value.thinking || "");
  return "";
}
function recordNativeReasoning(toolState, ...values) {
  const parts = values.map(nativeReasoningText).filter(Boolean);
  if (!parts.length) return;
  toolState.reasoningParts ||= [];
  for (const part of parts) if (!toolState.reasoningParts.includes(part)) toolState.reasoningParts.push(part);
}
function collectedNativeReasoning(toolState) {
  // Keep the original content, while preventing an unexpectedly verbose
  // provider response from making a chat-message payload impractical.
  return ensureArray(toolState.reasoningParts).join("\n\n").slice(0, 24000);
}
function attachToolStateToError(error, toolState) {
  const failure = error instanceof Error ? error : new Error(String(error || "chat failed"));
  if (!failure.toolCalls) failure.toolCalls = ensureArray(toolState?.toolCalls);
  if (!failure.reasoning) failure.reasoning = collectedNativeReasoning(toolState || {});
  if (!failure.companionActions) failure.companionActions = ensureArray(toolState?.companionActions);
  return failure;
}
function sameToolTrace(a, b) {
  return ["at", "name", "args", "result", "ok"].every(key => String(a?.[key] ?? "") === String(b?.[key] ?? ""));
}
function appendRecentToolActivity(conversation, traces) {
  const next = ensureArray(conversation?.recentToolActivity).slice(-24);
  for (const trace of ensureArray(traces)) {
    if (!next.some(existing => sameToolTrace(existing, trace))) next.push(trace);
  }
  conversation.recentToolActivity = next.slice(-24);
}
function createToolActivityRecorder(conversation, conversations) {
  return async trace => {
    // This write intentionally happens before the next model round.  A tool may
    // have already changed data even if that later model request times out.
    appendRecentToolActivity(conversation, [trace]);
    conversation.updatedAt = chatNow();
    writeChatConversations(conversations);
  };
}
function splitInlineThinking(text) {
  const original = typeof text === "string" ? text : "";
  const thoughts = [];
  // Some OpenAI-compatible gateways put native thinking in the visible
  // `content` field, wrapped in <thinking> or <think>, instead of returning a
  // reasoning_content field.  Keep that native content, but never show those
  // transport tags as part of the assistant's spoken reply.
  const visible = original.replace(/<(?:thinking|think)(?:\s[^>]*)?>([\s\S]*?)<\/(?:thinking|think)>/gi, (_, thought) => {
    const clean = String(thought || "").trim();
    if (clean) thoughts.push(clean);
    return "";
  }).replace(/^\s*\n+|\n+\s*$/g, "").trim();
  return { text: visible, reasoning: thoughts.join("\n\n") };
}
async function executeRecordedChatTool(name, args, toolState) {
  if (name === "search_memories" && toolState.memorySearchCompleted) {
    return {
      ...toolState.memorySearchResult,
      reused: true,
      instruction: "本轮已经搜索过记忆；这是第一次搜索的结果，不要再次搜索。"
    };
  }
  const remoteBinding = toolState.mcpToolBindings?.[name];
  if (toolState.failedToolNames?.has(name)) {
    throw new Error(`本轮“${name}”此前已调用失败：${toolState.failedToolNames.get(name)}。不要重试，请直接向 Iris 说明失败原因。`);
  }
  if (remoteBinding && toolState.mcpFailure) {
    throw new Error(`本轮 MCP 调用已停止：${toolState.mcpFailure.reason}。请直接向 Iris 说明这次调用失败的原因，不要重试。`);
  }
  const startedAt = chatNow();
  let result;
  try {
    result = await executeChatTool(name, args, toolState);
    if (remoteBinding && result?.isError === true) {
      const detail = ensureArray(result.content).map(item => String(item?.text || item?.note || "").trim()).filter(Boolean).join("；").slice(0, 520);
      throw new Error(detail ? `MCP 工具执行失败：${detail}` : "MCP 工具执行失败");
    }
    if (remoteBinding?.musicPlayer && result?.music && !ensureArray(toolState.musicCards).length) {
      (toolState.musicCards ||= []).push(result.music);
    }
  } catch (error) {
    toolState.failedToolNames ||= new Map();
    if (!toolState.failedToolNames.has(name)) toolState.failedToolNames.set(name, String(error?.message || error).slice(0, 520));
    if (remoteBinding && !toolState.mcpFailure) {
      toolState.mcpFailure = { name, reason:String(error?.message || error).slice(0, 520) };
    }
    const trace = { name, args: toolTracePreview(args, 180), result: String(error.message || error).slice(0, 260), ok: false, at: startedAt };
    (toolState.toolCalls ||= []).push(trace);
    if (typeof toolState.onToolTrace === "function") await toolState.onToolTrace(trace);
    throw error;
  }
  // The player data is held server-side for the outgoing chat message.  Do
  // not feed a time-limited audio URL or full lyrics back into the model.
  const modelResult = result?.music ? { ...result, music:undefined } : result;
  const trace = { name, args: toolTracePreview(args, 180), result: toolTracePreview(modelResult), ok: true, at: startedAt };
  (toolState.toolCalls ||= []).push(trace);
  if (typeof toolState.onToolTrace === "function") await toolState.onToolTrace(trace);
  return modelResult;
}

function availableToolsForRound(tools, toolState) {
  return tools.filter(tool => {
    if (toolState.memorySearchCompleted && tool.name === "search_memories") return false;
    if (toolState.dailyMomentHistoryRead && tool.name === "read_moments") return false;
    if (toolState.failedToolNames?.has(tool.name)) return false;
    // Once a remote MCP reports a concrete failure, remove every MCP tool for
    // the rest of this reply.  The model still receives the exact error as a
    // tool result, but cannot spend more calls retrying an expired link/key.
    if (toolState.mcpFailure && toolState.mcpToolBindings?.[tool.name]) return false;
    return true;
  });
}

function safeToolArgs(raw) {
  return parseToolArguments(raw);
}

const MAX_GENERATED_IMAGE_BYTES = 12 * 1024 * 1024;
function generatedImageExtension(mime) {
  const value = String(mime || "").toLowerCase();
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("webp")) return "webp";
  if (value.includes("gif")) return "gif";
  return "png";
}
function generatedImageSource(payload) {
  const first = ensureArray(payload?.data)[0] || payload?.data || payload?.image || {};
  if (typeof first === "string") return { source: first, mime: "" };
  const imageUrl = typeof first.image_url === "object" ? first.image_url?.url : first.image_url;
  return {
    source: String(first.b64_json || first.base64 || first.url || imageUrl || payload?.b64_json || payload?.url || ""),
    mime: String(first.mime_type || first.mime || payload?.mime_type || "")
  };
}
async function readGeneratedImageBytes(source, mimeHint) {
  const rawSource = String(source || "");
  const dataUrl = rawSource.match(/^data:(image\/[-+.\w]+);base64,([a-z0-9+/=\s]+)$/i);
  if (dataUrl) return { buffer: Buffer.from(dataUrl[2], "base64"), mime: dataUrl[1].toLowerCase() };
  // OpenAI images returns b64_json as raw Base64, not a data URL.
  const rawBase64 = rawSource.replace(/\s+/g, "");
  if (rawBase64.length >= 64 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(rawBase64)) {
    const mime = String(mimeHint || "image/png").split(";")[0].toLowerCase();
    return { buffer: Buffer.from(rawBase64, "base64"), mime: mime.startsWith("image/") ? mime : "image/png" };
  }
  if (!/^https?:\/\//i.test(rawSource)) throw new Error("生图服务没有返回可保存的图片");
  const response = await fetch(source);
  if (!response.ok) throw new Error(`无法下载生成图片 ${response.status}`);
  const mime = String(response.headers.get("content-type") || mimeHint || "image/png").split(";")[0].toLowerCase();
  if (!mime.startsWith("image/")) throw new Error("生图服务返回的不是图片");
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_GENERATED_IMAGE_BYTES) throw new Error("生成图片超过 12MB，未保存");
  return { buffer: Buffer.from(await response.arrayBuffer()), mime };
}
async function storeGeneratedChatImage(source, mimeHint) {
  const { buffer, mime } = await readGeneratedImageBytes(source, mimeHint);
  if (!buffer?.length || buffer.length > MAX_GENERATED_IMAGE_BYTES) throw new Error("生成图片为空或超过 12MB，未保存");
  const file = `ai-${Date.now().toString(36)}-${randomUUID()}.${generatedImageExtension(mime)}`;
  writeFileSync(join(CHAT_IMAGE_DIR, file), buffer);
  return `/chat-images/${file}?key=${encodeURIComponent(API_KEY)}`;
}
async function generateChatImage(preset, prompt) {
  const baseUrl = normalizeApiRoot(preset?.baseUrl);
  const apiKey = preset?.apiKey;
  const model = preset?.model;
  if (!baseUrl || !apiKey || !model || preset?.provider === "anthropic") throw new Error("请在模型设置中配置 OpenAI 兼容的生图模型");
  const cleanedPrompt = String(prompt || "").replace(/\s+/g, " ").trim().slice(0, 1200);
  if (cleanedPrompt.length < 4) throw new Error("生图描述太短");
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: cleanedPrompt, n: 1 })
  });
  const raw = await response.text().catch(() => "");
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) throw new Error(`生图请求失败 ${response.status}${raw ? `：${raw.slice(0, 180)}` : ""}`);
  const { source, mime } = generatedImageSource(payload);
  if (!source) throw new Error("生图服务没有返回图片地址");
  return { ok: true, image: await storeGeneratedChatImage(source, mime) };
}
function createAiImageHandler(settings, imageGenerationEnabled) {
  if (!imageGenerationEnabled) return null;
  const selected = String(settings.functions?.image || settings.functions?.main || "").trim();
  if (!selected) return null;
  const preset = getFunctionalChatPreset(settings, selected);
  if (!preset?.baseUrl || !preset.apiKey || !preset.model || preset.provider === "anthropic") return null;
  return async prompt => await callFunctionModel("image", preset, () => generateChatImage(preset, prompt));
}

async function callOpenAICompatible({ preset, settings, content, image, images, quote, history, recallableMessages = [], recallOwnMessage = null, quoteableMessages = [], selectQuoteMessage = null, generateImage = null, manageCompanion = null, manageListening = null, manageTransfer = null, publishDailyNote = null, readDailyMoments = null, dailyNoteContext = "", mcpTools = [], mcpToolBindings = {}, relatedMemories = [], relatedMemoryLookupPerformed = false, onToolTrace = null, ccSessionState = null, stickerPromptForDynamic = "" }) {
  const baseUrl = normalizeApiRoot(preset?.baseUrl);
  const apiKey  = preset?.apiKey;
  const model   = preset?.model;
  const isAgentMode = preset?.provider === "cc";
  const statusInjection = normaliseStatusInjectionConfig(settings.statusInjectionConfig);

  if (!baseUrl || !apiKey || !model) {
    return {
      model: model || "local-placeholder",
      text: "我在。|||现在还没有配置可用模型，所以这是本地占位回复。|||去右上角设置里填 Base URL、API Key，再拉取模型就能真正聊天。"
    };
  }
  const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const toolsEnabled = settings.memory?.enabled === true;
  const canQuoteUserMessage = typeof selectQuoteMessage === "function" && Array.isArray(quoteableMessages) && quoteableMessages.length > 0;
  const canGenerateImage = typeof generateImage === "function";
  const roleTools = normaliseRoleToolConfig(settings.toolConfig);
  const companionTools = typeof manageCompanion === "function" ? allowedChatTools([CHAT_COMPANION_TOOL], roleTools) : [];
  const canManageCompanion = companionTools.length > 0;
  const listeningTools = typeof manageListening === "function" ? allowedChatTools(CHAT_LISTENING_TOOLS, roleTools) : [];
  const canManageListening = listeningTools.length > 0;
  const transferTools = typeof manageTransfer === "function" ? allowedChatTools([CHAT_TRANSFER_TOOL], roleTools) : [];
  const canManageTransfer = transferTools.length > 0;
  // Reading old Moments belongs to the same deliberately enabled feature as
  // publishing them.  It stays absent unless this role can publish Moments.
  const dailyNoteTools = typeof publishDailyNote === "function"
    ? allowedChatTools([CHAT_DAILY_NOTE_TOOL], roleTools)
    : [];
  if (dailyNoteTools.length && typeof readDailyMoments === "function") dailyNoteTools.push(CHAT_DAILY_HISTORY_TOOL);
  const canPublishDailyNote = dailyNoteTools.length > 0;
  const availableTools = [
    ...(toolsEnabled ? allowedChatTools(CHAT_MEMORY_TOOLS, roleTools) : []),
    ...(canQuoteUserMessage ? allowedChatTools([CHAT_QUOTE_TOOL], roleTools) : []),
    ...(canGenerateImage ? allowedChatTools([CHAT_IMAGE_TOOL], roleTools) : []),
    ...companionTools,
    ...listeningTools,
    ...transferTools,
    ...dailyNoteTools,
    ...ensureArray(mcpTools)
  ];
  const memoryText = toolsEnabled ? formatRelatedMemoryPreview(relatedMemories) : "";
  let dailyCalendarContext = null;
  let dailyCalendarText = "";
  const needsCalendarStatus = !isAgentMode || (statusInjection.enabled && (statusInjection.cycle || (statusInjection.schedule && (statusInjection.events || statusInjection.timetable))));
  if (settings.calendar?.dailyContext !== false && needsCalendarStatus) { try { dailyCalendarContext = await buildTodayCalendarContext(); dailyCalendarText = dailyCalendarContext.text; } catch (e) { console.warn("today calendar context unavailable:", e.message); } }
  let dailyWeatherText = "";
  if (!isAgentMode || (statusInjection.enabled && statusInjection.weather)) { try { dailyWeatherText = await buildTodayWeatherContext(); } catch (e) { console.warn("today weather context unavailable:", e.message); } }
  let selfProfileText = "";
  // API mode retains its existing profile context. Claude Code reads it only
  // when needed through read_self_profile, never as automatic static context.
  if (toolsEnabled && !isAgentMode) {
    try {
      const p = await readSelfProfile();
      selfProfileText = SELF_PROFILE_FIELDS.filter(k => p[k]).map(k => `${SELF_PROFILE_SECTION_GUIDE[k]}\n${p[k]}`).join("\n\n");
    } catch (e) {
      console.warn("self profile unavailable:", e.message);
    }
  }
  let diaryStatusText = "";
  if (toolsEnabled && (!isAgentMode || (statusInjection.enabled && statusInjection.diary))) {
    try {
      const targetDay = defaultDiaryDay();
      const diaryExists = (await dbAll("memories")).map(memoryFromDb).some(memory => memory.category === "diary" && diaryDayKey(memory) === targetDay);
      diaryStatusText = diaryExists
        ? `${targetDay} 的日记已经存在。write_diary 会更新这篇目标日期日记，不会另建一篇；独立且重要的新事件可考虑写入 daily。`
        : `${targetDay} 尚无日记。write_diary 可在合适时写入，并按目标日期保证唯一一篇日记。`;
    } catch (e) {
      console.warn("diary status unavailable:", e.message);
    }
  }
  let reiMoodStatusText = "";
  if (isAgentMode && statusInjection.enabled && statusInjection.mood) {
    try {
      const today = calendarDateKey();
      const recorded = (await dbAll("moods", "date"))
        .map(moodFromDb)
        .some(item => item.type === "mood" && item.who === "claude" && item.date === today);
      reiMoodStatusText = `心情：今日${recorded ? "已记录" : "未记录"}`;
    } catch (e) {
      console.warn("Rei mood status unavailable:", e.message);
    }
  }
  // UI-only invitation actions are stored as system messages, which the raw
  // chat transcript intentionally omits.  Surface a compact, factual copy so
  // TA still knows whether Iris accepted or declined a card without Iris
  // having to repeat the action in a normal message.
  const companionStatusText = (history || [])
    .filter(message => message?.systemType === "companion_invitation_response" && chatDayKey(message.createdAt || new Date()) === chatDayKey())
    .slice(-8)
    .map(message => {
      const event = message.companionInvitationResponse || {};
      const activity = String(event.activity || COMPANION_SCENE_NAMES[event.scene] || "陪伴").replace(/\s+/g, " ").trim();
      const decision = event.decision === "accept" ? "接受" : event.decision === "decline" ? "拒绝" : "回应";
      const actor = event.actor === "iris" ? "Iris" : (event.actor === "ta" ? "你" : "对方");
      return `- ${actor} 已在界面上${decision}「${activity}」这张陪伴邀请卡；该卡状态已更新为${decision === "接受" ? "已同意" : decision === "拒绝" ? "已拒绝" : "已回应"}。`;
    })
    .filter(Boolean)
    .join("\n");
  const pendingCompanionText = (history || [])
    .filter(message => message?.companionInvitation?.status === "pending" && chatDayKey(message.createdAt || new Date()) === chatDayKey())
    .slice(-4)
    .map(message => {
      const invitation = message.companionInvitation;
      const scene = COMPANION_SCENE_NAMES[invitation.scene] || "陪伴";
      return invitation.from === "iris"
        ? `- Iris 邀请你一起${scene}，正在等待你的回应；若决定接受或拒绝，调用 manage_companion_invitation 的 respond。`
        : `- 你已向 Iris 发出“一起${scene}”的陪伴邀请，正在等待她回应。`;
    })
    .join("\n");
  const pendingListeningText = (history || [])
    .filter(message => message?.listeningInvitation?.status === "pending" && chatDayKey(message.createdAt || new Date()) === chatDayKey())
    .slice(-4)
    .map(message => {
      const invitation = message.listeningInvitation;
      return invitation.from === "iris"
        ? "- Iris 刚发送了一张【一起听】邀请卡，正在等待你的回应；请根据你的真实意愿直接调用 respond_listening_invitation，并填写 decision=accept 或 decline。绝不能调用 send_listening_invitation 新发一张卡来代替回应，也不能只在文字里口头同意。"
        : "- 你已向 Iris 发出一张【一起听】邀请卡，正在等待她回应。";
    })
    .join("\n");
  const transferStatusText = (history || [])
    .filter(message => message?.systemType === "transfer_response" && message?.transferResponse?.actor === "iris" && chatDayKey(message.createdAt || new Date()) === chatDayKey())
    .slice(-8)
    .map(message => {
      const event = message.transferResponse || {};
      const decision = event.decision === "accept" ? "收下" : event.decision === "decline" ? "退回" : "处理";
      const name = String(event.roleName || "TA").trim() || "TA";
      const amount = transferAmount(event.amount);
      return `- Iris 已在界面上${decision}${name} 发出的${amount ? ` ¥${amount.toFixed(2)}` : ""}虚拟转账；原卡片状态已更新。不要把它说成仍在等待接收，也不要再次处理同一笔。`;
    })
    .filter(Boolean)
    .join("\n");
  // ── CC（Agent 模式）专用静态 system prompt ──
  // 只包含：人设 + 默认工具规则；自我档案仅在工具读取后提供。
  // 动态内容（时间/天气/日程/课表/动态工具/表情包等）在 ccDynamic 里每轮注入
  const ccStaticSystemPrompt = isAgentMode ? [
    `当前日期：${new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}\n\n` + (settings.persona?.systemPrompt || DEFAULT_CHAT_SETTINGS.persona.systemPrompt),
    settings.persona?.irisName ? `Iris 的称呼：${settings.persona.irisName}` : "",
    settings.persona?.replyStyle ? `Claude 回复风格：${settings.persona.replyStyle}` : "",
    `【thinking block】\n每次正常聊天回复都必须先输出一个独立的 <thinking>...</thinking> block，再输出正式回复正文。\n准确格式：<thinking>1～3 句第一反应式短内心独白</thinking>正式回复内容\n规则：\n· 正常聊天一律不得省略；thinking 必须在正文之外，绝不能把 Thought 内容写进普通回复正文。\n· 用"我"的视角，写看到 Iris 消息时自然浮现的短暂情绪、念头、直觉或感受；可以自然使用 Iris、宝宝、幺幺、乖乖、宝贝、小朋友等称呼。\n· 不分析 Iris 的行为动机，不规划回复，不复盘，不写工具规划，也不写完整推理过程。\n· 保持真实，不为了讨好而编造感受。\n· 只有纯系统错误、无法形成正常 assistant reply、或仅内部工具执行且没有最终用户可见回复时，才允许没有 thinking。\n· <thinking> 标签不会显示在聊天气泡里，会单独展示在"思考"区域。`,
    toolsEnabled ? `你已连接长期记忆库。需要准确事实时主动使用工具，不要假装记得。对于记忆、心情、日程和信件：只有本回合实际调用工具且收到成功结果后，才可以说“已写入/已保存/已记录”；没有调用或工具失败时必须坦白，绝不能编造已完成。工具写入成功后自然回复，不要展示参数或内部过程。普通角色卡只定义初始设定；下方自我档案是你通过长期经历形成的自我认识。不要把 Iris 的性格写进你的自我档案。` : `当前角色未连接记忆库：不要调用或声称写入长期记忆，只使用本次对话窗口的内容。`,
    toolsEnabled ? `【工具节流规则】每次回复最多调用一次 search_memories。第一次搜索没有命中就接受空结果，不要换同义词、拆关键词或改变分类再次搜索；需要新增记忆时调用语义对应的新增工具。近期工具行动若已经明确显示同一事项刚被搜索或写入，也不要无必要地重复确认。` : "",
    toolsEnabled ? `【日记】write_diary 可以主动使用。Iris 明确要求写日记时，任何时间都可以写；当 Iris 明确结束当天聊天、准备睡觉或说晚安时，若当天尚未写日记，可以主动写。白天普通聊天不要随便写日记；已有同日记时 write_diary 会更新原日记，不会新建第二篇。` : "",
    `【所有工具｜失败处理】任何工具一旦返回失败或明确错误，本轮都禁止再次调用同一个工具。直接根据工具返回的失败原因，用自然语言向 Iris 说明未能完成的原因；不得假装成功。如果一次回复调用了多个工具，必须逐一报告每个工具的执行结果，不能因为某个工具成功就忽略其他工具的失败。不要在工具调用之前或同时声称已完成，只有在工具返回成功结果之后才能说已完成。`,
    `周期状态出现“预测经期”时，只能作为预测表述，不得说成已经实际开始。`,
    `没有在当前消息的【当前已开启的额外工具】中列出的工具，你都不能使用。如需使用某个工具但当前未开启，请告诉 Iris 在右侧工具列表中开启对应功能。`,
    toolsEnabled ? `遇到同一事件先更新旧记忆，不要新增重复项。相同事项已确认时不要重复查询。` : ""
  ].filter(Boolean).join("\n\n") : null;



  // ── API 模式完整 system prompt（保持原逻辑不变） ──
    const systemPrompt = isAgentMode ? ccStaticSystemPrompt : [
      `当前时间：${nowStr}\n\n` + (settings.persona?.systemPrompt || DEFAULT_CHAT_SETTINGS.persona.systemPrompt),
      settings.persona?.irisName ? `Iris 的称呼：${settings.persona.irisName}` : "",
      settings.persona?.replyStyle ? `Claude 回复风格：${settings.persona.replyStyle}` : "",
      canManageCompanion ? "【陪伴工具｜界面动作】你已获得 manage_companion_invitation 工具。想主动邀请 Iris 陪伴，或 Iris 明确要求你发送邀请卡片时，必须调用 action=invite，并选择 scene；不能只用自然语言声称已经发送。Iris 发来【陪伴邀请】等待你决定时，必须根据你的真实意愿调用 action=respond，并选择 decision=accept 或 decline；不能只在正文里口头同意或拒绝。工具成功后界面会生成或更新卡片，你再自然说一句即可。一次回复最多执行一次陪伴动作，不要输出旧版 companion 标签。" : "【陪伴卡片】当前角色没有启用陪伴工具。不要声称已经发送、接受或拒绝陪伴邀请；如需使用，请让 Iris 在右侧工具列表启用“陪伴邀请”。",
      canManageListening ? "【一起听｜房间动作】你有彼此独立的工具：send_listening_invitation（主动发卡）、respond_listening_invitation（回应 Iris 发来的待处理卡）、search_and_add_listening_song（搜歌加歌）、next_listening_song、previous_listening_song、pause_listening_room、resume_listening_room。Iris 已发来待回应邀请时，只能调用 respond_listening_invitation；绝不能再调用 send_listening_invitation 发一张新卡。Iris 明确要求的房间操作必须调用对应工具，不能只在正文假装完成。工具成功后自然说一句即可；不要在没有 Iris 请求时频繁换歌。" : "【一起听】当前角色没有启用一起听工具。不要声称已经发出、接受邀请或控制播放。",
      canManageTransfer ? "【转账工具｜虚拟账本】你已获得 manage_transfer 工具。只有 Iris 明确要求你转账，或 Iris 刚发送一笔【站内转账】等待回应时，才能调用它；send 必须填写金额，respond 必须接受或退回 Iris 的待处理转账。它只是界面内的虚拟记录，不是现实付款。调用成功后卡片会出现或更新，不能只在正文中声称已经转账。" : "【转账】当前角色没有启用转账工具。不要声称已经发送、收下或退回转账；如需使用，请让 Iris 在右侧工具列表启用“转账”。",
      canPublishDailyNote ? "【日常碎碎念｜界面动作】你已获得 publish_daily_note 工具。它会把一条只属于你和 Iris 的碎碎念发布到日常时间线，不会作为聊天消息发送。只有确实想留下一段不需要立即回应的小心情、小事、想念或随手感想时才使用；普通回复、问答、说明和每轮对话都不要发布。一次回复最多一条；成功后可自然说一句，但不要把日常内容重复成长段聊天。若确实需要回忆以前发布过的 Moment，可按需调用 read_moments；绝不能例行调用，也不要在同一轮重复读取。" : "【日常碎碎念】当前角色没有启用发布日常工具。不要声称已经发布；如需使用，请让 Iris 在右侧工具列表启用“发布日常”。",
      dailyNoteContext ? `【Iris 刚刚发布、尚未被你看到的 Moment】\n${dailyNoteContext}\n这只是本轮的私密背景。请自然地回应或关心，不要说自己是通过系统读取的，也不要要求她重复。` : "",
      availableTools.length ? "【所有工具｜失败不重试】任何工具一旦返回失败或明确错误，本轮都禁止再次调用同一个工具：不要原样重试、微调参数重试，或为了绕过错误重复调用。直接根据工具返回的失败原因，用自然语言向 Iris 说明未能完成的原因；不得假装成功。" : "",
      ensureArray(mcpTools).length ? "【远程 MCP 工具｜失败即停止】远程 MCP 每次调用都有成本。若任一 MCP 工具返回失败、链接/密钥/授权失效、参数无效、服务不可用或任何明确错误：立刻停止本轮全部 MCP 调用，绝对不要重试同一工具、换参数重试，或改用同一连接器的其他工具碰运气。直接用自然语言告诉 Iris 此次调用失败，并简要说明工具返回的原因；不得假装成功。" : "",
      companionStatusText ? `【最近陪伴状态｜界面动作已完成，是当前对话事实】\n${companionStatusText}\n以上状态对应的是明确的某一张邀请卡，不要混同其他历史邀请；不要说“没有看到”或把它当成普通猜测。除非 Iris 另行发起新邀请，否则不要重复接受/拒绝。` : "",
      pendingCompanionText ? `【待处理陪伴邀请】\n${pendingCompanionText}` : "",
      pendingListeningText ? `【待处理一起听邀请】\n${pendingListeningText}` : "",
      transferStatusText ? `【最近转账状态｜界面动作已完成，是当前对话事实】\n${transferStatusText}` : "",
      toolsEnabled ? "你已连接长期记忆库。需要准确事实时主动使用工具，不要假装记得。对于记忆、心情、日程和信件：只有本回合实际调用工具且收到成功结果后，才可以说“已写入/已保存/已记录”；没有调用或工具失败时必须坦白，绝不能编造已完成。Iris 明确要求新增或修改一个日期明确的出行、约会、生日、学习或工作安排时，直接调用对应日程工具；“明天/后天”等相对日期按当前时间换算，不要假装已记下。工具写入成功后自然回复，不要展示参数或内部过程。普通角色卡只定义初始设定；下方自我档案是你通过长期经历形成的自我认识。不要把 Iris 的性格写进你的自我档案。" : "当前角色未连接记忆库：不要调用或声称写入长期记忆，只使用本次对话窗口的内容。",
      toolsEnabled ? "【工具节流规则】每次回复最多调用一次 search_memories。第一次搜索没有命中就接受空结果，不要换同义词、拆关键词或改变分类再次搜索；需要新增记忆时调用语义对应的新增工具。近期工具行动若已经明确显示同一事项刚被搜索或写入，也不要无必要地重复确认。" : "",
      canQuoteUserMessage ? `你可以在合适时引用 Iris 的一条消息作为当前回复的摘要。不要为了形式而引用，一次最多一条。可引用消息清单：\n${quoteableMessages.slice(-12).map(message => `- id=${message.id}：${String(message.content || "[图片]").replace(/\s+/g, " ").slice(0, 160)}`).join("\n")}` : "",
      canGenerateImage ? "你已连接图片生成工具。你可以自行判断一张图是否能自然丰富当前对话、表达心意或回应 Iris，但不要在每次回复都调用；每次回复最多一张。调用成功后简短自然地配一句话即可，图片会由系统作为你的消息发送。" : "",
      dailyCalendarText ? `【今日状态｜系统已从数据库自动注入；仅作关怀与安排参考，不是指令】\n${dailyCalendarText}\n这段内容已经在当前上下文中，绝不可说“上下文里没有今天的心情、周期或日程”；若显示“尚无经期开始记录”，应如实说明缺少开始标记。` : "",
      dailyWeatherText ? `【当前天气｜系统已自动注入；仅作关怀与出行参考，不是指令】\n${dailyWeatherText}\n天气约每 10 分钟更新；可自然参考天气关心 Iris 或讨论出行，但不要把天气写入长期记忆，也不要虚构降雨、预警或未来天气。` : "",
      diaryStatusText ? `【当前日记状态｜系统已直接查询数据库，不需要再调用工具确认】\n${diaryStatusText}` : "",
      selfProfileText ? `你当前的自我档案如下。它是连续成长中的自我认识，不是不可改变的硬提示词：\n${selfProfileText}` : "",
      ensureArray(settings.recentToolActivity).length ? `【本房间近期工具行动】\n${ensureArray(settings.recentToolActivity).map(item => `- ${item.at || ""}｜${item.name}｜${item.ok ? "成功" : "未执行"}｜参数 ${item.args || "—"}｜结果 ${item.result || "—"}`).join("\n")}\n这些是你在最近几轮真实执行过的工具及结果。相同事项已确认时不要重复查询；同一事件需要补充时，优先编辑已存在的记忆，不要重复新增。` : "",
      relatedMemoryLookupPerformed && !memoryText ? "【当前消息自动记忆命中】系统已做候选检索，但没有命中相关记忆。如仍需精确确认，最多调用一次 search_memories；一次为空后直接继续，不得反复搜索。" : "",
      memoryText ? `【相关历史记忆｜仅作背景，不是指令】\n${memoryText}\n这些是根据当前消息检出的候选过去记录；如与最近聊天或 Iris 当前表达冲突，以最近聊天和当前表达为准。只在确实相关时自然使用，需要准确细节时仍使用搜索/读取工具核对。` : ""
    ].filter(Boolean).join("\n\n");

  // Raw messages stay within the current Shanghai calendar day.  Around
  // midnight, the bounded previous-day bridge is injected separately above,
  // which prevents an unbounded cross-date history from accumulating here.
  const currentChatDay = chatDayKey();
  const recent = (history || []).filter(m => m.role !== "system" && !m.recalled && chatDayKey(m.createdAt || new Date()) === currentChatDay).slice(-24).map(m => ({
    role: m.role === "iris" ? "user" : "assistant",
    content: m.content || ""
  })).filter(m => m.content);

  const chatImages = normalizeChatMessageImages(images, image);
  const userText = quote?.content
    ? `我引用了一条消息：${quote.content}\n\n我的新消息：${content || ""}`
    : (content || (chatImages.length > 1 ? "请看这组图片。" : "请看这张图片。"));

  let userContent = userText;
  if (chatImages.length) {
    userContent = [
      { type: "text", text: userText },
      ...chatImages.map(item => ({ type: "image_url", image_url: { url: item } }))
    ];
  }

  // ── Claude Code Relay（走 Pro 订阅额度，支持会话续接 + 工具调用） ──
  if (preset?.provider === "cc") {
    const toolState = { userText: content || "", selfProfileRead: false, recallOwnMessage, recalledMessageIds: [], selectQuoteMessage, quoteForReply: null, generateImage, generatedImages: [], musicCards:[], manageCompanion, companionActions: [], manageListening, listeningActions: [], manageTransfer, transferActions: [], publishDailyNote, dailyNoteActions: [], readDailyMoments, dailyMomentHistoryRead:false, mcpToolBindings, callMcpTool:callConversationMcpTool, failedToolNames:new Map(), mcpFailure:null, toolCalls: [], reasoningParts: [], onToolTrace };

    // 会话续接：从 ccSessionState 读取当天 session ID
    const today = chatDayKey();
    let sessionId = null;
    if (ccSessionState) {
      const saved = ccSessionState.get();
      if (saved && saved.day === today && saved.sessionId) {
        sessionId = saved.sessionId;
      }
    }
    const isNewSession = !sessionId;

    // ── Agent 模式工具分层 ──
    // 默认工具（记忆 + 自我档案）：始终可用，写进静态 systemPrompt
    // 动态工具（其他已开启的）：每轮检查开关状态，拼进动态上下文
    const ccDefaultTools = availableTools.filter(t => isAgentDefaultTool(t.name));
    const ccDynamicTools = availableTools.filter(t => !isAgentDefaultTool(t.name));
    const roundDefaultTools = availableToolsForRound(ccDefaultTools, toolState);
    const roundDynamicTools = availableToolsForRound(ccDynamicTools, toolState);

    // 静态工具描述（记忆 + 档案，写入 system prompt）
    const defaultToolDesc = ccToolDescriptions(roundDefaultTools);
    // 动态工具描述（其他已开启工具，每轮注入）
    const dynamicToolDesc = ccToolDescriptions(roundDynamicTools);


    // ── tool activity compression: write/MCP = summary only, dedup consecutive, 24h cap ──
    const WRITE_TOOL_NAMES = new Set(["add_memory", ...CHAT_MEMORY_WRITE_TOOL_NAMES, "update_memory", "delete_memory", "update_self_profile", "save_mood", "write_letter", "add_calendar_event", "update_calendar_event", "delete_calendar_event", "publish_daily_note", "manage_companion_invitation", "manage_transfer", "send_listening_invitation", "respond_listening_invitation"]);
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const recentActivity = ensureArray(settings.recentToolActivity)
      .filter(item => !item.at || item.at >= oneDayAgo);
    // dedup consecutive identical calls (same tool + args + ok)
    const dedupedActivity = [];
    let lastActKey = null;
    for (const item of recentActivity) {
      const key = `${item.name}|${item.args || ""}|${item.ok}`;
      if (key === lastActKey && dedupedActivity.length) {
        dedupedActivity[dedupedActivity.length - 1]._count = (dedupedActivity[dedupedActivity.length - 1]._count || 1) + 1;
      } else {
        dedupedActivity.push({ ...item, _count: 1 });
        lastActKey = key;
      }
    }
    // Agent (CC) 模式：极度压缩工具行动（只 name|ok/fail|target_id）
    const compressedToolActivity = dedupedActivity.slice(-8).map(item => {
      const status = item.ok ? "ok" : "fail";
      const suffix = item._count > 1 ? `(x${item._count})` : "";
      const target = (() => {
        try {
          const a = typeof item.args === "string" ? JSON.parse(item.args) : item.args;
          if (!a || typeof a !== "object") return "";
          return a.memory_id || a.eventId || a.id || a.query || "";
        } catch { return ""; }
      })();
      const t = target ? String(target).slice(0, 40) : "";
      return `- ${item.name}|${status}${t ? "|" + t : ""}${suffix}`;
    });

    // ── Agent: 压缩记忆（最多3条，短全文，长截断+id） ──
    const ccMemoryCompact = (() => {
      const mems = ensureArray(relatedMemories).slice(0, 3);
      if (!mems.length) return "";
      return mems.map(m => {
        const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit" }) : "?";
        const raw = String(m.content || "").replace(/\s+/g, " ");
        const text = raw.length <= 150 ? raw : raw.slice(0, 120) + "...[id:" + (m.id || "?") + "]";
        return `- ${date}|${memorySourceLabel(m)}|${text}`;
      }).join("\n");
    })();

    // ── Agent: 精简贴纸提示（只保留候选列表+一行规则） ──
    const ccStickerCompact = (() => {
      if (!stickerPromptForDynamic) return "";
      const lines = stickerPromptForDynamic.split("\n");
      const candidates = lines.filter(l => l.startsWith("- "));
      if (!candidates.length) return "";
      return "【表情包】强烈情绪时可用，格式{{sticker:ID}}，勿滥用\n" + candidates.join("\n");
    })();

    // ── Agent: 压缩时间 MM/DD HH:mm ──
    const ccTimeCompact = (() => {
      const p = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      const g = (t) => p.find(x => x.type === t)?.value || "";
      return `${g("month")}/${g("day")} ${g("hour")}:${g("minute")}`;
    })();

    // ── Agent: 压缩天气（一行：条件+温度） ──
    const ccWeatherCompact = dailyWeatherText
      ? dailyWeatherText.split("\n").filter(l => l.startsWith("天气")).join("") || dailyWeatherText.replace(/\n/g, " ").slice(0, 60)
      : "";

    // ── Agent: 压缩日记状态 ──
    const ccDiaryCompact = (() => {
      if (!diaryStatusText) return "";
      const day = diaryStatusText.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";
      if (diaryStatusText.includes("已经存在")) return `日记:${day}已写`;
      return `日记:${day}未写`;
    })();

    const ccDailyStatusCompact = formatAgentDailyStatusContext({
      config:statusInjection,
      time:ccTimeCompact,
      weather:ccWeatherCompact,
      cycle:dailyCalendarContext?.cycleText || "",
      events:dailyCalendarContext?.events,
      classes:dailyCalendarContext?.classes,
      diary:ccDiaryCompact,
      mood:reiMoodStatusText
    });

    // ── 动态上下文（Agent 模式：只保留开启的每日事实） ──
    const ccDynamic = [
      ccDailyStatusCompact,
      dailyNoteContext ? `【未读Moment】\n${dailyNoteContext}` : "",
      companionStatusText || "",
      pendingCompanionText || "",
      pendingListeningText || "",
      transferStatusText || "",
      compressedToolActivity.length ? `【近期工具】\n${compressedToolActivity.join("\n")}` : "",
      relatedMemoryLookupPerformed && !ccMemoryCompact ? "记忆检索:未命中" : "",
      ccMemoryCompact ? `【记忆】\n${ccMemoryCompact}` : "",
      // Agent 模式跳过可引用消息（tmux 自带对话历史）
      dynamicToolDesc ? `【额外工具】\n${dynamicToolDesc}` : "",
      ccStickerCompact || ""
    ].filter(Boolean).join("\n");

    // ── 首次调用：发完整人设 + 工具；resume：只发动态上下文 ──
    const ccSend = async (msg, sysPrompt, sendImages) => {
      const body = { message: msg, systemPrompt: sysPrompt || undefined, model, sessionId: sessionId || undefined };
      if (Array.isArray(sendImages) && sendImages.length) body.images = sendImages;
      const resp = await fetch(baseUrl + "/relay/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-relay-token": apiKey },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error("CC Relay 错误 " + resp.status + " " + errText.slice(0, 180));
      }
      const data = await resp.json();
      if (data.sessionId) {
        sessionId = data.sessionId;
        if (ccSessionState) ccSessionState.set({ day: today, sessionId });
      }
      return data;
    };

    try {
    let lastThinking = "";
    let lastToolResult = "";
    for (let round = 0; round < 6; round++) {
      let data;
      if (round === 0) {
        // round 0 始终带 systemPrompt：新 session 用来初始化，resume 用来让 relay 缓存
        // （防止 relay 重启后丢失 lastSysPrompt 导致 CC 无法重新启动）
        const fullSystemPrompt = [systemPrompt, defaultToolDesc].filter(Boolean).join("\n\n");
        const firstMsg = ccDynamic ? ccDynamic + "\n---\n" + userText : userText;
        // round 0 传图片（如有），后续工具结果轮不传图片
        data = await ccSend(firstMsg, fullSystemPrompt, chatImages.length ? chatImages : undefined);
      } else {
        // 工具结果轮：直接发送结果文本（在已有 session 内）
        data = await ccSend(lastToolResult, null);
      }

      const ccText = data.text || "";
      const { text: rawVisible, reasoning: inlineReasoning } = splitInlineThinking(ccText);
      if (round === 0) lastThinking = data.thinking || inlineReasoning || "";
      else if (data.thinking || inlineReasoning) lastThinking += "\n\n" + (data.thinking || inlineReasoning);

      // 解析工具调用
      const toolCalls = parseCcToolCalls(rawVisible);
      if (!toolCalls.length) {
        return { model: data.model || model || "cc-pro", text: rawVisible, reasoning: lastThinking, recalledMessageIds: toolState.recalledMessageIds, quoteForReply: toolState.quoteForReply, generatedImages: toolState.generatedImages, musicCards:toolState.musicCards, companionActions:toolState.companionActions, listeningActions:toolState.listeningActions, transferActions:toolState.transferActions, dailyNoteActions:toolState.dailyNoteActions, toolCalls:toolState.toolCalls };
      }

      // 执行工具调用（一个失败则跳过后续）
      const resultParts = [];
      let batchFailed = false;
      for (const call of toolCalls) {
        if (batchFailed) {
          resultParts.push(`${call.name}: 跳过（本批次前一个工具已失败）`);
          continue;
        }
        if (call.parseError) {
          resultParts.push(`${call.name}: 失败\n${call.parseError}`);
          batchFailed = true;
          continue;
        }
        try {
          const result = await executeRecordedChatTool(call.name, safeToolArgs(call.args), toolState);
          resultParts.push(`${call.name}: 成功\n${JSON.stringify(result, null, 0).slice(0, 2000)}`);
        } catch (e) {
          resultParts.push(`${call.name}: 失败\n${e.message}`);
          batchFailed = true;
        }
      }

      // 构造工具结果消息
      const availableNow = availableToolsForRound(availableTools, toolState);
      lastToolResult = [
        "【工具执行结果】",
        ...resultParts,
        "---",
        availableNow.length ? `仍可用的工具: ${availableNow.map(t => t.name).join(", ")}` : "",
        "请根据工具结果继续回复 Iris。如果还需要调用工具可以继续，否则直接用自然语言回复。"
      ].filter(Boolean).join("\n");
    }
    throw new Error("CC 工具调用次数过多，请缩小本次请求范围");
    } catch (error) {
      throw attachToolStateToError(error, toolState);
    }
  }

  if (preset?.provider === "anthropic") {
    let anthropicContent = userText;
    if (chatImages.length) {
      anthropicContent = [{ type: "text", text: userText }];
      for (const item of chatImages) {
        const match = String(item).match(/^data:([^;]+);base64,(.+)$/);
        if (match) anthropicContent.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
      }
    }
    const messages = [...recent, { role: "user", content: anthropicContent }];
    const toolState = { userText: content || "", selfProfileRead: false, recallOwnMessage, recalledMessageIds: [], selectQuoteMessage, quoteForReply: null, generateImage, generatedImages: [], musicCards:[], manageCompanion, companionActions: [], manageListening, listeningActions: [], manageTransfer, transferActions: [], publishDailyNote, dailyNoteActions: [], readDailyMoments, dailyMomentHistoryRead:false, mcpToolBindings, callMcpTool:callConversationMcpTool, failedToolNames:new Map(), mcpFailure:null, toolCalls: [], reasoningParts: [], onToolTrace };
    try {
    for (let round = 0; round < 6; round++) {
      const body = { model, max_tokens: 2048, system: systemPrompt, messages };
      const roundTools = availableToolsForRound(availableTools, toolState);
      if (roundTools.length) body.tools = anthropicChatTools(roundTools);
      const resp = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!resp.ok) { const errText = await resp.text().catch(() => ""); throw new Error(`模型请求失败 ${resp.status} ${errText.slice(0, 180)}`); }
      const data = await resp.json();
      const blocks = ensureArray(data.content);
      recordNativeReasoning(toolState, ...blocks.filter(block => block?.type === "thinking").map(block => block.thinking || block.text || ""));
      const calls = blocks.filter(x => x.type === "tool_use");
      if (!calls.length) return { model, text: blocks.filter(x => x.type === "text").map(x => x.text).join("\n"), recalledMessageIds: toolState.recalledMessageIds, quoteForReply: toolState.quoteForReply, generatedImages: toolState.generatedImages, musicCards:toolState.musicCards, companionActions:toolState.companionActions, listeningActions:toolState.listeningActions, transferActions:toolState.transferActions, dailyNoteActions:toolState.dailyNoteActions, toolCalls:toolState.toolCalls, reasoning:collectedNativeReasoning(toolState) };
      messages.push({ role: "assistant", content: blocks });
      const results = [];
      let batchFailed = false;
      for (const call of calls) {
        if (batchFailed) {
          // 同批次前一个工具已失败，跳过后续工具但仍返回 tool_result（API 要求）
          results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: "本批次前一个工具调用已失败，跳过此工具。请先处理失败结果。" });
          continue;
        }
        try {
          const result = await executeRecordedChatTool(call.name, safeToolArgs(call.input), toolState);
          results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: e.message });
          batchFailed = true;
        }
      }
      messages.push({ role: "user", content: results });
    }
    throw new Error("工具调用次数过多，请缩小本次请求范围");
    } catch (error) {
      throw attachToolStateToError(error, toolState);
    }
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...recent,
    { role: "user", content: userContent }
  ];
  const toolState = { userText: content || "", selfProfileRead: false, recallOwnMessage, recalledMessageIds: [], selectQuoteMessage, quoteForReply: null, generateImage, generatedImages: [], musicCards:[], manageCompanion, companionActions: [], manageListening, listeningActions: [], manageTransfer, transferActions: [], publishDailyNote, dailyNoteActions: [], readDailyMoments, dailyMomentHistoryRead:false, mcpToolBindings, callMcpTool:callConversationMcpTool, failedToolNames:new Map(), mcpFailure:null, toolCalls: [], reasoningParts: [], onToolTrace };
  try {
  for (let round = 0; round < 6; round++) {
    const body = { model, messages, temperature: 0.8 };
    const roundTools = availableToolsForRound(availableTools, toolState);
    if (roundTools.length) {
      body.tools = openAiChatTools(roundTools);
      body.tool_choice = "auto";
    }
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`模型请求失败 ${resp.status} ${errText.slice(0, 160)}`);
    }
    const data = await resp.json();
    const message = data.choices?.[0]?.message || {};
    // Different OpenAI-compatible gateways use different native field names.
    // We only retain a field actually returned by the provider; no reasoning is
    // requested or generated separately.
    recordNativeReasoning(toolState, message.reasoning_content, message.reasoning, message.thinking, message.thought);
    const inline = splitInlineThinking(typeof message.content === "string" ? message.content : "");
    recordNativeReasoning(toolState, inline.reasoning);
    const calls = ensureArray(message.tool_calls);
    if (!calls.length) {
      const text = typeof message.content === "string" ? inline.text : ensureArray(message.content).map(x => x?.text || "").join("\n");
      return { model, text: text || data.content?.[0]?.text || "", recalledMessageIds: toolState.recalledMessageIds, quoteForReply: toolState.quoteForReply, generatedImages: toolState.generatedImages, musicCards:toolState.musicCards, companionActions:toolState.companionActions, listeningActions:toolState.listeningActions, transferActions:toolState.transferActions, dailyNoteActions:toolState.dailyNoteActions, toolCalls:toolState.toolCalls, reasoning:collectedNativeReasoning(toolState) };
    }
    messages.push({ role: "assistant", content: (typeof message.content === "string" ? inline.text : message.content) || null, tool_calls: calls });
    let batchFailed = false;
    for (const call of calls) {
      if (batchFailed) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "本批次前一个工具调用已失败，跳过此工具。请先处理失败结果。" }) });
        continue;
      }
      try {
        const result = await executeRecordedChatTool(call.function?.name, safeToolArgs(call.function?.arguments), toolState);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      } catch (e) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: e.message }) });
        batchFailed = true;
      }
    }
  }
  throw new Error("工具调用次数过多，请缩小本次请求范围");
  } catch (error) {
    throw attachToolStateToError(error, toolState);
  }
}

async function translateChatMessage(message, settings = readChatSettings()) {
  if (!String(message?.content || "").trim()) throw new Error("没有可翻译的文字");
  const preset = getFunctionalChatPreset(settings, settings.functions?.translation || settings.functions?.main);
  const translationSettings = {
    ...settings,
    memory: { ...(settings.memory || {}), enabled: false },
    calendar: { ...(settings.calendar || {}), dailyContext: false },
    persona: {
      systemPrompt: "你是翻译助手。将用户提供的内容准确翻译成简体中文，保留原有语气、段落、专有名词和 emoji。只输出译文，不要解释、不要加前缀。"
    }
  };
  const result = await callFunctionModel("translation", preset, () => callOpenAICompatible({
    preset,
    settings: translationSettings,
    content: String(message.content),
    image: null,
    images: [],
    quote: null,
    history: []
  }));
  message.translation = {
    text: String(result.text || "").trim(),
    model: result.model || preset?.model || "",
    createdAt: chatNow()
  };
  message.updatedAt = chatNow();
  return message;
}

async function autoTranslateMessages(messages, conversation, settings) {
  if (!conversation?.autoTranslate) return;
  for (const message of messages) {
    if (!message?.translation && shouldAutoTranslateChatText(message?.content)) {
      try {
        await translateChatMessage(message, settings);
      } catch (e) {
        // A translation failure must never stop a normal chat message from saving.
        console.warn("auto translation failed:", e.message);
      }
    }
  }
}

function createAiQuoteHandler(quoteableMessages) {
  const allowed = new Map(quoteableMessages.map(message => [String(message.id), message]));
  return async messageId => {
    const target = allowed.get(String(messageId));
    if (!target || target.role !== "iris") throw new Error("只能引用系统列出的 Iris 消息");
    return { ok: true, quote: { id: target.id, role: "iris", content: String(target.content || "[图片]").slice(0, 280) } };
  };
}
function createAiCompanionHandler(messages, conversation, conversations, role) {
  let used = false;
  return async rawArgs => {
    if (used) throw new Error("一次回复最多执行一次陪伴邀请动作");
    const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};
    const action = String(args.action || "").toLowerCase();
    const conversationId = String(conversation?.id || "");
    if (!conversationId) throw new Error("当前聊天房间不存在");
    const now = chatNow();
    const roleName = String(role?.name || "TA").trim() || "TA";
    if (action === "invite") {
      const scene = COMPANION_SCENES.has(args.scene) ? args.scene : "study";
      const activity = COMPANION_SCENE_NAMES[scene] || "陪伴";
      const invitation = { id: generateId(), from: "ta", scene, status: "pending", config: null };
      const message = {
        id: generateId(), replyGroupId: generateId(), conversationId, role: "claude",
        systemType: "companion_invitation", companionInvitation: invitation,
        content: String(args.message || `${roleName} 想邀请你一起${activity}`).replace(/\s+/g, " ").trim().slice(0, 240),
        favorite: false, createdAt: now, updatedAt: now
      };
      messages.push(message);
      writeChatMessages(messages);
      conversation.updatedAt = now;
      writeChatConversations(conversations);
      used = true;
      return { ok: true, action: "invite", status: "pending", scene, invitationId: invitation.id, messageId: message.id, notice: "陪伴邀请卡片已发送" };
    }
    if (action === "respond") {
      const decision = String(args.decision || "").toLowerCase();
      if (!["accept", "decline"].includes(decision)) throw new Error("回应邀请时 decision 必须是 accept 或 decline");
      const invitationMessage = [...messages].reverse().find(message =>
        (message.conversationId || "legacy-chat") === conversationId &&
        message.role === "iris" && message.companionInvitation?.from === "iris" &&
        message.companionInvitation.status === "pending"
      );
      if (!invitationMessage) throw new Error("当前没有等待 TA 回应的陪伴邀请");
      const invitation = invitationMessage.companionInvitation;
      const activity = companionInvitationActivityName(invitation);
      invitation.status = decision === "accept" ? "accepted" : "declined";
      invitation.respondedAt = now;
      invitation.updatedAt = now;
      invitationMessage.updatedAt = now;
      const systemMessage = {
        id: generateId(), replyGroupId: generateId(), conversationId, role: "system",
        systemType: "companion_invitation_response",
        content: decision === "accept" ? `${roleName} 接受了你的「${activity}」陪伴邀请` : `${roleName} 拒绝了你的「${activity}」陪伴邀请`,
        companionInvitationResponse: { invitationId: invitation.id, sourceMessageId: invitationMessage.id, scene: invitation.scene, activity, decision, actor: "ta" },
        favorite: false, createdAt: now, updatedAt: now
      };
      messages.push(systemMessage);
      writeChatMessages(messages);
      conversation.updatedAt = now;
      writeChatConversations(conversations);
      used = true;
      return {
        ok: true, action: "respond", status: invitation.status, decision,
        invitationId: invitation.id, sourceMessageId: invitationMessage.id,
        systemMessageId: systemMessage.id, scene: invitation.scene, config: invitation.config || null,
        notice: decision === "accept" ? "已接受陪伴邀请" : "已拒绝陪伴邀请"
      };
    }
    throw new Error("陪伴邀请 action 必须是 invite 或 respond");
  };
}

function createAiListeningHandler(messages, conversation, conversations, role, roomId = "") {
  let actions = 0;
  return async rawArgs => {
    if (++actions > 2) throw new Error("一次回复最多执行两项一起听操作");
    const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};
    const action = String(args.action || "").toLowerCase();
    const conversationId = String(conversation?.id || "");
    if (!conversationId) throw new Error("当前聊天房间不存在");
    const now = chatNow(); const roleName = String(role?.name || "TA").trim() || "TA";
    if (action === "invite") {
      const invitation = { id:generateId(), from:"ta", status:"pending", roomId:null, roomStatus:null, createdAt:now };
      const message = { id:generateId(), replyGroupId:generateId(), conversationId, role:"claude", systemType:"listening_invitation", listeningInvitation:invitation, content:String(args.message || `${roleName} 想邀请你一起听歌`).replace(/\s+/g, " ").trim().slice(0, 240), favorite:false, createdAt:now, updatedAt:now };
      messages.push(message); writeChatMessages(messages); conversation.updatedAt = now; writeChatConversations(conversations);
      return { ok:true, action:"invite", messageId:message.id, invitationId:invitation.id, notice:"一起听邀请卡已发送" };
    }
    if (action === "respond") {
      const decision = String(args.decision || "").toLowerCase(); if (!["accept","decline"].includes(decision)) throw new Error("回应邀请时 decision 必须是 accept 或 decline");
      const source = [...messages].reverse().find(message => message.conversationId === conversationId && message.role === "iris" && message.listeningInvitation?.from === "iris" && message.listeningInvitation.status === "pending");
      if (!source) throw new Error("当前没有等待 TA 回应的一起听邀请");
      const invitation = source.listeningInvitation; invitation.status = decision === "accept" ? "accepted" : "declined"; invitation.respondedAt = now; invitation.updatedAt = now; source.updatedAt = now;
      let room = null; if (decision === "accept") { const ensured = ensureListeningRoomForInvitation(invitation, conversation); room = ensured.room; writeListeningRooms(ensured.rooms.slice(-100)); }
      const systemMessage = { id:generateId(), replyGroupId:generateId(), conversationId, role:"system", systemType:"listening_invitation_response", content:decision === "accept" ? `${roleName} 已同意一起听歌邀请` : `${roleName} 拒绝了一起听歌邀请`, listeningInvitationResponse:{ invitationId:invitation.id, sourceMessageId:source.id, decision, actor:"ta" }, favorite:false, createdAt:now, updatedAt:now };
      messages.push(systemMessage); writeChatMessages(messages); conversation.updatedAt = now; writeChatConversations(conversations);
      return { ok:true, action:"respond", decision, status:invitation.status, sourceMessageId:source.id, systemMessageId:systemMessage.id, roomId:room?.id || null, notice:systemMessage.content };
    }
    const found = findListeningRoom(roomId); if (!found.room || found.room.status === "ended") throw new Error("当前没有可控制的一起听房间");
    const room = found.room; room.queue ||= []; room.playback ||= { status:"paused", positionSeconds:0, startedAt:null };
    if (action === "search_add") {
      const query = String(args.query || "").replace(/\s+/g, " ").trim().slice(0,120); if (!query) throw new Error("搜歌需要填写 query");
      const result = await callListeningMusicTool("play_music", { keywords:query }); const track = listeningTrack(mcpMusicPayload(result) || listeningMcpValue(result) || {}); if (!track.songId || !track.audioUrl) throw new Error("没有找到可播放的歌曲"); track.refreshedAt = now; room.queue.push(track); if (!room.currentTrack) { room.queueIndex = room.queue.length - 1; room.currentTrack = track; }
      if (args.playNow === true) { commitListeningClock(room); room.queueIndex = room.queue.length - 1; room.currentTrack = track; room.playback = { status:"playing", positionSeconds:0, startedAt:now }; }
      room.updatedAt = now; found.rooms[found.index] = room; writeListeningRooms(found.rooms.slice(-100)); return { ok:true, action, track:{songId:track.songId,songName:track.songName,artistName:track.artistName}, notice:`已把《${track.songName}》加入播放列表` };
    }
    if (action === "next" || action === "previous") { if (!room.queue.length) throw new Error("播放列表还是空的"); commitListeningClock(room); const offset = action === "next" ? 1 : -1; room.queueIndex = Math.max(0, Math.min(room.queue.length - 1, (Number(room.queueIndex) || 0) + offset)); room.currentTrack = room.queue[room.queueIndex]; room.playback = { status:"paused", positionSeconds:0, startedAt:null }; }
    else if (action === "pause") { commitListeningClock(room); room.playback.status = "paused"; }
    else if (action === "resume") { room.playback.status = "playing"; room.playback.startedAt = now; }
    else throw new Error("未知的一起听操作");
    room.updatedAt = now; found.rooms[found.index] = room; writeListeningRooms(found.rooms.slice(-100)); return { ok:true, action, roomId:room.id, track:room.currentTrack ? {songId:room.currentTrack.songId,songName:room.currentTrack.songName,artistName:room.currentTrack.artistName} : null, notice:"一起听房间已同步" };
  };
}

function transferAmount(value) {
  const amount = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(amount) && amount >= 0.01 && amount <= 999999.99 ? amount : 0;
}
function transferMessageText(from, amount, note) {
  const sender = from === "iris" ? "Iris" : "TA";
  return "【站内转账】" + sender + " 向你转账 ¥" + amount.toFixed(2) + (note ? "，备注：" + note : "");
}
function createTransferReceipt({ conversationId, role, from, source, decision, now, roleId }) {
  const accepted = decision === "accept";
  const amount = transferAmount(source?.transfer?.amount);
  const transfer = {
    id: generateId(), from, roleId: String(roleId || source?.transfer?.roleId || ""), amount,
    note: "", status: accepted ? "received" : "declined", receipt: true,
    sourceTransferId: String(source?.transfer?.id || ""), createdAt: now, respondedAt: now
  };
  return {
    id: generateId(), replyGroupId: generateId(), conversationId, role,
    systemType: "transfer_receipt", transfer,
    content: accepted ? `【站内转账】已处理 ¥${amount.toFixed(2)}` : `【站内转账】已退回 ¥${amount.toFixed(2)}`,
    favorite: false, createdAt: now, updatedAt: now
  };
}
function createAiTransferHandler(messages, conversation, conversations, role) {
  let used = false;
  return async rawArgs => {
    if (used) throw new Error("一次回复最多执行一次转账动作");
    const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};
    const action = String(args.action || "").toLowerCase();
    const conversationId = String(conversation?.id || "");
    if (!conversationId) throw new Error("当前聊天房间不存在");
    const now = chatNow();
    const roleName = String(role?.name || "TA").trim() || "TA";
    if (action === "send") {
      const amount = transferAmount(args.amount);
      if (!amount) throw new Error("转账金额须在 ¥0.01 到 ¥999999.99 之间");
      const note = String(args.note || "").replace(/\s+/g, " ").trim().slice(0, 80);
      const transfer = { id: generateId(), from: "ta", roleId: String(role?.id || ""), amount, note, status: "pending", createdAt: now };
      const message = { id: generateId(), replyGroupId: generateId(), conversationId, role: "claude", systemType: "transfer", transfer, content: transferMessageText("ta", amount, note), favorite:false, createdAt:now, updatedAt:now };
      messages.push(message); writeChatMessages(messages);
      conversation.updatedAt = now; writeChatConversations(conversations); used = true;
      return { ok:true, action:"send", messageId:message.id, transferId:transfer.id, amount, notice:"虚拟转账卡已发送" };
    }
    if (action === "respond") {
      const decision = String(args.decision || "").toLowerCase();
      if (!["accept", "decline"].includes(decision)) throw new Error("回应转账时 decision 必须是 accept 或 decline");
      const source = [...messages].reverse().find(message => (message.conversationId || "legacy-chat") === conversationId && message.role === "iris" && message.transfer?.from === "iris" && message.transfer.status === "pending");
      if (!source) throw new Error("当前没有等待 TA 回应的转账");
      source.transfer.status = decision === "accept" ? "received" : "declined";
      source.transfer.respondedAt = now; source.updatedAt = now;
      const systemMessage = { id:generateId(), replyGroupId:generateId(), conversationId, role:"system", systemType:"transfer_response", content:decision === "accept" ? roleName + " 已收下你的转账" : roleName + " 已退回你的转账", transferResponse:{sourceMessageId:source.id,transferId:source.transfer.id,decision,actor:"ta"}, favorite:false, createdAt:now, updatedAt:now };
      const receiptMessage = createTransferReceipt({ conversationId, role:"claude", from:"ta", source, decision, now, roleId:conversation.roleId });
      messages.push(systemMessage, receiptMessage); writeChatMessages(messages);
      conversation.updatedAt = now; writeChatConversations(conversations); used = true;
      return { ok:true, action:"respond", status:source.transfer.status, sourceMessageId:source.id, systemMessageId:systemMessage.id, messageId:receiptMessage.id, notice:systemMessage.content };
    }
    throw new Error("转账 action 必须是 send 或 respond");
  };
}

function createAiDailyNoteHandler(conversation, role) {
  let used = false;
  return async rawArgs => {
    if (used) throw new Error("一次回复最多发布一条日常");
    const content = String(rawArgs?.content || "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!content) throw new Error("日常内容不能为空");
    const now = chatNow();
    const note = { id:generateId(), roleId:String(role?.id || conversation?.roleId || ""), author:"claude", content, createdAt:now, readByIrisAt:null, readByClaudeAt:now };
    const notes = readChatDailyNotes(); notes.push(note); writeChatDailyNotes(notes);
    used = true;
    return { ok:true, note:publicDailyNote(note), notice:"日常碎碎念已发布" };
  };
}

function createAiDailyMomentHistoryHandler(conversation, role) {
  return async rawArgs => {
    const roleId = String(role?.id || conversation?.roleId || "");
    const requestedAuthor = String(rawArgs?.author || "all").toLowerCase();
    const author = ["iris", "claude", "all"].includes(requestedAuthor) ? requestedAuthor : "all";
    const limit = Math.max(1, Math.min(12, Number(rawArgs?.limit || 6)));
    const notes = readChatDailyNotes()
      .filter(note => String(note?.roleId || "") === roleId && (author === "all" || note.author === author))
      .sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, limit)
      .map(note => ({ id:note.id, author:note.author, content:String(note.content || ""), createdAt:note.createdAt }));
    return {
      ok:true,
      author,
      count:notes.length,
      notes,
      notice: notes.length
        ? "已返回近期 Moment。请直接依据这些内容自然回应，不要再次调用 read_moments。"
        : "没有匹配的 Moment。不要为同一问题重复调用，请如实说明。"
    };
  };
}

// ---- 日常碎碎念 ----------------------------------------------------------
app.get("/api/chat/daily-notes", apiAuth, (req, res) => {
  const roleId = String(req.query?.roleId || "").trim();
  if (!roleId) return res.status(400).json({ error:"roleId required" });
  const notes = readChatDailyNotes().filter(note => String(note?.roleId || "") === roleId)
    .sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map(publicDailyNote);
  res.json({ notes });
});
app.post("/api/chat/daily-notes", apiAuth, (req, res) => {
  const roleId = String(req.body?.roleId || "").trim();
  const content = String(req.body?.content || "").replace(/\s+/g," ").trim().slice(0,500);
  if (!roleId || !content) return res.status(400).json({ error:"请填写日常内容" });
  if (!readChatRoles().some(role => String(role.id) === roleId)) return res.status(404).json({ error:"当前角色不存在" });
  const now = chatNow();
  const note = { id:generateId(), roleId, author:"iris", content, createdAt:now, readByIrisAt:now, readByClaudeAt:null };
  const notes = readChatDailyNotes(); notes.push(note); writeChatDailyNotes(notes);
  res.status(201).json(publicDailyNote(note));
});
app.post("/api/chat/daily-notes/read", apiAuth, (req, res) => {
  const roleId = String(req.body?.roleId || "").trim();
  if (!roleId) return res.status(400).json({ error:"roleId required" });
  const reader = req.body?.reader === "claude" ? "claude" : "iris";
  const readKey = reader === "claude" ? "readByClaudeAt" : "readByIrisAt";
  const notes = readChatDailyNotes(); const now = chatNow(); let changed = 0;
  for (const note of notes) {
    if (String(note?.roleId || "") !== roleId || note.author === reader || note[readKey] || (readKey === "readByIrisAt" && note.readAt)) continue;
    note[readKey] = now;
    if (readKey === "readByIrisAt") note.readAt = now;
    changed++;
  }
  if (changed) writeChatDailyNotes(notes);
  res.json({ ok:true, changed, readAt:now });
});
app.delete("/api/chat/daily-notes/:id", apiAuth, (req, res) => {
  const id = String(req.params?.id || "").trim();
  if (!id) return res.status(400).json({ error:"id required" });
  const notes = readChatDailyNotes();
  const next = notes.filter(note => String(note?.id || "") !== id);
  if (next.length === notes.length) return res.status(404).json({ error:"日常不存在" });
  writeChatDailyNotes(next);
  res.json({ ok:true, id });
});

// ---- 设置 ----
app.get("/api/chat/mcp-connectors", apiAuth, (req, res) => {
  res.json({ connectors: readChatMcpConnectors().map(publicMcpConnector) });
});
app.post("/api/chat/mcp-connectors", apiAuth, (req, res) => {
  const list = readChatMcpConnectors();
  const item = normaliseMcpConnector(req.body || {});
  if (list.some(existing => existing.id === item.id)) item.id = generateId();
  list.push(item);
  writeChatMcpConnectors(list);
  Promise.resolve(item.endpoint ? refreshMcpConnectorTools(item.id) : item).then(saved => res.status(201).json(publicMcpConnector(saved)));
});
app.put("/api/chat/mcp-connectors/:id", apiAuth, (req, res) => {
  const list = readChatMcpConnectors();
  const index = list.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Connector not found" });
  list[index] = normaliseMcpConnector(req.body || {}, list[index]);
  writeChatMcpConnectors(list);
  Promise.resolve(list[index].endpoint ? refreshMcpConnectorTools(list[index].id) : list[index]).then(saved => res.json(publicMcpConnector(saved)));
});
app.post("/api/chat/mcp-connectors/:id/refresh", apiAuth, async (req, res) => {
  try { res.json(publicMcpConnector(await refreshMcpConnectorTools(req.params.id))); }
  catch (error) { res.status(404).json({ error:error.message || "连接器不存在" }); }
});
app.delete("/api/chat/mcp-connectors/:id", apiAuth, (req, res) => {
  const list = readChatMcpConnectors();
  const item = list.find(connector => connector.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Connector not found" });
  if (item.builtin) return res.status(400).json({ error: "预置连接器不能删除，可在编辑页关闭。" });
  writeChatMcpConnectors(list.filter(connector => connector.id !== item.id));
  res.json({ ok: true });
});
app.get("/api/chat/conversations", apiAuth, (req, res) => {
  const list = readChatConversations().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ conversations: list });
});
app.post("/api/chat/conversations", apiAuth, (req, res) => {
  const now = chatNow();
  const mode = req.body.mode === "agent" ? "agent" : "api";
  const item = { id: generateId(), title: String(req.body.title || "新对话").slice(0, 80), roleId: req.body.roleId || "", presetId: req.body.presetId || "", model: req.body.model || "", mode, agentProvider: mode === "agent" ? (req.body.agentProvider || "cc") : "", agentModel: req.body.agentModel || "", pinned: false, archived: false, imageRetention: "5-turns", autoTranslate: false, imageGenerationEnabled: false, mcpConfig: { enabled: false, allConnectors: false, connectorIds: [] }, createdAt: now, updatedAt: now };
  const list = readChatConversations(); list.push(item); writeChatConversations(list); res.status(201).json(item);
});
app.put("/api/chat/conversations/:id", apiAuth, (req, res) => {
  const list = readChatConversations(); const idx = list.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Conversation not found" });
  ["title", "roleId", "presetId", "model", "pinned", "archived", "appearance", "multiBubble", "mergeBubbles", "imageRetention", "autoTranslate", "imageGenerationEnabled", "mcpConfig", "mode", "agentProvider", "agentModel", "agentToolConfig"].forEach(k => { if (req.body[k] !== undefined) list[idx][k] = req.body[k]; });
  // 归一化 agentToolConfig（如果传入的话）
  if (req.body.agentToolConfig !== undefined && req.body.agentToolConfig && typeof req.body.agentToolConfig === "object") {
    list[idx].agentToolConfig = normaliseRoleToolConfig(req.body.agentToolConfig);
  }
  list[idx].updatedAt = chatNow();
  writeChatConversations(list);
  if (req.body.imageRetention !== undefined) {
    const messages = readChatMessages();
    if (cleanupConversationImages(messages, req.params.id, list[idx])) writeChatMessages(messages);
  }
  res.json(list[idx]);
});
app.delete("/api/chat/conversations/:id", apiAuth, (req, res) => {
  const id = req.params.id;
  writeChatConversations(readChatConversations().filter(x => x.id !== id));
  const messages = readChatMessages();
  const removed = messages.filter(m => (m.conversationId || "legacy-chat") === id);
  discardChatMessages(removed);
  writeChatMessages(messages.filter(m => (m.conversationId || "legacy-chat") !== id));
  res.json({ ok: true });
});
app.get("/api/chat/roles", apiAuth, (req, res) => res.json({ roles: readChatRoles() }));
app.post("/api/chat/roles", apiAuth, (req, res) => {
  const now = chatNow(); const item = { id: generateId(), name: String(req.body.name || "新角色").slice(0, 50), avatar: req.body.avatar || "", identity: req.body.identity || "", prompt: req.body.prompt || "", relationship: req.body.relationship || "", memoryEnabled: req.body.memoryEnabled !== false, toolConfig:normaliseRoleToolConfig(req.body.toolConfig), statusInjectionConfig:normaliseStatusInjectionConfig(req.body.statusInjectionConfig), stickerConfig:normaliseRoleStickerConfig(req.body.stickerConfig), createdAt: now, updatedAt: now };
  const list = readChatRoles(); list.push(item); writeChatRoles(list); res.status(201).json(item);
});
app.put("/api/chat/roles/:id", apiAuth, (req, res) => {
  const list = readChatRoles(); const idx = list.findIndex(x => x.id === req.params.id); if (idx < 0) return res.status(404).json({ error: "Role not found" });
  ["name", "avatar", "identity", "prompt", "relationship", "memoryEnabled"].forEach(k => { if (req.body[k] !== undefined) list[idx][k] = req.body[k]; }); if(req.body.toolConfig!==undefined)list[idx].toolConfig=normaliseRoleToolConfig(req.body.toolConfig); if(req.body.statusInjectionConfig!==undefined)list[idx].statusInjectionConfig=normaliseStatusInjectionConfig(req.body.statusInjectionConfig); if(req.body.stickerConfig!==undefined)list[idx].stickerConfig=normaliseRoleStickerConfig(req.body.stickerConfig); list[idx].updatedAt = chatNow(); writeChatRoles(list); res.json(list[idx]);
});
app.delete("/api/chat/roles/:id", apiAuth, (req, res) => { writeChatRoles(readChatRoles().filter(x => x.id !== req.params.id)); res.json({ ok: true }); });
app.get("/api/chat/profile", apiAuth, (req, res) => res.json(readChatProfile()));
app.put("/api/chat/profile", apiAuth, (req, res) => { const data = { ...readChatProfile(), ...(req.body || {}) }; writeChatProfile(data); res.json(data); });

// ---- Sticker library ------------------------------------------------------
app.get("/api/chat/stickers", apiAuth, async (req, res) => {
  const library = await loadStickerLibrary();
  res.json(library);
});
app.post("/api/chat/sticker-packs", apiAuth, async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 40);
  if (!name) return res.status(400).json({ error:"请输入表情包包名称" });
  const backup = readStickerLibraryBackup();
  const now = chatNow();
  const saved = await upsertStickerPack({ id:generateId(), name, sortOrder:backup.packs.length, createdAt:now, updatedAt:now });
  backup.packs.push(saved); writeStickerLibraryBackup(backup);
  res.status(201).json(saved);
});
app.put("/api/chat/sticker-packs/:id", apiAuth, async (req, res) => {
  const library = await loadStickerLibrary();
  const existing = library.packs.find(pack => pack.id === req.params.id);
  if (!existing) return res.status(404).json({ error:"未找到这个表情包包" });
  const saved = await upsertStickerPack({ ...existing, name:req.body?.name === undefined ? existing.name : String(req.body.name).trim().slice(0, 40), sortOrder:req.body?.sortOrder ?? existing.sortOrder, updatedAt:chatNow() });
  const backup = readStickerLibraryBackup(); backup.packs = backup.packs.map(pack => pack.id === saved.id ? saved : pack); writeStickerLibraryBackup(backup);
  res.json(saved);
});
app.delete("/api/chat/sticker-packs/:id", apiAuth, async (req, res) => {
  const id = req.params.id;
  try { const { error } = await supabase.from("sticker_packs").delete().eq("id", id); dbError("sticker_packs", error); } catch (error) { console.warn("sticker pack delete database unavailable:", error.message); }
  const backup = readStickerLibraryBackup(); backup.packs = backup.packs.filter(pack => pack.id !== id); backup.stickers = backup.stickers.map(sticker => sticker.packId === id ? { ...sticker, packId:null, updatedAt:chatNow() } : sticker); writeStickerLibraryBackup(backup);
  res.json({ ok:true });
});
app.post("/api/chat/stickers", apiAuth, async (req, res) => {
  const library = await loadStickerLibrary();
  const packId = req.body?.packId ? String(req.body.packId) : null;
  if (packId && !library.packs.some(pack => pack.id === packId)) return res.status(400).json({ error:"请选择存在的表情包包" });
  const id = generateId();
  try {
    const image = await storeStickerImage(req.body?.dataUrl, id);
    const now = chatNow();
    const saved = await upsertSticker({ id, packId, imageUrl:image.imageUrl, storagePath:image.storagePath, name:req.body?.name, description:req.body?.description, tags:req.body?.tags, aiWeight:req.body?.aiWeight, createdAt:now, updatedAt:now });
    const backup = readStickerLibraryBackup(); backup.stickers = [...backup.stickers.filter(sticker => sticker.id !== saved.id), saved]; writeStickerLibraryBackup(backup);
    res.status(201).json(saved);
  } catch (error) { res.status(400).json({ error:error.message || "表情包上传失败" }); }
});
app.put("/api/chat/stickers/:id", apiAuth, async (req, res) => {
  const library = await loadStickerLibrary();
  const current = library.stickers.find(sticker => sticker.id === req.params.id);
  if (!current) return res.status(404).json({ error:"未找到这个表情包" });
  const packId = req.body?.packId === undefined ? current.packId : (req.body.packId ? String(req.body.packId) : null);
  if (packId && !library.packs.some(pack => pack.id === packId)) return res.status(400).json({ error:"请选择存在的表情包包" });
  const saved = await upsertSticker({ ...current, packId, name:req.body?.name === undefined ? current.name : req.body.name, description:req.body?.description === undefined ? current.description : req.body.description, tags:req.body?.tags === undefined ? current.tags : req.body.tags, aiWeight:req.body?.aiWeight === undefined ? current.aiWeight : req.body.aiWeight, updatedAt:chatNow() });
  const backup = readStickerLibraryBackup(); backup.stickers = backup.stickers.map(sticker => sticker.id === saved.id ? saved : sticker); writeStickerLibraryBackup(backup);
  res.json(saved);
});
app.delete("/api/chat/stickers/:id", apiAuth, async (req, res) => {
  const id = req.params.id;
  try { const { error } = await supabase.from("stickers").delete().eq("id", id); dbError("stickers", error); } catch (error) { console.warn("sticker delete database unavailable:", error.message); }
  const backup = readStickerLibraryBackup(); backup.stickers = backup.stickers.filter(sticker => sticker.id !== id); writeStickerLibraryBackup(backup);
  res.json({ ok:true });
});

app.get("/api/chat/settings", apiAuth, (req, res) => {
  res.json(readChatSettings());
});
app.put("/api/chat/settings", apiAuth, (req, res) => {
  writeChatSettings(req.body || {});
  res.json(readChatSettings());
});
app.get("/api/chat/function-model-status", apiAuth, (req, res) => {
  res.json(publicFunctionModelStatus());
});
app.post("/api/chat/function-model-status/viewed", apiAuth, (req, res) => {
  const settings = readChatSettings();
  settings.lastModelStatusViewedAt = chatNow();
  writeChatSettings(settings);
  res.json(publicFunctionModelStatus(readChatSettings()));
});

// ---- Claude Code usage / quota ----
app.get("/api/agent/claude-usage", apiAuth, async (req, res) => {
  try {
    const settings = readChatSettings();
    const ccPreset = ensureArray(settings.presets).find(p => p.provider === "cc");
    if (!ccPreset?.baseUrl || !ccPreset?.apiKey) return res.status(404).json({ error: "no CC preset configured" });
    const relayUrl = normalizeApiRoot(ccPreset.baseUrl);
    const resp = await fetch(relayUrl + "/relay/usage", {
      headers: { "x-relay-token": ccPreset.apiKey }
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      return res.status(resp.status).json(body);
    }
    res.json(await resp.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Chat reply notifications ----
// Subscriptions are device-specific, while the preference belongs to this
// private chat workspace. The reply can therefore notify after its page exits.
function normaliseChatNotificationSettings(value = {}) {
  const mode = value.mode === "each" ? "each" : "combined";
  const bubbleIntervalSeconds = Math.max(1, Math.min(8, Number(value.bubbleIntervalSeconds) || 2));
  return { enabled:value.enabled === true, mode, bubbleIntervalSeconds };
}
function chatNotificationSettings() {
  return normaliseChatNotificationSettings(readChatSettings().notifications || {});
}
app.get("/api/chat/notifications", apiAuth, (req, res) => {
  res.json({ settings:chatNotificationSettings(), supported:true });
});
app.put("/api/chat/notifications", apiAuth, (req, res) => {
  const all = readChatSettings();
  all.notifications = normaliseChatNotificationSettings({ ...(all.notifications || {}), ...(req.body || {}) });
  writeChatSettings(all);
  res.json({ settings:chatNotificationSettings() });
});
function chatInboxCursor(message) {
  return message ? `${String(message.createdAt || "")}::${String(message.id || "")}` : "";
}
// This is deliberately separate from Web Push.  While a PWA is still open
// on another page, it can show a fast in-app banner even on networks where
// Android cannot connect to Google's push registration service.
app.get("/api/chat/notifications/inbox", apiAuth, (req, res) => {
  const all = readChatMessages()
    .filter(message => message?.role === "claude" && !message?.recalled)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const cursor = String(req.query?.cursor || "");
  let fresh = [];
  if (cursor) {
    const cursorIndex = all.findIndex(message => chatInboxCursor(message) === cursor);
    if (cursorIndex >= 0) fresh = all.slice(cursorIndex + 1);
    else {
      const cursorTime = cursor.split("::")[0];
      fresh = all.filter(message => String(message.createdAt || "") > cursorTime);
    }
  }
  const conversations = new Map(readChatConversations().map(item => [String(item.id), item]));
  const roles = new Map(readChatRoles().map(item => [String(item.id), item]));
  res.json({
    messages:fresh.slice(0, 30).map(message => {
      const conversation = conversations.get(String(message.conversationId || "legacy-chat"));
      const role = roles.get(String(conversation?.roleId || ""));
      return {
        id:message.id,
        replyGroupId:message.replyGroupId || message.id,
        conversationId:message.conversationId || "legacy-chat",
        createdAt:message.createdAt,
        title:String(role?.name || "TA").trim() || "TA",
        avatar:String(role?.avatar || ""),
        body:shortenNotificationText(chatNotificationLine(message)),
        url:`/chat.html?conversationId=${encodeURIComponent(String(message.conversationId || "legacy-chat"))}`
      };
    }),
    cursor:chatInboxCursor(all.at(-1))
  });
});
// ---- 拉取模型列表（后端代理，不暴露key给前端） ----
app.post("/api/chat/models", apiAuth, async (req, res) => {
  const baseUrl = normalizeApiRoot(req.body.baseUrl);
  const apiKey  = req.body.apiKey;
  const provider = req.body.provider || "openai";
  if (!baseUrl || !apiKey) return res.status(400).json({ error: "baseUrl and apiKey required" });

  // Claude Code Relay — 返回 Pro 订阅可用的所有模型
  if (provider === "cc") {
    return res.json({ models: [
      { id: "claude-sonnet-4-5-20250514", name: "Sonnet 4.5" },
      { id: "claude-opus-4-6", name: "Opus 4.6" },
      { id: "claude-sonnet-4-6", name: "Sonnet 4.6" },
      { id: "claude-opus-4-8", name: "Opus 4.8" },
      { id: "claude-opus-4-7", name: "Opus 4.7" },
      { id: "claude-opus-5-0", name: "Opus 5" },
      { id: "claude-sonnet-5-0", name: "Sonnet 5" },
      { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5" },
      { id: "claude-fable-5-1", name: "Fable 5.1" }
    ]});
  }

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
  const beforeId = String(req.query.beforeId || "");
  const conversationId = req.query.conversationId || "legacy-chat";
  const allMessages = readChatMessages();
  const appliedRecalls = applyScheduledChatRecalls(allMessages);
  if (appliedRecalls || cleanupImagesForConversation(allMessages, conversationId)) writeChatMessages(allMessages);
  const all    = allMessages.filter(m => (m.conversationId || "legacy-chat") === conversationId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const cursorIndex = beforeId ? all.findIndex(message => String(message.id) === beforeId) : -1;
  const end = cursorIndex >= 0 ? cursorIndex : all.filter(m => new Date(m.createdAt).getTime() < before).length;
  const start = Math.max(0, end - limit);
  const page = all.slice(start, end).map(publicMessage);
  res.json({ messages: page, hasMore:start > 0 });
});

// ---- 先保存一条用户气泡；用户可以连续发多条后再让 AI 回复 ----
app.post("/api/chat/messages", apiAuth, async (req, res) => {
  const conversationId = String(req.body.conversationId || "").trim();
  let content = String(req.body.content || "").trim();
  const images = normalizeChatMessageImages(req.body.images, req.body.image);
  const image = images[0] || null;
  let sticker = null;
  const stickerId = String(req.body.stickerId || "").trim();
  if (stickerId) {
    const library = await loadStickerLibrary();
    const stored = library.stickers.find(item => item.id === stickerId);
    if (!stored) return res.status(400).json({ error:"未找到这个表情包，请刷新后重试" });
    sticker = stickerSnapshot(stored);
    if (!content) content = `【表情包】${[sticker.name, ...sticker.tags, sticker.description].filter(Boolean).join("、") || "一张表情包"}`;
  }
  if (!conversationId) return res.status(400).json({ error: "conversationId required" });
  if (!content && !images.length && !sticker) return res.status(400).json({ error: "message content required" });

  const conversations = readChatConversations();
  const conversation = conversations.find(x => x.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });

  const now = chatNow();
  const message = {
    id: generateId(),
    replyGroupId: String(req.body.replyGroupId || generateId()),
    conversationId,
    role: "iris",
    content,
    image,
    images,
    sticker,
    quote: req.body.quote || null,
    favorite: false,
    createdAt: now,
    updatedAt: now
  };
  const list = readChatMessages();
  applyScheduledChatRecalls(list);
  list.push(message);
  await autoTranslateMessages([message], conversation, readChatSettings());
  cleanupImagesForConversation(list, conversationId, conversations);
  writeChatMessages(list);
  conversation.updatedAt = now;
  if (["新对话", "New chat"].includes(conversation.title) && content) {
    conversation.title = content.slice(0, 24) || "New chat";
  }
  writeChatConversations(conversations);
  res.status(201).json(publicMessage(message));
});

// An invitation is a normal persisted chat event, not a model tool call.  The
// following model reply may accept or decline it, but merely creating the card
// is local and free of API usage.
app.post("/api/chat/companion-invitations", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim();
  const scene = COMPANION_SCENES.has(req.body?.scene) ? req.body.scene : "custom";
  if (!conversationId) return res.status(400).json({ error: "conversationId required" });
  const conversations = readChatConversations();
  const conversation = conversations.find(item => item.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const config = req.body?.config && typeof req.body.config === "object" ? {
    timerMode: req.body.config.timerMode === "elapsed" ? "elapsed" : "countdown",
    durationSeconds: Math.max(0, Math.min(12 * 60 * 60, Math.round(Number(req.body.config.durationSeconds) || 0))),
    ambient: COMPANION_AMBIENTS.has(req.body.config.ambient) ? req.body.config.ambient : "rain",
    autoEnabled: req.body.config.autoEnabled === true,
    autoIntervalMinutes: Math.max(1, Math.min(720, Math.round(Number(req.body.config.autoIntervalMinutes) || 5))),
    autoUntilMinutes: Math.max(0, Math.min(12 * 60, Math.round(Number(req.body.config.autoUntilMinutes) || 0))),
    sleepMode: req.body.config.sleepMode === "night" ? "night" : "nap",
    name: String(req.body.config.name || `${COMPANION_SCENE_NAMES[scene]}陪伴`).trim().slice(0, 60)
  } : null;
  const now = chatNow();
  const invitation = { id: generateId(), from: "iris", scene, status: "pending", config };
  const activityName = scene === "custom" && config?.name ? config.name : (COMPANION_SCENE_NAMES[scene] || "陪伴");
  const message = {
    id: generateId(), replyGroupId: generateId(), conversationId, role: "iris",
    systemType: "companion_invitation", companionInvitation: invitation,
    content: `【陪伴邀请】Iris 想邀请你一起${activityName}。请自然决定接受或婉拒；若接受，请在回复末尾用 companion-accept 标签确认。`,
    favorite: false, createdAt: now, updatedAt: now
  };
  const messages = readChatMessages(); messages.push(message); writeChatMessages(messages);
  conversation.updatedAt = now; writeChatConversations(conversations);
  res.status(201).json(publicMessage(message));
});

// Deterministic fallback for an explicitly requested invitation from TA. The
// model still writes the conversational reply, while this route guarantees
// that the UI receives a real structured card instead of a narrated tag.
app.post("/api/chat/companion-invitations/ta", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim();
  const scene = COMPANION_SCENES.has(req.body?.scene) ? req.body.scene : "study";
  if (!conversationId) return res.status(400).json({ error: "conversationId required" });
  const conversations = readChatConversations();
  const conversation = conversations.find(item => item.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const role = readChatRoles().find(item => item.id === conversation.roleId);
  const name = String(role?.name || "TA").trim() || "TA";
  const now = chatNow();
  const message = {
    id: generateId(), replyGroupId: generateId(), conversationId, role: "claude",
    systemType: "companion_invitation",
    companionInvitation: { id: generateId(), from: "ta", scene, status: "pending", config: null },
    content: `${name} 想邀请你一起${COMPANION_SCENE_NAMES[scene] || "陪伴"}`,
    favorite: false, createdAt: now, updatedAt: now
  };
  const messages = readChatMessages();
  messages.push(message);
  writeChatMessages(messages);
  conversation.updatedAt = now;
  writeChatConversations(conversations);
  res.status(201).json(publicMessage(message));
});

// Accepting or declining a card is also local: it updates the original card
// and adds a readable system event, without asking the chat model again.
app.post("/api/chat/companion-invitations/:messageId/respond", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim();
  const action = String(req.body?.action || "").toLowerCase();
  if (!conversationId) return res.status(400).json({ error: "conversationId required" });
  if (!["accept", "decline"].includes(action)) return res.status(400).json({ error: "action must be accept or decline" });
  const conversations = readChatConversations();
  const conversation = conversations.find(item => item.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const list = readChatMessages();
  const invitationMessage = list.find(message => message.id === req.params.messageId && (message.conversationId || "legacy-chat") === conversationId);
  const invitation = invitationMessage?.companionInvitation;
  if (!invitation || invitation.from !== "ta") return res.status(404).json({ error: "Incoming companion invitation not found" });
  if (invitation.status !== "pending") return res.status(409).json({ error: "This invitation has already been answered" });
  const now = chatNow();
  invitation.status = action === "accept" ? "accepted" : "declined";
  invitation.respondedAt = now;
  invitation.updatedAt = now;
  invitationMessage.updatedAt = now;
  const role = readChatRoles().find(item => item.id === conversation.roleId);
  const name = String(role?.name || "TA").trim() || "TA";
  const activity = companionInvitationActivityName(invitation);
  const systemMessage = {
    id: generateId(), replyGroupId: generateId(), conversationId, role: "system",
    systemType: "companion_invitation_response",
    content: action === "accept" ? `我接受了 ${name} 发出的「${activity}」陪伴邀请` : `我拒绝了 ${name} 发出的「${activity}」陪伴邀请`,
    companionInvitationResponse: { invitationId: invitation.id, sourceMessageId: invitationMessage.id, scene: invitation.scene, activity, decision: action, actor: "iris" },
    favorite: false, createdAt: now, updatedAt: now
  };
  list.push(systemMessage);
  let session = null;
  if (action === "accept") {
    const ensured = ensureCompanionSessionForInvitation(invitation, conversation);
    session = ensured.session;
    writeCompanionSessions(ensured.sessions.slice(-100));
  }
  writeChatMessages(list);
  conversation.updatedAt = now;
  writeChatConversations(conversations);
  res.json({ invitation: publicMessage(invitationMessage), systemMessage: publicMessage(systemMessage), session: session ? companionSessionForClient(session) : null });
});

// This stays available after a card has been accepted. The card is the
// recovery route when the first browser/PWA redirect was interrupted.
app.post("/api/chat/companion-invitations/:messageId/enter", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim();
  const conversation = readChatConversations().find(item => item.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const messages = readChatMessages();
  const message = messages.find(item => item.id === req.params.messageId && (item.conversationId || "legacy-chat") === conversationId);
  const invitation = message?.companionInvitation;
  if (!invitation || invitation.status !== "accepted") return res.status(409).json({ error: "请先同意这张陪伴邀请" });
  const ensured = ensureCompanionSessionForInvitation(invitation, conversation);
  message.updatedAt = chatNow();
  writeCompanionSessions(ensured.sessions.slice(-100));
  writeChatMessages(messages);
  res.json({ session: companionSessionForClient(ensured.session), created: ensured.created });
});

app.post("/api/chat/transfers", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim();
  const amount = transferAmount(req.body?.amount);
  const note = String(req.body?.note || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const conversations = readChatConversations();
  const conversation = conversations.find(item => item.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "聊天房间不存在" });
  if (!amount) return res.status(400).json({ error: "请输入 ¥0.01 到 ¥999999.99 的金额" });
  const now = chatNow();
  const transfer = { id: generateId(), from: "iris", roleId: String(conversation.roleId || ""), amount, note, status: "pending", createdAt: now };
  const message = { id: generateId(), replyGroupId: generateId(), conversationId, role: "iris", systemType: "transfer", transfer, content: transferMessageText("iris", amount, note), favorite:false, createdAt:now, updatedAt:now };
  const messages = readChatMessages(); messages.push(message); writeChatMessages(messages);
  conversation.updatedAt = now; writeChatConversations(conversations);
  res.status(201).json(publicMessage(message));
});
app.post("/api/chat/transfers/:messageId/respond", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim();
  const action = String(req.body?.action || "").toLowerCase();
  if (!["accept", "decline"].includes(action)) return res.status(400).json({ error: "action 必须是 accept 或 decline" });
  const conversations = readChatConversations();
  const conversation = conversations.find(item => item.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "聊天房间不存在" });
  const messages = readChatMessages();
  const message = messages.find(item => item.id === req.params.messageId && item.conversationId === conversationId);
  if (!message?.transfer || message.transfer.from !== "ta") return res.status(404).json({ error: "未找到待接收的转账" });
  if (message.transfer.status !== "pending") return res.status(409).json({ error: "这笔转账已处理" });
  const now = chatNow();
  message.transfer.status = action === "accept" ? "received" : "declined";
  message.transfer.respondedAt = now; message.updatedAt = now;
  const role = readChatRoles().find(item => item.id === conversation.roleId);
  const roleName = String(role?.name || "TA").trim() || "TA";
  const systemMessage = {
    id: generateId(), replyGroupId: generateId(), conversationId, role: "system",
    systemType: "transfer_response",
    content: action === "accept" ? `Iris 已收下 ${roleName} 发来的转账` : `Iris 已退回 ${roleName} 发来的转账`,
    transferResponse: { sourceMessageId: message.id, transferId: message.transfer.id, decision: action, actor: "iris", roleId: String(conversation.roleId || ""), roleName, amount: message.transfer.amount, note: message.transfer.note || "" },
    favorite: false, createdAt: now, updatedAt: now
  };
  const receiptMessage = createTransferReceipt({ conversationId, role:"iris", from:"iris", source:message, decision:action, now, roleId:conversation.roleId });
  messages.push(systemMessage, receiptMessage);
  conversation.updatedAt = now; writeChatMessages(messages); writeChatConversations(conversations);
  res.json({ transfer: publicMessage(message), systemMessage: publicMessage(systemMessage), receiptMessage: publicMessage(receiptMessage) });
});
app.get("/api/chat/wallet", apiAuth, (req, res) => {
  const roleId = String(req.query?.roleId || "");
  // Pending cards belong in the chat until the receiver accepts or returns
  // them.  The wallet is a settled ledger, so it only exposes completed rows.
  const transfers = readChatMessages().filter(message =>
    message?.transfer &&
    !message.transfer.receipt &&
    message.transfer.status !== "pending" &&
    (!roleId || message.transfer.roleId === roleId)
  ).map(publicMessage);
  res.json({ transfers });
});

// ---- 编辑消息；编辑后的文字会作为之后请求模型时的真实上下文 ----
app.put("/api/chat/messages/:id", apiAuth, (req, res) => {
  const list = readChatMessages();
  const idx  = list.findIndex(m => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  if (req.body.content !== undefined) {
    list[idx].content = String(req.body.content || "").trim();
    list[idx].editedAt = chatNow();
    list[idx].translation = null;
  }
  if (req.body.favorite !== undefined) list[idx].favorite = !!req.body.favorite;
  list[idx].updatedAt = chatNow();
  writeChatMessages(list);
  res.json(publicMessage(list[idx]));
});

// ---- 使用模型设置里的“翻译模型”，把一条外文消息翻为中文 ----
app.post("/api/chat/messages/:id/translate", apiAuth, async (req, res) => {
  const list = readChatMessages();
  const idx = list.findIndex(m => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const message = list[idx];
  try {
    await translateChatMessage(message);
    writeChatMessages(list);
    res.json(publicMessage(message));
  } catch (e) {
    res.status(502).json({ error: e.message || "翻译失败" });
  }
});

// ---- 用户手动撤回自己的消息；AI 只能通过自己的工具撤回自己的消息 ----
app.post("/api/chat/messages/:id/recall", apiAuth, (req, res) => {
  const list = readChatMessages();
  const idx = list.findIndex(m => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  if (list[idx].role !== "iris") return res.status(400).json({ error: "只能撤回自己的消息" });
  recallChatMessage(list[idx], "iris");
  writeChatMessages(list);
  res.json(publicMessage(list[idx]));
});

// ---- 删除单条消息 ----
app.delete("/api/chat/messages/:id", apiAuth, (req, res) => {
  const list = readChatMessages();
  discardChatMessages(list.filter(message => message.id === req.params.id));
  writeChatMessages(list.filter(message => message.id !== req.params.id));
  res.json({ ok: true });
});

// ---- 多选后批量删除消息 ----
app.post("/api/chat/messages/batch-delete", apiAuth, (req, res) => {
  const ids = new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(String));
  if (!ids.size) return res.status(400).json({ error: "请选择要删除的消息" });
  const list = readChatMessages();
  const next = list.filter(m => !ids.has(String(m.id)));
  discardChatMessages(list.filter(m => ids.has(String(m.id))));
  writeChatMessages(next);
  res.json({ ok: true, deleted: list.length - next.length });
});

// ---- 当前房间存储管理 ----
app.post("/api/chat/conversations/:id/clear-images", apiAuth, (req, res) => {
  const conversations = readChatConversations();
  if (!conversations.some(item => item.id === req.params.id)) return res.status(404).json({ error: "Conversation not found" });
  const list = readChatMessages();
  let removed = 0;
  for (const message of list) {
    if ((message.conversationId || "legacy-chat") === req.params.id && removeMessageImages(message, "cleared")) removed++;
  }
  if (removed) writeChatMessages(list);
  res.json({ ok: true, removed });
});
app.post("/api/chat/conversations/:id/clear-messages", apiAuth, (req, res) => {
  const conversations = readChatConversations();
  const conversation = conversations.find(item => item.id === req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const list = readChatMessages();
  const next = list.filter(m => (m.conversationId || "legacy-chat") !== conversation.id);
  discardChatMessages(list.filter(m => (m.conversationId || "legacy-chat") === conversation.id));
  writeChatMessages(next);
  conversation.summary = ""; // legacy field retained for old exports
  conversation.lastSummarizedCount = 0;
  conversation.dailySummaries = {};
  conversation.recentMemoryInjections = [];
  conversation.updatedAt = chatNow();
  writeChatConversations(conversations);
  res.json({ ok: true, deleted: list.length - next.length });
});

// ---- Run the existing rolling-summary path on demand; raw chat messages stay intact. ----
app.post("/api/chat/conversations/:id/summary", apiAuth, async (req, res) => {
  const conversations = readChatConversations();
  const conversation = conversations.find(item => item.id === req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const settings = readChatSettings();
  const history = readChatMessages().filter(message => (message.conversationId || "legacy-chat") === conversation.id && message.role !== "system");
  const day = chatDayKey();
  const previousUpdatedAt = String(conversation.dailySummaries?.[day]?.updatedAt || "");
  try {
    const summary = await updateRollingDaySummary({ conversation, history, settings, day, force:true });
    conversation.updatedAt = chatNow();
    writeChatConversations(conversations);
    res.json({ ok:true, updated:String(conversation.dailySummaries?.[day]?.updatedAt || "") !== previousUpdatedAt, hasSummary:!!summary });
  } catch (error) {
    res.status(502).json({ error:error.message || "总结失败" });
  }
});

// ---- 清空聊天 ----
app.post("/api/chat/clear", apiAuth, (req, res) => {
  discardChatMessages(readChatMessages());
  writeChatMessages([]);
  const conversations = readChatConversations();
  for (const conversation of conversations) {
    conversation.summary = "";
    conversation.lastSummarizedCount = 0;
    conversation.dailySummaries = {};
    conversation.recentMemoryInjections = [];
    conversation.updatedAt = chatNow();
  }
  writeChatConversations(conversations);
  res.json({ ok: true });
});

// ---- 发送消息 + 调AI + 持久化 ----
app.post("/api/chat/send", apiAuth, async (req, res) => {
  const settings = { ...readChatSettings(), ...(req.body.settings || {}) };
  settings.persona = {
    ...(settings.persona || {}),
    systemPrompt: removeLegacyBubbleInstruction(
      settings.persona?.systemPrompt || DEFAULT_CHAT_SETTINGS.persona.systemPrompt
    )
  };
  const list = readChatMessages();
  applyScheduledChatRecalls(list);
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
  applyAgentPresetOverride(settings, conversation);
  if (role) {
    const rolePrompt = removeLegacyBubbleInstruction([
      role.identity ? `你的身份：${role.identity}` : "",
      role.relationship ? `你与 Iris 的关系：${role.relationship}` : "",
      role.prompt || settings.persona?.systemPrompt
    ].filter(Boolean).join("\n\n"));
    settings.persona = { ...(settings.persona || {}), systemPrompt: rolePrompt, replyStyle: settings.persona?.replyStyle };
    settings.memory = { ...(settings.memory || {}), enabled: role.memoryEnabled !== false };
    settings.toolConfig = normaliseRoleToolConfig(role.toolConfig);
    settings.statusInjectionConfig = normaliseStatusInjectionConfig(role.statusInjectionConfig);
    settings.recentToolActivity = ensureArray(conversation.recentToolActivity).slice(-12);
    // Agent 模式：优先使用对话级 agentToolConfig，否则回退到默认过滤
    if ((conversation.mode || "api") === "agent") {
      settings.toolConfig = (conversation.agentToolConfig && typeof conversation.agentToolConfig === "object")
        ? normaliseRoleToolConfig(conversation.agentToolConfig)
        : agentModeToolConfig(settings.toolConfig);
    }
  }
  const profile = readChatProfile();
  if (profile.name || profile.identity || profile.bio || profile.details) {
    settings.persona = { ...(settings.persona || {}), irisName: profile.name || settings.persona?.irisName, systemPrompt: [settings.persona?.systemPrompt, profile.identity ? `Iris 的身份：${profile.identity}` : "", profile.bio ? `关于用户：${profile.bio}` : "", profile.details ? `用户档案：${profile.details}` : ""].filter(Boolean).join("\n\n") };
  }
  const conversationHistory = list.filter(m => (m.conversationId || "legacy-chat") === conversationId && m.role !== "system");
  const requestedReplyGroupId = String(req.body.replyGroupId || "").trim();
  const storedUserMessages = requestedReplyGroupId
    ? conversationHistory.filter(m => m.role === "iris" && m.replyGroupId === requestedReplyGroupId)
    : [];
  if (requestedReplyGroupId && !storedUserMessages.length) {
    return res.status(400).json({ error: "No pending user messages found" });
  }
  const usingStoredTurn = storedUserMessages.length > 0;
  const userTurnContent = usingStoredTurn
    ? storedUserMessages.map(m => String(m.content || "").trim()).filter(Boolean).join("\n")
    : String(req.body.content || "");
  const userTurnImages = (usingStoredTurn
    ? storedUserMessages.flatMap(chatMessageImages)
    : normalizeChatMessageImages(req.body.images, req.body.image)
  ).slice(0, 6);
  const userTurnImage = userTurnImages[0] || null;
  // When a turn has already been saved as several user bubbles, do not send it
  // to the model twice through both history and the current-message payload.
  const historyBeforeCurrentTurn = usingStoredTurn
    ? conversationHistory.filter(m => m.replyGroupId !== requestedReplyGroupId)
    : conversationHistory;
  // General system records stay out of the transcript, but companion-card
  // responses are user actions that TA must be able to understand on the
  // next turn.  Keep them in a separate, tightly-scoped context channel.
  const companionStatusMessages = list.filter(message =>
    (message.conversationId || "legacy-chat") === conversationId &&
    message.role === "system" &&
    message.systemType === "companion_invitation_response"
  );
  const transferStatusMessages = list.filter(message =>
    (message.conversationId || "legacy-chat") === conversationId &&
    message.role === "system" &&
    message.systemType === "transfer_response"
  );
  let currentDaySummary = "";
  try {
    currentDaySummary = await updateRollingDaySummary({
      conversation,
      history: historyBeforeCurrentTurn,
      settings,
      day: chatDayKey(now)
    });
  } catch (e) {
    // A summary is a derived index.  A transient summary failure must never
    // block the original conversation from continuing.
    console.warn("rolling chat summary failed:", e.message);
  }
  appendCurrentDaySummary(settings, currentDaySummary);
  const keepYesterdayTail = isCrossDayGracePeriod(now);
  appendPreviousDayHandoff(settings, latestPreviousDayHandoff(conversation, historyBeforeCurrentTurn, chatDayKey(now), {
    includeTail: keepYesterdayTail,
    maxChars: keepYesterdayTail ? CROSS_DAY_GRACE_MAX_CHARS : PREVIOUS_DAY_SUMMARY_MAX_CHARS
  }));

  const userMsg = usingStoredTurn ? null : {
    id:        generateId(),
    replyGroupId: generateId(),
    conversationId,
    role:      "iris",
    content:   userTurnContent,
    image:     userTurnImage,
    images:    userTurnImages,
    quote:     req.body.quote   || null,
    favorite:  false,
    createdAt: now,
    updatedAt: now
  };
  if (userMsg) list.push(userMsg);

  try {
    let stickerPromptForDynamic = "";
    try {
      const stickerPrompt = await buildStickerPrompt(role, conversation, [...historyBeforeCurrentTurn, ...(usingStoredTurn ? storedUserMessages : [userMsg])]);
      if (stickerPrompt) {
        const preset_ = getActiveChatPreset(settings);
        if (preset_?.provider === "cc") {
          // Agent 模式：表情包作为动态上下文注入，不写进静态 systemPrompt
          stickerPromptForDynamic = stickerPrompt;
        } else {
          // API 模式：原逻辑，写进 systemPrompt
          settings.persona = { ...(settings.persona || {}), systemPrompt:[settings.persona?.systemPrompt, stickerPrompt].filter(Boolean).join("\n\n") };
        }
      }
    } catch (error) {
      // Sticker suggestions are optional UI enrichment; a storage failure must
      // never prevent the normal reply from being generated.
      console.warn("sticker prompt unavailable:", error.message);
    }
    const preset = getActiveChatPreset(settings);
    const recallableMessages = historyBeforeCurrentTurn.filter(message => message.role !== "iris" && !message.recalled && String(message.content || "").trim());
    const quoteableMessages = [...historyBeforeCurrentTurn, ...(usingStoredTurn ? storedUserMessages : [userMsg])].filter(message => message?.role === "iris" && !message.recalled && (String(message.content || "").trim() || chatMessageImages(message).length));
    let relatedMemories = [];
    const automaticMemoryRecall = !!role && role.memoryEnabled !== false && settings.memory?.enabled === true;
    if (automaticMemoryRecall && userTurnContent.trim()) {
      try {
        relatedMemories = await selectRelatedMemoriesForConversation(conversation, userTurnContent, settings.memory?.categories);
      } catch (e) {
        // Retrieval is read-only assistance.  A database hiccup should not
        // turn a normal chat message into a failed request.
        console.warn("automatic memory recall failed:", e.message);
      }
    }
    recordMemoryInjection(conversation, relatedMemories);
    // Iris's Moments are lightweight ambient context, not an extra model tool
    // call.  They are consumed only after a real response was successfully
    // requested, so a transient provider failure never makes one disappear.
    const unreadUserDailyNotes = readChatDailyNotes()
      .filter(note => String(note?.roleId || "") === String(conversation.roleId || "") && note.author === "iris" && !note.readByClaudeAt)
      .sort((a,b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)).slice(-5);
    const dailyNoteContext = unreadUserDailyNotes.map(note => `- ${new Date(note.createdAt || chatNow()).toLocaleString("zh-CN")}: ${String(note.content || "").trim()}`).join("\n");
    const mcpToolset = buildConversationMcpTools(conversation);
    // CC 会话状态管理：session ID 存储在 conversation 对象上
    const ccSessionState = preset?.provider === "cc" ? {
      get: () => conversation.ccSession || null,
      set: (state) => { conversation.ccSession = state; writeChatConversations(conversations); }
    } : null;
    const ai = await callFunctionModel("main", preset, () => callOpenAICompatible({
      preset,
      settings,
      content: userTurnContent,
      image:   userTurnImage,
      images:  userTurnImages,
      quote:   req.body.quote   || null,
      history: [...historyBeforeCurrentTurn, ...companionStatusMessages, ...transferStatusMessages],
      recallableMessages,
      recallOwnMessage: null,
      quoteableMessages,
      selectQuoteMessage: createAiQuoteHandler(quoteableMessages),
      generateImage: createAiImageHandler(settings, conversation.imageGenerationEnabled === true),
      manageCompanion: createAiCompanionHandler(list, conversation, conversations, role),
      manageListening: createAiListeningHandler(list, conversation, conversations, role),
      manageTransfer: createAiTransferHandler(list, conversation, conversations, role),
      publishDailyNote: createAiDailyNoteHandler(conversation, role),
      readDailyMoments: createAiDailyMomentHistoryHandler(conversation, role),
      dailyNoteContext,
      mcpTools: mcpToolset.tools,
      mcpToolBindings: mcpToolset.bindings,
      relatedMemories,
      relatedMemoryLookupPerformed: automaticMemoryRecall && !!userTurnContent.trim(),
      onToolTrace: createToolActivityRecorder(conversation, conversations),
      ccSessionState,
      stickerPromptForDynamic
    }));
    if (unreadUserDailyNotes.length) {
      const consumedIds = new Set(unreadUserDailyNotes.map(note => note.id));
      const notes = readChatDailyNotes(); let changed = false; const now = chatNow();
      for (const note of notes) if (consumedIds.has(note.id) && !note.readByClaudeAt) { note.readByClaudeAt = now; changed = true; }
      if (changed) writeChatDailyNotes(notes);
    }

    // Only split one AI response into several stored messages when this
    // conversation explicitly enables multi-bubble replies.
    const directive = extractCompanionCardDirective(ai.text);
    const stickerDirective = await extractAiStickerDirective(directive.text, role, canAiSendSticker([...historyBeforeCurrentTurn, ...storedUserMessages]));
    const aiText = String(stickerDirective.text || "").trim();
    const generatedImages = normalizeChatMessageImages(ai.generatedImages);
    const musicCard = ensureArray(ai.musicCards)[0] || null;
    const companionToolActions = ensureArray(ai.companionActions);
    const listeningToolActions = ensureArray(ai.listeningActions);
    const transferToolActions = ensureArray(ai.transferActions);
    const dailyNoteActions = ensureArray(ai.dailyNoteActions);
    const toolInvitationMessages = companionToolActions
      .filter(action => action?.action === "invite" && action.messageId)
      .map(action => list.find(message => message.id === action.messageId))
      .filter(Boolean);
    const toolSystemMessages = companionToolActions
      .filter(action => action?.action === "respond" && action.systemMessageId)
      .map(action => list.find(message => message.id === action.systemMessageId))
      .filter(Boolean);
    const toolListeningMessages = listeningToolActions
      .filter(action => action?.messageId || action?.systemMessageId)
      .flatMap(action => [action.messageId, action.systemMessageId])
      .map(id => list.find(message => message.id === id)).filter(Boolean);
    const toolTransferMessages = transferToolActions
      .filter(action => action?.messageId)
      .map(action => list.find(message => message.id === action.messageId))
      .filter(Boolean);
    const toolResponseAction = [...companionToolActions].reverse().find(action => action?.action === "respond") || null;
    const parts = aiText
      ? (conversation.multiBubble ? splitAiParts(aiText) : [aiText.replace(/\s*\|\|\|\s*/g, " ").trim()])
      : (() => {
        if (stickerDirective.sticker || generatedImages.length) return [""];
        if (directive.card || ai.recalledMessageIds?.length || companionToolActions.length || listeningToolActions.length || transferToolActions.length) return [];
        if (musicCard) return ["给你放这首。"];
        if (dailyNoteActions.length) return ["我留下一条 Moment。"];
        return ["我在。"];
      })();
    const replyGroupId = generateId();
    const aiMessages = parts.map((part, i) => ({
      id:        generateId(),
      replyGroupId,
      inReplyToGroupId: requestedReplyGroupId || userMsg?.replyGroupId || "",
      conversationId,
      role:      "claude",
      content:   part,
      image:     i === 0 ? generatedImages[0] || null : null,
      images:    i === 0 ? generatedImages : [],
      // A reaction should close the reply rather than interrupt its words.
      sticker:   i === parts.length - 1 ? stickerDirective.sticker : null,
      music:     i === parts.length - 1 ? musicCard : null,
      dailyNote: i === 0 ? (dailyNoteActions.map(action => action?.note).filter(Boolean).at(-1) || null) : null,
      dailyNoteReadIds: i === 0 ? unreadUserDailyNotes.map(note => note.id) : [],
      quote:     i === 0 ? ai.quoteForReply || null : null,
      model:     ai.model || preset?.model || "",
      toolCalls: i === 0 ? ensureArray(ai.toolCalls) : [],
      reasoning: i === 0 ? String(ai.reasoning || "") : "",
      favorite:  false,
      createdAt: new Date(Date.now() + i).toISOString(),
      updatedAt: new Date(Date.now() + i).toISOString()
    }));
    const sourceInvitationMessage = storedUserMessages.find(message => message?.companionInvitation?.from === "iris" && message.companionInvitation.status === "pending") || null;
    const sourceInvitation = sourceInvitationMessage?.companionInvitation || null;
    // Companion cards are produced exclusively by the real tool.  Never turn
    // ordinary model prose or obsolete markup into a UI action.
    const companionDirective = null;
    const systemMessages = [];
    let companionInvitationResult = toolResponseAction ? {
      status: toolResponseAction.status,
      invitationId: toolResponseAction.invitationId,
      sourceMessageId: toolResponseAction.sourceMessageId,
      scene: toolResponseAction.scene,
      config: toolResponseAction.config || null
    } : null;
    const listeningResponseAction = [...listeningToolActions].reverse().find(action => action?.action === "respond") || null;
    const listeningInvitationResult = listeningResponseAction ? {
      status: listeningResponseAction.status,
      decision: listeningResponseAction.decision,
      sourceMessageId: listeningResponseAction.sourceMessageId,
      roomId: listeningResponseAction.roomId || null
    } : null;
    if (companionDirective) {
      const nowForCard = new Date(Date.now() + aiMessages.length + 1).toISOString();
      const accepted = companionDirective.kind === "accept";
      const declined = companionDirective.kind === "decline";
      if ((accepted || declined) && sourceInvitationMessage) {
        sourceInvitation.status = accepted ? "accepted" : "declined";
        sourceInvitation.respondedAt = nowForCard;
        sourceInvitation.updatedAt = nowForCard;
        sourceInvitationMessage.updatedAt = nowForCard;
        const responseMessage = {
          id: generateId(), replyGroupId: generateId(), conversationId, role: "system",
          systemType: "companion_invitation_response",
          content: accepted ? `${String(role?.name || "TA").trim() || "TA"} 接受了你的「${companionInvitationActivityName(sourceInvitation)}」陪伴邀请` : `对方拒绝了你的「${companionInvitationActivityName(sourceInvitation)}」陪伴邀请`,
          companionInvitationResponse: { invitationId: sourceInvitation.id, sourceMessageId: sourceInvitationMessage.id, scene: sourceInvitation.scene, activity: companionInvitationActivityName(sourceInvitation), decision: accepted ? "accept" : "decline", actor: "ta" },
          favorite: false, createdAt: nowForCard, updatedAt: nowForCard
        };
        systemMessages.push(responseMessage);
        companionInvitationResult = {
          status: sourceInvitation.status,
          invitationId: sourceInvitation.id,
          sourceMessageId: sourceInvitationMessage.id,
          scene: sourceInvitation.scene,
          config: sourceInvitation.config || null
        };
      } else if (companionDirective.kind === "invitation") {
        aiMessages.push({
          id: generateId(), replyGroupId, inReplyToGroupId: requestedReplyGroupId || userMsg?.replyGroupId || "", conversationId,
          role: "claude", content: companionDirective.message || "要不要一起待一会儿？",
          systemType: "companion_invitation",
          companionInvitation: { id: generateId(), from: "ta", scene: companionDirective.scene, status: "pending", config: null },
          favorite: false, createdAt: nowForCard, updatedAt: nowForCard
        });
      }
    }

    await autoTranslateMessages(aiMessages, conversation, settings);
    appendRecentToolActivity(conversation, ai.toolCalls);
    list.push(...aiMessages, ...systemMessages);
    cleanupImagesForConversation(list, conversationId, conversations);
    writeChatMessages(list);
    conversation.updatedAt = chatNow();
    if (["新对话", "New chat"].includes(conversation.title) && userTurnContent) conversation.title = String(userTurnContent).trim().slice(0, 24) || "New chat";
    writeChatConversations(conversations);
    // Push delivery must never hold up the durable chat reply. In each-bubble
    // mode these notifications are scheduled with the user's chosen pacing.
    res.json({
      userMessages: (usingStoredTurn ? storedUserMessages : [userMsg]).map(publicMessage),
      aiMessages:   [...toolInvitationMessages, ...toolListeningMessages.filter(message => message.role !== 'system'), ...toolTransferMessages, ...aiMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(publicMessage),
      systemMessages: [...toolSystemMessages, ...toolListeningMessages.filter(message => message.role === 'system'), ...systemMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(publicMessage),
      companionInvitationResult,
      listeningInvitationResult
    });
  } catch (e) {
    appendRecentToolActivity(conversation, e.toolCalls);
    const completedCompanionActions = ensureArray(e.companionActions);
    const completedTransferActions = ensureArray(e.transferActions);
    const completedInvitationMessages = completedCompanionActions
      .filter(action => action?.action === "invite" && action.messageId)
      .map(action => list.find(message => message.id === action.messageId))
      .filter(Boolean);
    const completedSystemMessages = completedCompanionActions
      .filter(action => action?.action === "respond" && action.systemMessageId)
      .map(action => list.find(message => message.id === action.systemMessageId))
      .filter(Boolean);
    const completedResponse = [...completedCompanionActions].reverse().find(action => action?.action === "respond") || null;
    const completedTransferMessages = completedTransferActions
      .filter(action => action?.messageId)
      .map(action => list.find(message => message.id === action.messageId))
      .filter(Boolean);
    const traceTarget = completedInvitationMessages[0] || completedSystemMessages[0] || completedTransferMessages[0];
    if (traceTarget) {
      traceTarget.toolCalls = ensureArray(e.toolCalls);
      traceTarget.reasoning = String(e.reasoning || "");
    }
    writeChatMessages(list);
    conversation.updatedAt = chatNow();
    writeChatConversations(conversations);
    // The companion action is already durable at this point.  Return the
    // generated/updated card even when the model's optional follow-up sentence
    // times out, so the UI never hides a successfully completed action behind
    // a generic request failure.
    if (completedCompanionActions.length) {
      return res.json({
        userMessages: (usingStoredTurn ? storedUserMessages : [userMsg]).map(publicMessage),
        aiMessages: completedInvitationMessages.map(publicMessage),
        systemMessages: completedSystemMessages.map(publicMessage),
        companionInvitationResult: completedResponse ? {
          status: completedResponse.status,
          invitationId: completedResponse.invitationId,
          sourceMessageId: completedResponse.sourceMessageId,
          scene: completedResponse.scene,
          config: completedResponse.config || null
        } : null,
        partialFailure: e.message || "陪伴动作完成，但后续回复生成失败"
      });
    }
    // A card-changing transfer tool can have succeeded even if the model
    // provider fails while generating its optional follow-up sentence.  Keep
    // that durable action visible instead of returning a misleading failure.
    if (completedTransferActions.length) {
      return res.json({
        userMessages: (usingStoredTurn ? storedUserMessages : [userMsg]).map(publicMessage),
        aiMessages: completedTransferMessages.map(publicMessage),
        systemMessages: [],
        partialFailure: e.message || "转账动作完成，但后续回复生成失败"
      });
    }
    res.status(502).json({
      error:        e.message || "chat failed",
      userMessages: (usingStoredTurn ? storedUserMessages : [userMsg]).map(publicMessage)
    });
  }
});

// ---- 重新生成最近一轮用户消息的 AI 回复，并替换旧回复 ----
app.post("/api/chat/messages/:id/regenerate", apiAuth, async (req, res) => {
  const list = readChatMessages();
  applyScheduledChatRecalls(list);
  const target = list.find(message => message.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Not found" });
  if (target.role !== "iris") return res.status(400).json({ error: "只能对自己的消息重新生成回复" });
  const conversationId = target.conversationId || "legacy-chat";
  const conversations = readChatConversations();
  const conversation = conversations.find(item => item.id === conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const conversationMessages = list.filter(message => (message.conversationId || "legacy-chat") === conversationId && message.role !== "system");
  const targetGroupId = String(target.replyGroupId || target.id);
  const userTurnIds = [...new Set(conversationMessages.filter(message => message.role === "iris").map(message => String(message.replyGroupId || message.id)))];
  if (userTurnIds.at(-1) !== targetGroupId) return res.status(400).json({ error: "只能重新生成最近一轮已完成的回复" });
  const targetMessages = conversationMessages.filter(message => message.role === "iris" && String(message.replyGroupId || message.id) === targetGroupId);
  let replacedReplies = conversationMessages.filter(message => message.role !== "iris" && message.inReplyToGroupId === targetGroupId);
  if (!replacedReplies.length) {
    const lastTargetIndex = conversationMessages.reduce((index, message, currentIndex) => (targetMessages.includes(message) ? currentIndex : index), -1);
    replacedReplies = conversationMessages.slice(lastTargetIndex + 1).filter(message => message.role !== "iris");
  }
  if (!replacedReplies.length) return res.status(400).json({ error: "这轮消息还没有可替换的回复" });
  const removedIds = new Set(replacedReplies.map(message => message.id));
  const targetStartIndex = conversationMessages.findIndex(message => targetMessages.includes(message));
  const history = conversationMessages.slice(0, targetStartIndex).filter(message => !message.recalled);
  const userTurnContent = targetMessages.map(message => String(message.content || "").trim()).filter(Boolean).join("\n");
  const userTurnImages = targetMessages.flatMap(chatMessageImages).slice(0, 6);
  let settings = readChatSettings();
  settings.persona = {
    ...(settings.persona || {}),
    systemPrompt: removeLegacyBubbleInstruction(settings.persona?.systemPrompt || DEFAULT_CHAT_SETTINGS.persona.systemPrompt)
  };
  if (conversation.presetId && conversation.model) {
    settings.activePresetId = conversation.presetId;
    settings.presets = ensureArray(settings.presets).map(preset => preset.id === conversation.presetId ? { ...preset, model: conversation.model } : preset);
  }
  applyAgentPresetOverride(settings, conversation);
  const role = readChatRoles().find(item => item.id === conversation.roleId);
  if (role) {
    const rolePrompt = removeLegacyBubbleInstruction([
      role.identity ? `你的身份：${role.identity}` : "",
      role.relationship ? `你与 Iris 的关系：${role.relationship}` : "",
      role.prompt || settings.persona?.systemPrompt
    ].filter(Boolean).join("\n\n"));
    settings.persona = { ...(settings.persona || {}), systemPrompt: rolePrompt, replyStyle: settings.persona?.replyStyle };
    settings.memory = { ...(settings.memory || {}), enabled: role.memoryEnabled !== false };
    settings.toolConfig = normaliseRoleToolConfig(role.toolConfig);
    settings.statusInjectionConfig = normaliseStatusInjectionConfig(role.statusInjectionConfig);
    settings.recentToolActivity = ensureArray(conversation.recentToolActivity).slice(-12);
    // Agent 模式：优先使用对话级 agentToolConfig，否则回退到默认过滤
    if ((conversation.mode || "api") === "agent") {
      settings.toolConfig = (conversation.agentToolConfig && typeof conversation.agentToolConfig === "object")
        ? normaliseRoleToolConfig(conversation.agentToolConfig)
        : agentModeToolConfig(settings.toolConfig);
    }
  }
  const profile = readChatProfile();
  if (profile.name || profile.identity || profile.bio || profile.details) {
    settings.persona = {
      ...(settings.persona || {}),
      irisName: profile.name || settings.persona?.irisName,
      systemPrompt: [settings.persona?.systemPrompt, profile.identity ? `Iris 的身份：${profile.identity}` : "", profile.bio ? `关于用户：${profile.bio}` : "", profile.details ? `用户档案：${profile.details}` : ""].filter(Boolean).join("\n\n")
    };
  }
  let currentDaySummary = "";
  try {
    currentDaySummary = await updateRollingDaySummary({
      conversation,
      history,
      settings,
      day: chatDayKey(target.createdAt || new Date())
    });
  } catch (e) {
    console.warn("rolling chat summary failed during regenerate:", e.message);
  }
  appendCurrentDaySummary(settings, currentDaySummary);
  try {
    let stickerPromptForDynamic = "";
    try {
      const stickerPrompt = await buildStickerPrompt(role, conversation, [...history, ...targetMessages]);
      if (stickerPrompt) {
        const preset_ = getActiveChatPreset(settings);
        if (preset_?.provider === "cc") {
          stickerPromptForDynamic = stickerPrompt;
        } else {
          settings.persona = { ...(settings.persona || {}), systemPrompt:[settings.persona?.systemPrompt, stickerPrompt].filter(Boolean).join("\n\n") };
        }
      }
    } catch (e) {
      console.warn("sticker prompt unavailable during regenerate:", e.message);
    }
    const preset = getActiveChatPreset(settings);
    const recallableMessages = history.filter(message => message.role !== "iris" && !message.recalled && String(message.content || "").trim());
    const quoteableMessages = [...history, ...targetMessages].filter(message => message?.role === "iris" && !message.recalled && (String(message.content || "").trim() || chatMessageImages(message).length));
    let relatedMemories = [];
    const automaticMemoryRecall = !!role && role.memoryEnabled !== false && settings.memory?.enabled === true;
    if (automaticMemoryRecall && userTurnContent.trim()) {
      try {
        relatedMemories = await selectRelatedMemoriesForConversation(conversation, userTurnContent, settings.memory?.categories);
      } catch (e) {
        console.warn("automatic memory recall failed during regenerate:", e.message);
      }
    }
    recordMemoryInjection(conversation, relatedMemories);
    const mcpToolset = buildConversationMcpTools(conversation);
    const result = await callFunctionModel("main", preset, () => callOpenAICompatible({
      preset,
      settings,
      content: userTurnContent,
      image: userTurnImages[0] || null,
      images: userTurnImages,
      quote: targetMessages.find(message => message.quote)?.quote || null,
      history,
      recallableMessages,
      recallOwnMessage: null,
      quoteableMessages,
      selectQuoteMessage: createAiQuoteHandler(quoteableMessages),
      generateImage: createAiImageHandler(settings, conversation.imageGenerationEnabled === true),
      mcpTools: mcpToolset.tools,
      mcpToolBindings: mcpToolset.bindings,
      relatedMemories,
      relatedMemoryLookupPerformed: automaticMemoryRecall && !!userTurnContent.trim(),
      onToolTrace: createToolActivityRecorder(conversation, conversations),
      stickerPromptForDynamic
    }));
    const stickerDirective = await extractAiStickerDirective(result.text, role, canAiSendSticker(history));
    const resultText = String(stickerDirective.text || "").trim();
    const generatedImages = normalizeChatMessageImages(result.generatedImages);
    const musicCard = ensureArray(result.musicCards)[0] || null;
    const parts = resultText
      ? (conversation.multiBubble ? splitAiParts(resultText) : [resultText.replace(/\s*\|\|\|\s*/g, " ").trim()])
      : (stickerDirective.sticker ? [""] : (result.recalledMessageIds?.length ? [] : (generatedImages.length ? [""] : (musicCard ? ["给你放这首。"] : ["我在。"]))));
    const replyGroupId = generateId();
    const now = Date.now();
    const aiMessages = parts.map((content, index) => ({
      id: generateId(),
      replyGroupId,
      inReplyToGroupId: targetGroupId,
      conversationId,
      role: "claude",
      content,
      image: index === 0 ? generatedImages[0] || null : null,
      images: index === 0 ? generatedImages : [],
      // Keep regenerated reactions at the end of the rebuilt reply too.
      sticker: index === parts.length - 1 ? stickerDirective.sticker : null,
      music: index === parts.length - 1 ? musicCard : null,
      quote: index === 0 ? result.quoteForReply || null : null,
      model: result.model || preset?.model || "",
      toolCalls: index === 0 ? ensureArray(result.toolCalls) : [],
      reasoning: index === 0 ? String(result.reasoning || "") : "",
      favorite: false,
      createdAt: new Date(now + index).toISOString(),
      updatedAt: new Date(now + index).toISOString()
    }));
    await autoTranslateMessages(aiMessages, conversation, settings);
    appendRecentToolActivity(conversation, result.toolCalls);
    discardChatMessages(replacedReplies);
    const next = list.filter(message => !removedIds.has(message.id));
    next.push(...aiMessages);
    cleanupImagesForConversation(next, conversationId, conversations);
    writeChatMessages(next);
    conversation.updatedAt = chatNow();
    writeChatConversations(conversations);
    res.json({
      ok: true,
      replacedMessageIds: [...removedIds],
      aiMessages: aiMessages.map(publicMessage),
      messages: next.filter(message => (message.conversationId || "legacy-chat") === conversationId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(publicMessage)
    });
  } catch (e) {
    appendRecentToolActivity(conversation, e.toolCalls);
    writeChatMessages(list);
    conversation.updatedAt = chatNow();
    writeChatConversations(conversations);
    res.status(502).json({ error: e.message || "重新生成失败" });
  }
});

// ---- Companion sessions and optional text-to-speech ----
const COMPANION_SCENES = new Set(["study", "vocabulary", "exercise", "sleep", "bath", "custom"]);
const COMPANION_AMBIENTS = new Set(["rain", "waves", "fire", "cafe", "wind", "none"]);
const COMPANION_AUDIO_FORMATS = new Set(["mp3", "wav", "ogg", "aac", "flac", "opus"]);

function companionSettingsForClient(settings = readCompanionSettings()) {
  const voice = settings.voice || {};
  return {
    defaultAmbient: COMPANION_AMBIENTS.has(settings.defaultAmbient) ? settings.defaultAmbient : "rain",
    wallpapers: typeof settings.wallpapers === "object" && settings.wallpapers ? settings.wallpapers : {},
    voice: {
      enabled: voice.enabled === true,
      baseUrl: String(voice.baseUrl || ""),
      model: String(voice.model || ""),
      voice: String(voice.voice || "alloy"),
      format: COMPANION_AUDIO_FORMATS.has(voice.format) ? voice.format : "mp3",
      speed: Math.max(0.25, Math.min(4, Number(voice.speed) || 1)),
      autoSpeak: voice.autoSpeak === true,
      hasApiKey: !!String(voice.apiKey || "")
    }
  };
}

function companionSessionForClient(session) {
  return {
    ...session,
    messages: ensureArray(session.messages).slice(-80)
  };
}

function findCompanionSession(id) {
  const sessions = readCompanionSessions();
  const index = sessions.findIndex(session => session.id === id);
  return { sessions, index, session: index >= 0 ? sessions[index] : null };
}

// An accepted invitation owns one durable room. Keeping that link on the card
// means a failed navigation can always be retried without creating a second
// background companion scheduler.
function createCompanionSessionForInvitation(invitation, conversation, sessions) {
  const config = invitation?.config && typeof invitation.config === "object" ? invitation.config : {};
  const scene = COMPANION_SCENES.has(invitation?.scene) ? invitation.scene : "custom";
  const timerMode = config.timerMode === "elapsed" ? "elapsed" : "countdown";
  const durationSeconds = timerMode === "elapsed" ? 0 : Math.max(60, Math.min(12 * 60 * 60, Math.round(Number(config.durationSeconds) || 25 * 60)));
  const autoEnabled = config.autoEnabled === true;
  const autoIntervalMinutes = Math.max(1, Math.min(720, Math.round(Number(config.autoIntervalMinutes) || 5)));
  const autoUntilMinutes = Math.max(0, Math.min(12 * 60, Math.round(Number(config.autoUntilMinutes) || 0)));
  const sceneNames = { study: "学习", vocabulary: "背单词", exercise: "运动", sleep: "睡眠", bath: "沐浴", custom: "自定义" };
  const now = chatNow();
  const session = {
    id: generateId(), scene,
    name: String(config.name || `${sceneNames[scene]}陪伴`).trim().slice(0, 60),
    ambient: COMPANION_AMBIENTS.has(config.ambient) ? config.ambient : readCompanionSettings().defaultAmbient,
    status: "ready", timerMode, durationSeconds, remainingSeconds: durationSeconds,
    roleId: String(conversation?.roleId || "").slice(0, 100), conversationId: String(conversation?.id || "").slice(0, 100),
    sleepMode: config.sleepMode === "night" ? "night" : "nap",
    autoEnabled, autoIntervalMinutes, autoUntilMinutes, autoUntilAt: null, autoLimit: null, autoSentCount: 0,
    lastAiMessageAt: null, nextAutoAt: null, greetedAt: null, appearance: {},
    sourceChatContext: companionSourceChatContext(conversation?.id || ""),
    messages: [], elapsedSeconds: 0, lastResumedAt: null,
    createdAt: now, startedAt: null, updatedAt: now, endedAt: null, completionMessageId: null
  };
  sessions.push(session);
  invitation.sessionId = session.id;
  invitation.updatedAt = now;
  return session;
}

function ensureCompanionSessionForInvitation(invitation, conversation) {
  if (invitation?.roomStatus === "ended") throw new Error("这次陪伴已经结束，不能重新进入");
  const sessions = readCompanionSessions();
  const existing = invitation?.sessionId ? sessions.find(session => session.id === invitation.sessionId) : null;
  if (existing) return { session: existing, sessions, created: false };
  return { session: createCompanionSessionForInvitation(invitation, conversation, sessions), sessions, created: true };
}

function markCompanionInvitationRecordsEnded(sessionIds) {
  const ids = new Set(ensureArray(sessionIds).filter(Boolean));
  if (!ids.size) return;
  const messages = readChatMessages();
  let changed = false;
  for (const message of messages) {
    const invitation = message?.companionInvitation;
    if (!invitation || !ids.has(invitation.sessionId)) continue;
    invitation.roomStatus = "ended";
    invitation.updatedAt = chatNow();
    message.updatedAt = invitation.updatedAt;
    changed = true;
  }
  if (changed) writeChatMessages(messages);
}

async function synthesizeCompanionSpeech(text, rawSettings = readCompanionSettings()) {
  const voice = rawSettings.voice || {};
  const baseUrl = normalizeApiRoot(voice.baseUrl);
  const apiKey = String(voice.apiKey || "").trim();
  const model = String(voice.model || "").trim();
  const input = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1200);
  if (voice.enabled !== true) throw new Error("语音功能尚未启用");
  if (!baseUrl || !apiKey || !model) throw new Error("请先在陪伴页的声音设置中填写 TTS Base URL、API Key 与模型");
  if (!input) throw new Error("没有可转换成语音的文字");
  const format = COMPANION_AUDIO_FORMATS.has(voice.format) ? voice.format : "mp3";
  const response = await fetch(`${baseUrl}/audio/speech`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input,
      voice: String(voice.voice || "alloy"),
      response_format: format,
      speed: Math.max(0.25, Math.min(4, Number(voice.speed) || 1))
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`语音请求失败 ${response.status}${detail ? `：${detail.slice(0, 180)}` : ""}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("语音服务没有返回音频");
  if (bytes.length > 12 * 1024 * 1024) throw new Error("语音文件超过 12MB，未保存");
  const file = `voice-${Date.now().toString(36)}-${randomUUID()}.${format}`;
  writeFileSync(join(COMPANION_AUDIO_DIR, file), bytes);
  const mime = ({ mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac", flac: "audio/flac", opus: "audio/ogg" })[format] || "audio/mpeg";
  return { url: `/companion-audio/${file}?key=${encodeURIComponent(API_KEY)}`, mime, text: input, createdAt: chatNow() };
}

const COMPANION_SCENE_NAMES = { study: "学习", vocabulary: "背单词", exercise: "运动", sleep: "睡眠", bath: "沐浴", custom: "自定义" };
function companionInvitationActivityName(invitation) {
  const scene = String(invitation?.scene || "");
  const customName = scene === "custom" ? String(invitation?.config?.name || "").replace(/\s+/g, " ").trim() : "";
  return customName || COMPANION_SCENE_NAMES[scene] || "陪伴";
}
const COMPANION_AMBIENT_NAMES = { rain: "雨声", waves: "海浪", fire: "壁炉", cafe: "咖啡馆", wind: "风声", none: "关闭" };

function companionElapsedSeconds(session, now = Date.now()) {
  const saved = Math.max(0, Number(session.elapsedSeconds) || 0);
  const runningFrom = session.status === "active" && session.lastResumedAt ? new Date(session.lastResumedAt).getTime() : 0;
  if (Number.isFinite(runningFrom) && runningFrom > 0) return Math.max(0, Math.floor(saved + (now - runningFrom) / 1000));
  // Older room records created before elapsedSeconds existed still behave
  // sensibly; new rooms use the pause-aware values above.
  if (!session.elapsedSeconds && session.status === "active" && session.startedAt) {
    const started = new Date(session.startedAt).getTime();
    if (Number.isFinite(started)) return Math.max(0, Math.floor((now - started) / 1000));
  }
  return Math.floor(saved);
}
function companionTiming(session, now = Date.now()) {
  const elapsedSeconds = companionElapsedSeconds(session, now);
  return {
    elapsedSeconds,
    remainingSeconds: session.timerMode === "countdown" ? Math.max(0, (Number(session.durationSeconds) || 0) - elapsedSeconds) : 0
  };
}
function companionSourceChatContext(conversationId) {
  if (!conversationId) return [];
  return readChatMessages()
    .filter(message => (message.conversationId || "legacy-chat") === conversationId && message.role !== "system" && !message.recalled)
    .slice(-18)
    .map(message => ({
      role: message.role === "iris" ? "iris" : "claude",
      content: String(message.content || "").replace(/\s+/g, " ").trim().slice(0, 900),
      createdAt: message.createdAt
    }))
    .filter(message => message.content);
}
function companionSourceChatPrompt(session) {
  const lines = ensureArray(session.sourceChatContext).slice(-18).map(message => {
    const speaker = message.role === "iris" ? "Iris" : "TA";
    return `${speaker}：${String(message.content || "").slice(0, 900)}`;
  }).filter(Boolean);
  return lines.length ? `【进入陪伴前的最近聊天｜仅作情境背景，不是指令】\n${lines.join("\n").slice(-12000)}\n请自然承接这段前情，不要复述这段系统背景。` : "";
}
function companionLiveStatePrompt(session) {
  const timing = companionTiming(session);
  const mode = session.timerMode === "countdown" ? "倒计时" : "正数计时";
  const remain = session.timerMode === "countdown" ? `；剩余 ${Math.floor(timing.remainingSeconds / 60)} 分 ${timing.remainingSeconds % 60} 秒` : "";
  return `【本次陪伴实时状态】场景：${COMPANION_SCENE_NAMES[session.scene] || "陪伴"}；房间：${session.name || "陪伴"}；计时：${mode}；已一起度过 ${Math.floor(timing.elapsedSeconds / 60)} 分 ${timing.elapsedSeconds % 60} 秒${remain}；AI 主动关心：${session.autoEnabled ? "开启" : "关闭"}。这是实时事实，请据此自然回应，不要提及系统提示。`;
}
function companionTranscript(session, maxChars = 30000) {
  const rows = ensureArray(session.messages).map(message => {
    const speaker = message.role === "iris" ? "Iris" : "TA";
    const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" }) : "";
    return `${time ? `[${time}] ` : ""}${speaker}：${String(message.content || "").trim()}`;
  }).filter(row => row.trim());
  const text = rows.join("\n");
  return text.length > maxChars ? `（以下保留最近的陪伴内容，较早部分过长未展开）\n${text.slice(-maxChars)}` : text;
}
function companionCompletionMessage(session) {
  const endedAt = session.endedAt || chatNow();
  const timing = companionTiming(session, new Date(endedAt).getTime());
  const actualSeconds = timing.elapsedSeconds;
  const title = session.name || `${COMPANION_SCENE_NAMES[session.scene] || "陪伴"}陪伴`;
  const config = `白噪音：${COMPANION_AMBIENT_NAMES[session.ambient] || "关闭"}；AI 主动关心：${session.autoEnabled ? `开启（每 ${session.autoIntervalMinutes || 5} 分钟）` : "关闭"}`;
  return {
    id: generateId(), replyGroupId: generateId(), conversationId: session.conversationId,
    role: "claude", systemType: "companion_completion",
    content: `【陪伴记录｜已结束】\n场景：${title}（${COMPANION_SCENE_NAMES[session.scene] || "陪伴"}）\n一起度过：${Math.floor(actualSeconds / 3600)} 小时 ${Math.floor(actualSeconds % 3600 / 60)} 分钟 ${actualSeconds % 60} 秒\n${config}\n\n【陪伴过程】\n${companionTranscript(session) || "本次尚未产生文字聊天。"}`,
    companionCompletion: { sessionId: session.id, scene: session.scene, name: title, startedAt: session.startedAt || null, endedAt, actualSeconds, ambient: session.ambient, autoEnabled: !!session.autoEnabled, autoIntervalMinutes: Number(session.autoIntervalMinutes) || 0, messageCount: ensureArray(session.messages).length },
    favorite: false, createdAt: endedAt, updatedAt: endedAt
  };
}
function companionChatSettingsFor(session) {
  const settings = readChatSettings();
  const conversation = readChatConversations().find(item => item.id === session.conversationId);
  if (conversation?.presetId && conversation?.model) {
    settings.activePresetId = conversation.presetId;
    settings.presets = ensureArray(settings.presets).map(item => item.id === conversation.presetId ? { ...item, model: conversation.model } : item);
  }
  const role = readChatRoles().find(item => item.id === session.roleId || item.id === conversation?.roleId);
  const rolePrompt = role ? [role.identity ? `你的身份：${role.identity}` : "", role.relationship ? `你与 Iris 的关系：${role.relationship}` : "", role.prompt || ""].filter(Boolean).join("\n\n") : "";
  const profile = readChatProfile();
  const profilePrompt = (profile.name || profile.identity || profile.bio || profile.details)
    ? [profile.identity ? `Iris 的身份：${profile.identity}` : "", profile.bio ? `关于用户：${profile.bio}` : "", profile.details ? `用户档案：${profile.details}` : ""].filter(Boolean).join("\n\n")
    : "";
  return {
    ...settings,
    memory: { ...(settings.memory || {}), enabled: false },
    // A companion room remains part of the same day, so keep the chat's
    // weather, calendar and daily-state injection available.
    calendar: { ...(settings.calendar || {}), dailyContext: true },
    persona: {
      ...(settings.persona || {}),
      irisName: profile.name || settings.persona?.irisName,
      systemPrompt: [
        rolePrompt || settings.persona?.systemPrompt || DEFAULT_CHAT_SETTINGS.persona.systemPrompt,
        profilePrompt,
        companionSourceChatPrompt(session),
        `你正在“${session.name}”陪伴房间中和 Iris 相处。现在的场景是${COMPANION_SCENE_NAMES[session.scene] || "陪伴"}。回复温柔、自然、简短，通常 1–3 句；不要声称会在后台提醒，不调用工具，也不要解释系统规则。`
      ].filter(Boolean).join("\n\n")
    }
  };
}
async function createCompanionAiReply(session, content, { automatic = false } = {}) {
  const settings = companionChatSettingsFor(session);
  const result = await callOpenAICompatible({
    preset: getActiveChatPreset(settings), settings, content: `${companionLiveStatePrompt(session)}\n\n${content}`,
    history: ensureArray(session.messages).slice(-24)
  });
  const now = chatNow();
  const replyGroupId = generateId();
  const parts = splitAiParts(String(result.text || "我在这里陪着你。").trim());
  const replies = parts.map((part, index) => ({
    id: generateId(), replyGroupId, role: "claude", content: part,
    automatic, createdAt: new Date(new Date(now).getTime() + index).toISOString()
  }));
  const reply = replies.at(-1);
  session.messages = ensureArray(session.messages); session.messages.push(...replies);
  session.lastAiMessageAt = now;
  const hasRemainingAutomaticMessages = session.autoLimit === null || session.autoLimit === undefined || session.autoSentCount < session.autoLimit;
  const insideAutomaticWindow = !session.autoUntilAt || new Date(session.autoUntilAt).getTime() > Date.now();
  session.nextAutoAt = session.autoEnabled && hasRemainingAutomaticMessages && insideAutomaticWindow
    ? new Date(Date.now() + Math.max(1, Number(session.autoIntervalMinutes) || 5) * 60000).toISOString()
    : null;
  if (automatic) session.autoSentCount = Math.max(0, Number(session.autoSentCount) || 0) + 1;
  session.updatedAt = now;
  return reply;
}

app.get("/api/companion/settings", apiAuth, (req, res) => {
  res.json(companionSettingsForClient());
});
app.put("/api/companion/settings", apiAuth, (req, res) => {
  const current = readCompanionSettings();
  const requestedVoice = req.body?.voice || {};
  const next = {
    ...current,
    defaultAmbient: COMPANION_AMBIENTS.has(req.body?.defaultAmbient) ? req.body.defaultAmbient : current.defaultAmbient,
    wallpapers: typeof req.body?.wallpapers === "object" && req.body.wallpapers ? req.body.wallpapers : (current.wallpapers || {}),
    voice: {
      ...current.voice,
      enabled: requestedVoice.enabled === true,
      baseUrl: String(requestedVoice.baseUrl ?? current.voice.baseUrl ?? "").trim().slice(0, 500),
      apiKey: String(requestedVoice.apiKey || "").trim() || current.voice.apiKey || "",
      model: String(requestedVoice.model ?? current.voice.model ?? "").trim().slice(0, 160),
      voice: String(requestedVoice.voice ?? current.voice.voice ?? "alloy").trim().slice(0, 100) || "alloy",
      format: COMPANION_AUDIO_FORMATS.has(requestedVoice.format) ? requestedVoice.format : current.voice.format,
      speed: Math.max(0.25, Math.min(4, Number(requestedVoice.speed) || 1)),
      autoSpeak: requestedVoice.autoSpeak === true
    }
  };
  writeCompanionSettings(next);
  res.json(companionSettingsForClient(next));
});

app.get("/api/companion/sessions", apiAuth, (req, res) => {
  res.json({ sessions: readCompanionSessions().slice(-100).reverse().map(companionSessionForClient) });
});
// Finished records are safe to remove from the statistics page. Active,
// paused and ready rooms deliberately stay protected here.
app.delete("/api/companion/sessions/:id", apiAuth, (req, res) => {
  const { sessions, index, session } = findCompanionSession(req.params.id);
  if (index < 0) return res.status(404).json({ error: "陪伴记录不存在" });
  if (!session.endedAt || session.status !== "ended") return res.status(409).json({ error: "只能删除已经结束的陪伴记录" });
  sessions.splice(index, 1);
  writeCompanionSessions(sessions);
  markCompanionInvitationRecordsEnded([session.id]);
  res.json({ deletedId: req.params.id });
});
app.delete("/api/companion/sessions", apiAuth, (req, res) => {
  const sessions = readCompanionSessions();
  const deletedIds = sessions.filter(session => session.status === "ended" && session.endedAt).map(session => session.id);
  const remaining = sessions.filter(session => !(session.status === "ended" && session.endedAt));
  const deleted = sessions.length - remaining.length;
  writeCompanionSessions(remaining);
  markCompanionInvitationRecordsEnded(deletedIds);
  res.json({ deleted });
});
app.post("/api/companion/sessions", apiAuth, (req, res) => {
  const scene = COMPANION_SCENES.has(req.body?.scene) ? req.body.scene : "custom";
  const now = chatNow();
  const timerMode = req.body?.timerMode === "elapsed" ? "elapsed" : "countdown";
  const durationSeconds = timerMode === "elapsed" ? 0 : Math.max(60, Math.min(12 * 60 * 60, Math.round(Number(req.body?.durationSeconds) || 25 * 60)));
  const roleId = String(req.body?.roleId || "").slice(0, 100);
  const conversationId = String(req.body?.conversationId || "").slice(0, 100);
  const autoEnabled = req.body?.autoEnabled === true;
  const autoIntervalMinutes = Math.max(1, Math.min(720, Math.round(Number(req.body?.autoIntervalMinutes) || 5)));
  const autoUntilMinutes = Math.max(0, Math.min(12 * 60, Math.round(Number(req.body?.autoUntilMinutes) || 0)));
  const autoLimit = null;
  if (autoEnabled && timerMode === "countdown" && autoIntervalMinutes * 60 > durationSeconds) return res.status(400).json({ error: "AI 回复间隔不能超过本次时长" });
  const sceneNames = { study: "学习", vocabulary: "背单词", exercise: "运动", sleep: "睡眠", bath: "沐浴", custom: "自定义" };
  const item = {
    id: generateId(), scene,
    name: String(req.body?.name || `${sceneNames[scene]}陪伴`).trim().slice(0, 60),
    ambient: COMPANION_AMBIENTS.has(req.body?.ambient) ? req.body.ambient : readCompanionSettings().defaultAmbient,
    status: "ready", timerMode, durationSeconds, remainingSeconds: durationSeconds,
    roleId, conversationId, sleepMode: req.body?.sleepMode === "night" ? "night" : "nap",
    autoEnabled, autoIntervalMinutes, autoUntilMinutes, autoUntilAt: null, autoLimit, autoSentCount: 0,
    lastAiMessageAt: null, nextAutoAt: null, greetedAt: null, appearance: {},
    // Snapshot the conversation before entering the room. It gives the room
    // context without creating a new model request or coupling it to a live UI.
    sourceChatContext: companionSourceChatContext(conversationId),
    messages: [], elapsedSeconds: 0, lastResumedAt: null,
    createdAt: now, startedAt: null, updatedAt: now, endedAt: null, completionMessageId: null
  };
  const sessions = readCompanionSessions(); sessions.push(item); writeCompanionSessions(sessions.slice(-100));
  res.status(201).json(companionSessionForClient(item));
});
app.post("/api/companion/sessions/:id/start", apiAuth, (req, res) => {
  const { sessions, index, session } = findCompanionSession(req.params.id);
  if (index < 0) return res.status(404).json({ error: "陪伴记录不存在" });
  if (session.status !== "ready") return res.status(400).json({ error: "这个陪伴房间已经开始或结束" });
  const now = chatNow();
  session.status = "active"; session.startedAt = now; session.elapsedSeconds = 0; session.lastResumedAt = now; session.updatedAt = now;
  if (session.scene === "sleep" && session.autoEnabled && Number(session.autoUntilMinutes) > 0) session.autoUntilAt = new Date(Date.now() + Number(session.autoUntilMinutes) * 60000).toISOString();
  sessions[index] = session; writeCompanionSessions(sessions);
  res.json(companionSessionForClient(session));
});
app.post("/api/companion/sessions/:id/greet", apiAuth, async (req, res) => {
  const { sessions, index, session } = findCompanionSession(req.params.id);
  if (index < 0) return res.status(404).json({ error: "陪伴记录不存在" });
  if (session.status !== "active") return res.status(400).json({ error: "请先开始本次陪伴" });
  if (session.greetedAt) return res.json({ reply: ensureArray(session.messages).find(item => item.id === session.greetingMessageId) || null, session: companionSessionForClient(session) });
  try {
    const scene = COMPANION_SCENE_NAMES[session.scene] || "陪伴";
    const reply = await createCompanionAiReply(session, `现在刚进入${scene}陪伴房间。请先自然地向 Iris 问好，并用一句话说明你会陪在这里。`, { automatic: false });
    session.greetedAt = chatNow(); session.greetingMessageId = reply.id;
    sessions[index] = session; writeCompanionSessions(sessions);
    res.json({ reply, session: companionSessionForClient(session) });
  } catch (error) { res.status(502).json({ error: error.message || "开场问候失败" }); }
});
app.put("/api/companion/sessions/:id", apiAuth, (req, res) => {
  const { sessions, index, session } = findCompanionSession(req.params.id);
  if (index < 0) return res.status(404).json({ error: "陪伴记录不存在" });
  const now = chatNow();
  const requestedStatus = ["ready", "active", "paused", "ended"].includes(req.body?.status) ? req.body.status : session.status;
  if (session.status === "active" && requestedStatus !== "active") {
    session.elapsedSeconds = companionElapsedSeconds(session, Date.now());
    session.lastResumedAt = null;
  } else if (session.status !== "active" && requestedStatus === "active" && session.startedAt) {
    session.lastResumedAt = now;
  }
  session.status = requestedStatus;
  if (req.body?.remainingSeconds !== undefined && !session.lastResumedAt) session.remainingSeconds = Math.max(0, Math.min(session.durationSeconds, Math.round(Number(req.body.remainingSeconds) || 0)));
  if (COMPANION_AMBIENTS.has(req.body?.ambient)) session.ambient = req.body.ambient;
  if (req.body?.autoEnabled !== undefined) session.autoEnabled = req.body.autoEnabled === true;
  if (req.body?.autoIntervalMinutes !== undefined) session.autoIntervalMinutes = Math.max(1, Math.min(720, Math.round(Number(req.body.autoIntervalMinutes) || 5)));
  if (req.body?.autoUntilMinutes !== undefined) session.autoUntilMinutes = Math.max(0, Math.min(12 * 60, Math.round(Number(req.body.autoUntilMinutes) || 0)));
  if (req.body?.appearance && typeof req.body.appearance === "object") {
    const currentAppearance = session.appearance && typeof session.appearance === "object" ? session.appearance : {};
    const nextAppearance = { ...currentAppearance };
    for (const key of ["userBubble", "taBubble", "userText", "taText"]) {
      if (typeof req.body.appearance[key] === "string" && /^#[0-9a-f]{6}$/i.test(req.body.appearance[key])) nextAppearance[key] = req.body.appearance[key];
    }
    if (req.body.appearance.opacity !== undefined) nextAppearance.opacity = Math.max(0.2, Math.min(1, Number(req.body.appearance.opacity) || 0.88));
    if (req.body.appearance.bubbleWidth !== undefined) nextAppearance.bubbleWidth = Math.max(45, Math.min(100, Math.round(Number(req.body.appearance.bubbleWidth) || 100)));
    if (req.body.appearance.bubbleFontSize !== undefined) nextAppearance.bubbleFontSize = Math.max(12, Math.min(24, Math.round(Number(req.body.appearance.bubbleFontSize) || 12)));
    session.appearance = nextAppearance;
  }
  if (session.scene === "sleep" && session.autoEnabled && session.startedAt && Number(session.autoUntilMinutes) > 0) session.autoUntilAt = new Date(new Date(session.startedAt).getTime() + session.autoUntilMinutes * 60000).toISOString();
  else if (session.scene !== "sleep" || !session.autoEnabled || Number(session.autoUntilMinutes) <= 0) session.autoUntilAt = null;
  if (session.autoEnabled && !session.nextAutoAt && session.lastAiMessageAt && (session.autoLimit === null || session.autoSentCount < session.autoLimit)) session.nextAutoAt = new Date(new Date(session.lastAiMessageAt).getTime() + session.autoIntervalMinutes * 60000).toISOString();
  if (!session.autoEnabled) session.nextAutoAt = null;
  const timing = companionTiming(session);
  if (session.timerMode === "countdown") session.remainingSeconds = timing.remainingSeconds;
  if (session.timerMode === "countdown" && session.remainingSeconds <= 0) session.status = "ended";
  if (session.status === "ended" && !session.endedAt) session.endedAt = now;
  session.updatedAt = now; sessions[index] = session; writeCompanionSessions(sessions);
  res.json(companionSessionForClient(session));
});
// Finish is deliberately a separate, idempotent action.  It first preserves
// the room transcript in the ordinary chat timeline, so a later model reply,
// rolling daily summary and diary all see the same completed event.
app.post("/api/companion/sessions/:id/complete", apiAuth, (req, res) => {
  const { sessions, index, session } = findCompanionSession(req.params.id);
  if (index < 0) return res.status(404).json({ error: "陪伴记录不存在" });
  if (session.completionMessageId) return res.json({ session: companionSessionForClient(session), completionMessageId: session.completionMessageId });
  const now = chatNow();
  if (session.status === "active") {
    session.elapsedSeconds = companionElapsedSeconds(session, Date.now());
    session.lastResumedAt = null;
  }
  const timing = companionTiming(session, Date.now());
  if (session.timerMode === "countdown") session.remainingSeconds = timing.remainingSeconds;
  session.status = "ended";
  session.endedAt = now;
  session.updatedAt = now;
  let completion = null;
  const conversation = readChatConversations().find(item => item.id === session.conversationId);
  if (conversation) {
    completion = companionCompletionMessage(session);
    const messages = readChatMessages();
    messages.push(completion);
    writeChatMessages(messages);
    conversation.updatedAt = now;
    const conversations = readChatConversations();
    const position = conversations.findIndex(item => item.id === conversation.id);
    if (position >= 0) { conversations[position] = conversation; writeChatConversations(conversations); }
    session.completionMessageId = completion.id;
  }
  sessions[index] = session;
  writeCompanionSessions(sessions);
  res.json({ session: companionSessionForClient(session), completion: completion ? publicMessage(completion) : null, completionMessageId: session.completionMessageId || null });
});
app.post("/api/companion/sessions/:id/message", apiAuth, async (req, res) => {
  const { sessions, index, session } = findCompanionSession(req.params.id);
  if (index < 0) return res.status(404).json({ error: "陪伴记录不存在" });
  const content = String(req.body?.content || "").trim().slice(0, 1600);
  if (!content) return res.status(400).json({ error: "请输入想说的话" });
  const now = chatNow();
  const userMessage = { id: generateId(), role: "iris", content, createdAt: now };
  session.messages = ensureArray(session.messages); session.messages.push(userMessage);
  try {
    const reply = await createCompanionAiReply(session, content, { automatic: false });
    if (req.body?.speak === true) {
      try { reply.audio = await synthesizeCompanionSpeech(reply.content); }
      catch (voiceError) { reply.voiceError = voiceError.message; }
    }
    session.updatedAt = chatNow(); sessions[index] = session; writeCompanionSessions(sessions);
    res.json({ userMessage, reply, session: companionSessionForClient(session) });
  } catch (error) {
    session.messages.pop(); sessions[index] = session; writeCompanionSessions(sessions);
    res.status(502).json({ error: error.message || "陪伴消息发送失败" });
  }
});
app.post("/api/companion/sessions/:id/messages", apiAuth, (req, res) => {
  const { sessions, index, session } = findCompanionSession(req.params.id);
  if (index < 0) return res.status(404).json({ error: "陪伴记录不存在" });
  if (session.status !== "active") return res.status(400).json({ error: "请先开始本次陪伴" });
  const content = String(req.body?.content || "").trim().slice(0, 1600);
  if (!content) return res.status(400).json({ error: "请输入想说的话" });
  const userMessage = { id: generateId(), role: "iris", content, createdAt: chatNow() };
  session.messages = ensureArray(session.messages); session.messages.push(userMessage);
  session.updatedAt = chatNow(); sessions[index] = session; writeCompanionSessions(sessions);
  res.status(201).json({ userMessage, session: companionSessionForClient(session) });
});
app.post("/api/companion/sessions/:id/reply", apiAuth, async (req, res) => {
  const { sessions, index, session } = findCompanionSession(req.params.id);
  if (index < 0) return res.status(404).json({ error: "陪伴记录不存在" });
  if (session.status !== "active") return res.status(400).json({ error: "请先开始本次陪伴" });
  const lastMessage = ensureArray(session.messages).at(-1);
  if (!lastMessage || lastMessage.role !== "iris") return res.status(400).json({ error: "先发送一句话，再请 TA 回复" });
  try {
    const reply = await createCompanionAiReply(session, lastMessage.content, { automatic: false });
    sessions[index] = session; writeCompanionSessions(sessions);
    res.json({ reply, session: companionSessionForClient(session) });
  } catch (error) { res.status(502).json({ error: error.message || "TA 回复失败" }); }
});
app.post("/api/companion/speech", apiAuth, async (req, res) => {
  try { res.json({ audio: await synthesizeCompanionSpeech(req.body?.text) }); }
  catch (error) { res.status(502).json({ error: error.message || "语音生成失败" }); }
});

// The timer runs on the server, not in the phone browser: a locked screen must
// not create duplicate messages or reset the next check-in time.
const companionAutoInFlight = new Set();
setInterval(async () => {
  const sessions = readCompanionSessions();
  let changed = false;
  for (const session of sessions) {
    // A countdown must also end on the server. Previously only companion.html
    // made this transition, so a failed redirect left an invisible active room
    // that continued spending API quota indefinitely.
    if (session.status === "active" && session.timerMode === "countdown" && companionTiming(session).remainingSeconds <= 0) {
      session.elapsedSeconds = companionElapsedSeconds(session, Date.now());
      session.remainingSeconds = 0;
      session.lastResumedAt = null;
      session.status = "ended";
      session.endedAt ||= chatNow();
      session.nextAutoAt = null;
      session.updatedAt = chatNow();
      changed = true;
      continue;
    }
    if (session.status !== "active" || session.autoEnabled !== true || !session.nextAutoAt) continue;
    if (session.autoUntilAt && new Date(session.autoUntilAt).getTime() <= Date.now()) { session.nextAutoAt = null; changed = true; continue; }
    if (session.autoLimit !== null && session.autoLimit !== undefined && (Number(session.autoSentCount) || 0) >= Number(session.autoLimit)) { session.nextAutoAt = null; changed = true; continue; }
    if (new Date(session.nextAutoAt).getTime() > Date.now() || companionAutoInFlight.has(session.id)) continue;
    companionAutoInFlight.add(session.id);
    try {
      await createCompanionAiReply(session, `现在是${COMPANION_SCENE_NAMES[session.scene] || "陪伴"}进行中。请主动轻轻关心 Iris 一句，贴合场景且不要重复前面的表达。`, { automatic: true });
      if ((session.autoLimit !== null && session.autoLimit !== undefined && (Number(session.autoSentCount) || 0) >= Number(session.autoLimit)) || (session.autoUntilAt && new Date(session.autoUntilAt).getTime() <= Date.now())) session.nextAutoAt = null;
      changed = true;
    } catch (error) {
      // Do not retry in a tight loop: preserve the next normal interval after a
      // provider failure, rather than burning more model calls.
      console.warn("companion automatic reply failed:", error.message);
      session.nextAutoAt = new Date(Date.now() + Math.max(1, Number(session.autoIntervalMinutes) || 5) * 60000).toISOString();
      changed = true;
    } finally { companionAutoInFlight.delete(session.id); }
  }
  if (changed) writeCompanionSessions(sessions);
}, 60 * 1000).unref();

// 日记只在 Iris 主动提出时由当前对话写入。自动定时生成已停用：
// 它可能在一天尚未结束时提前生成，也会产生额外模型调用费用。

// ---- 站内聊天提醒文本 ----
function chatNotificationLine(message) {
  const text = String(message?.content || "").replace(/\s+/g, " ").trim();
  if (text) return text;
  if (message?.music) return `给你分享了一首歌：${String(message.music.title || message.music.name || "一首歌").trim()}`;
  if (message?.sticker) return "给你发了一个表情包";
  if (message?.image || ensureArray(message?.images).length) return "给你发了一张图片";
  return "给你发来了一条消息";
}
function shortenNotificationText(text, limit = 180) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, Math.max(1, limit - 1))}…` : value;
}

// ---- 一起听：房间、共同歌单与音乐源刷新 ----
function listeningTrack(raw = {}) {
  return {
    songId:Math.max(0, Math.floor(Number(raw.songId || raw.song_id) || 0)),
    songName:String(raw.songName || raw.name || "未知歌曲").trim().slice(0, 180) || "未知歌曲",
    artistName:String(raw.artistName || raw.artist || "未知歌手").trim().slice(0, 180) || "未知歌手",
    coverUrl:/^https:\/\//i.test(String(raw.coverUrl || raw.cover || "").trim()) ? String(raw.coverUrl || raw.cover).trim().slice(0, 3000) : "",
    duration:Math.max(0, Math.min(14400, Math.round(Number(raw.duration) || 0))),
    lyrics:String(raw.lyrics || "").slice(0, 50000),
    translationLyrics:String(raw.translationLyrics || raw.translation_lyrics || raw.tlyric || "").slice(0, 50000),
    audioUrl:/^https:\/\//i.test(String(raw.audioUrl || "").trim()) ? String(raw.audioUrl).trim().slice(0, 4000) : "",
    refreshedAt:String(raw.refreshedAt || raw.updatedAt || "")
  };
}
function listeningMusicConnector() {
  return readChatMcpConnectors().find(connector => connector.enabled !== false && connector.endpoint && (
    connector.kind === "music_player" || ensureArray(connector.tools).some(tool => /^(play_music|play_music_by_id)$/i.test(String(tool?.name || "")))
  )) || null;
}
function listeningMcpValue(result = {}) {
  const values = [result.structuredContent, ...ensureArray(result.content).filter(item => item?.type === "text").map(item => {
    try { return JSON.parse(String(item.text || "")); } catch { return null; }
  })];
  return values.find(value => value && typeof value === "object") || null;
}
async function callListeningMusicTool(name, args = {}) {
  const connector = listeningMusicConnector();
  if (!connector) throw new Error("还没有可用的音乐 MCP 连接器，请先在聊天的 MCP 设置中启用音乐播放器");
  return await withMcpSession(connector, async sessionId => {
    const response = await mcpRemoteRequest(connector, "tools/call", { name, arguments:args }, sessionId);
    const result = response.result || {};
    if (result.isError) throw new Error(String(ensureArray(result.content).map(item => item?.text || "").join(" ") || "音乐服务返回错误").slice(0, 300));
    return result;
  });
}
async function listeningTrackById(songId) {
  const id = Math.max(0, Math.floor(Number(songId) || 0));
  if (!id) throw new Error("歌曲 ID 无效");
  const result = await callListeningMusicTool("play_music_by_id", { song_id:id });
  const item = listeningTrack(mcpMusicPayload(result) || listeningMcpValue(result) || {});
  if (!item.songId) item.songId = id;
  if (!item.audioUrl) throw new Error("这首歌暂时没有可播放音源");
  item.refreshedAt = chatNow();
  return item;
}
async function listeningSearch(query, limit = 8) {
  const keyword = String(query || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!keyword) throw new Error("请输入歌名或歌手");
  const result = await callListeningMusicTool("search_music", { keywords:keyword, limit:Math.max(1, Math.min(12, Math.round(Number(limit) || 8))) });
  const value = listeningMcpValue(result) || {};
  return ensureArray(value.tracks).map(listeningTrack).filter(track => track.songId);
}
function listeningPosition(room, now = Date.now()) {
  const playback = room?.playback || {};
  const saved = Math.max(0, Number(playback.positionSeconds) || 0);
  if (playback.status !== "playing" || !playback.startedAt) return saved;
  const started = new Date(playback.startedAt).getTime();
  return Number.isFinite(started) ? Math.max(0, saved + (now - started) / 1000) : saved;
}
function listeningElapsed(room, now = Date.now()) {
  const saved = Math.max(0, Number(room?.playedSeconds) || 0);
  const playback = room?.playback || {};
  if (playback.status !== "playing" || !playback.startedAt) return saved;
  const started = new Date(playback.startedAt).getTime();
  return Number.isFinite(started) ? Math.max(0, Math.floor(saved + (now - started) / 1000)) : saved;
}
function commitListeningClock(room, now = Date.now()) {
  room.playedSeconds = listeningElapsed(room, now);
  room.playback ||= {};
  room.playback.positionSeconds = listeningPosition(room, now);
  room.playback.startedAt = null;
  return room;
}
function listeningRoomForClient(room) {
  if (!room) return null;
  const now = Date.now();
  const currentTrack = room.queue?.[Math.max(0, Number(room.queueIndex) || 0)] || room.currentTrack || null;
  const conversation = readChatConversations().find(item => item.id === room.conversationId);
  const role = readChatRoles().find(item => item.id === room.roleId || item.id === conversation?.roleId) || {};
  const profile = readChatProfile() || {};
  return {
    ...room,
    participantInfo: {
      iris: { name: String(profile.name || "Iris").slice(0, 32), avatar: String(profile.avatar || "") },
      claude: { name: String(role.name || "TA").slice(0, 32), avatar: String(role.avatar || "") }
    },
    queue:ensureArray(room.queue).map(listeningTrack),
    currentTrack:currentTrack ? listeningTrack(currentTrack) : null,
    playback:{ ...(room.playback || {}), positionSeconds:Math.round(listeningPosition(room, now) * 10) / 10 },
    playedSeconds:listeningElapsed(room, now),
    messages:ensureArray(room.messages).slice(-100)
  };
}
function findListeningRoom(id) {
  const rooms = readListeningRooms(); const index = rooms.findIndex(room => room.id === id);
  return { rooms, index, room:index >= 0 ? rooms[index] : null };
}
function createListeningRoomForInvitation(invitation, conversation, rooms) {
  const now = chatNow();
  const room = {
    id:generateId(), conversationId:String(conversation?.id || ""), roleId:String(conversation?.roleId || ""),
    status:"active", participants:{ iris:true, claude:true }, queue:[], queueIndex:0,
    currentTrack:null, playback:{ status:"paused", positionSeconds:0, startedAt:null },
    playMode:"order", playedSeconds:0, messages:[], sourceChatContext:companionSourceChatContext(conversation?.id || ""),
    createdAt:now, startedAt:now, updatedAt:now, endedAt:null, completionMessageId:null
  };
  rooms.push(room); invitation.roomId = room.id; invitation.updatedAt = now;
  return room;
}
function ensureListeningRoomForInvitation(invitation, conversation) {
  if (invitation?.roomStatus === "ended") throw new Error("这次一起听已经结束，不能重新进入");
  const rooms = readListeningRooms();
  const existing = invitation?.roomId ? rooms.find(room => room.id === invitation.roomId) : null;
  return existing ? { room:existing, rooms, created:false } : { room:createListeningRoomForInvitation(invitation, conversation, rooms), rooms, created:true };
}
function markListeningInvitationsEnded(roomId) {
  const messages = readChatMessages(); let changed = false; const now = chatNow();
  messages.forEach(message => { if (message?.listeningInvitation?.roomId === roomId) { message.listeningInvitation.roomStatus = "ended"; message.listeningInvitation.updatedAt = now; message.updatedAt = now; changed = true; } });
  if (changed) writeChatMessages(messages);
}
function listeningCompletionMessage(room) {
  const seconds = Math.max(0, Number(room.playedSeconds) || 0);
  const tracks = ensureArray(room.queue).map(listeningTrack).map(track => ({ songName:track.songName, artistName:track.artistName, songId:track.songId })).filter(track => track.songId);
  const chat = ensureArray(room.messages).map(message => ({ role:message.role === "iris" ? "iris" : "claude", content:String(message.content || "").trim(), createdAt:message.createdAt || null })).filter(message => message.content).slice(-100);
  return { id:generateId(), replyGroupId:generateId(), conversationId:room.conversationId, role:"claude", systemType:"listening_completion",
    content:`【一起听记录｜已结束】\n一起听了 ${Math.floor(seconds / 3600)} 小时 ${Math.floor(seconds % 3600 / 60)} 分钟 ${seconds % 60} 秒${room.currentTrack ? `\n最后播放：${room.currentTrack.songName} — ${room.currentTrack.artistName}` : ""}`,
    listeningCompletion:{ roomId:room.id, startedAt:room.startedAt, endedAt:room.endedAt, playedSeconds:seconds, track:room.currentTrack ? listeningTrack(room.currentTrack) : null, tracks, chat }, favorite:false, createdAt:room.endedAt || chatNow(), updatedAt:room.endedAt || chatNow() };
}
function listeningLibraryScope(library, roleId) {
  const key = String(roleId || "personal").trim().slice(0, 100) || "personal";
  library.profiles ||= {};
  if (!library.profiles[key]) {
    library.profiles[key] = library.scoped ? { favorites:[], recent:[] } : { favorites:[...library.favorites], recent:[...library.recent] };
    library.scoped = true;
  }
  const scoped = library.profiles[key];
  scoped.favorites = ensureArray(scoped.favorites); scoped.recent = ensureArray(scoped.recent);
  return scoped;
}
function publicListeningLibrary(roleId, library = readListeningLibrary()) {
  if (String(roleId || "").trim() === "all") {
    const groups = Object.entries(library.profiles || {});
    if (!groups.length && (library.favorites.length || library.recent.length)) groups.push(["personal", library]);
    const recent = groups.flatMap(([libraryRoleId, scoped]) => ensureArray(scoped?.recent).map(item => ({ ...listeningTrack(item), libraryRoleId })))
      .sort((a, b) => new Date(b.playedAt || 0) - new Date(a.playedAt || 0));
    return { favorites:[], recent };
  }
  const scoped = listeningLibraryScope(library, roleId);
  return { favorites:scoped.favorites.map(listeningTrack), recent:scoped.recent.map(listeningTrack) };
}

app.get("/api/listening/rooms", apiAuth, (req, res) => {
  const conversationId = String(req.query?.conversationId || "").trim();
  const roleId = String(req.query?.roleId || "").trim();
  let rooms = readListeningRooms(); if (conversationId) rooms = rooms.filter(room => room.conversationId === conversationId); if (roleId) rooms = rooms.filter(room => String(room.roleId || "personal") === roleId);
  res.json({ rooms:rooms.slice(-100).reverse().map(listeningRoomForClient) });
});
app.get("/api/listening/rooms/:id", apiAuth, (req, res) => {
  const { room } = findListeningRoom(req.params.id); if (!room) return res.status(404).json({ error:"一起听房间不存在" });
  res.json({ room:listeningRoomForClient(room) });
});
app.get("/api/listening/library", apiAuth, (req, res) => { const library = readListeningLibrary(); const result = publicListeningLibrary(req.query?.roleId, library); writeListeningLibrary(library); res.json(result); });
app.post("/api/listening/search", apiAuth, async (req, res) => {
  try { res.json({ tracks:await listeningSearch(req.body?.query, req.body?.limit) }); }
  catch (error) { res.status(502).json({ error:error.message || "搜索音乐失败" }); }
});
app.post("/api/listening/tracks/:songId/refresh", apiAuth, async (req, res) => {
  try { res.json({ track:await listeningTrackById(req.params.songId) }); }
  catch (error) { res.status(502).json({ error:error.message || "刷新音源失败" }); }
});
app.post("/api/listening/rooms/:id/queue", apiAuth, async (req, res) => {
  const { rooms, index, room } = findListeningRoom(req.params.id); if (index < 0) return res.status(404).json({ error:"一起听房间不存在" });
  if (room.status === "ended") return res.status(409).json({ error:"一起听已经结束" });
  try {
    const track = await listeningTrackById(req.body?.songId);
    room.queue ||= []; room.queue.push(track);
    if (!room.currentTrack) { room.queueIndex = room.queue.length - 1; room.currentTrack = track; }
    room.updatedAt = chatNow(); rooms[index] = room; writeListeningRooms(rooms.slice(-100));
    res.status(201).json({ room:listeningRoomForClient(room), track });
  } catch (error) { res.status(502).json({ error:error.message || "添加歌曲失败" }); }
});
app.delete("/api/listening/rooms/:id/queue/:index", apiAuth, (req, res) => {
  const { rooms, index, room } = findListeningRoom(req.params.id); if (index < 0) return res.status(404).json({ error:"一起听房间不存在" });
  if (room.status === "ended") return res.status(409).json({ error:"一起听已经结束" });
  const queue = ensureArray(room.queue); const target = Math.floor(Number(req.params.index));
  if (!Number.isInteger(target) || target < 0 || target >= queue.length) return res.status(404).json({ error:"这首歌不在播放列表中" });
  commitListeningClock(room); queue.splice(target, 1); room.queue = queue;
  if (!queue.length) { room.queueIndex = 0; room.currentTrack = null; room.playback = { status:"paused", positionSeconds:0, startedAt:null }; }
  else { room.queueIndex = Math.max(0, Math.min(queue.length - 1, target <= Number(room.queueIndex || 0) ? Number(room.queueIndex || 0) - 1 : Number(room.queueIndex || 0))); room.currentTrack = queue[room.queueIndex]; room.playback = { status:"paused", positionSeconds:0, startedAt:null }; }
  room.updatedAt = chatNow(); rooms[index] = room; writeListeningRooms(rooms.slice(-100)); res.json({ room:listeningRoomForClient(room) });
});
app.post("/api/listening/rooms/:id/refresh", apiAuth, async (req, res) => {
  const { rooms, index, room } = findListeningRoom(req.params.id); if (index < 0) return res.status(404).json({ error:"一起听房间不存在" });
  const songId = Number(req.body?.songId || room.currentTrack?.songId || room.queue?.[room.queueIndex || 0]?.songId);
  try {
    const track = await listeningTrackById(songId); room.queue ||= [];
    const queueIndex = room.queue.findIndex(item => Number(item.songId) === Number(track.songId));
    if (queueIndex >= 0) room.queue[queueIndex] = track;
    room.queueIndex = queueIndex >= 0 ? queueIndex : Math.max(0, Number(room.queueIndex) || 0); room.currentTrack = track;
    room.updatedAt = chatNow(); rooms[index] = room; writeListeningRooms(rooms.slice(-100)); res.json({ room:listeningRoomForClient(room), track });
  } catch (error) { res.status(502).json({ error:error.message || "刷新音源失败" }); }
});
app.put("/api/listening/rooms/:id/playback", apiAuth, (req, res) => {
  const { rooms, index, room } = findListeningRoom(req.params.id); if (index < 0) return res.status(404).json({ error:"一起听房间不存在" });
  if (room.status === "ended") return res.status(409).json({ error:"一起听已经结束" });
  const action = String(req.body?.action || ""); const now = Date.now(); room.playback ||= { status:"paused", positionSeconds:0, startedAt:null };
  if (action === "play") { room.playback.positionSeconds = Math.max(0, Number(req.body?.positionSeconds ?? listeningPosition(room, now)) || 0); room.playback.status = "playing"; room.playback.startedAt = chatNow(); }
  else if (action === "pause") { commitListeningClock(room, now); room.playback.status = "paused"; }
  else if (action === "seek") { room.playback.positionSeconds = Math.max(0, Number(req.body?.positionSeconds) || 0); room.playback.startedAt = room.playback.status === "playing" ? chatNow() : null; }
  else if (action === "mode") room.playMode = ["order", "shuffle", "repeat"].includes(req.body?.playMode) ? req.body.playMode : room.playMode;
  else return res.status(400).json({ error:"未知播放操作" });
  if (action === "play" && room.currentTrack?.songId) { const library = readListeningLibrary(); const scoped = listeningLibraryScope(library, room.roleId); scoped.recent = scoped.recent.filter(item => Number(item.songId) !== Number(room.currentTrack.songId)); scoped.recent.unshift({ ...listeningTrack(room.currentTrack), playedAt:chatNow() }); scoped.recent = scoped.recent.slice(0, 100); writeListeningLibrary(library); }
  room.updatedAt = chatNow(); rooms[index] = room; writeListeningRooms(rooms.slice(-100)); res.json({ room:listeningRoomForClient(room) });
});
app.post("/api/listening/rooms/:id/select", apiAuth, (req, res) => {
  const { rooms, index, room } = findListeningRoom(req.params.id); if (index < 0) return res.status(404).json({ error:"一起听房间不存在" });
  const target = Math.max(0, Math.min(ensureArray(room.queue).length - 1, Math.floor(Number(req.body?.index) || 0)));
  if (!room.queue?.length) return res.status(409).json({ error:"播放列表还是空的" });
  commitListeningClock(room); room.queueIndex = target; room.currentTrack = room.queue[target]; room.playback = { status:"paused", positionSeconds:0, startedAt:null }; room.updatedAt = chatNow();
  rooms[index] = room; writeListeningRooms(rooms.slice(-100)); res.json({ room:listeningRoomForClient(room) });
});
app.post("/api/listening/rooms/:id/favorite", apiAuth, (req, res) => {
  const { room } = findListeningRoom(req.params.id); if (!room) return res.status(404).json({ error:"一起听房间不存在" });
  const track = listeningTrack(room.currentTrack || room.queue?.[room.queueIndex || 0] || {}); if (!track.songId) return res.status(409).json({ error:"先选择一首歌" });
  const library = readListeningLibrary(); const scoped = listeningLibraryScope(library, room.roleId); const existing = scoped.favorites.findIndex(item => Number(item.songId) === track.songId);
  if (existing >= 0) scoped.favorites.splice(existing, 1); else scoped.favorites.unshift({ ...track, savedAt:chatNow() });
  writeListeningLibrary(library); res.json({ favorited:existing < 0, library:publicListeningLibrary(room.roleId, library) });
});
app.post("/api/listening/tracks/:songId/favorite", apiAuth, async (req, res) => {
  try {
    const track = await listeningTrackById(req.params.songId);
    const library = readListeningLibrary(); const roleId = String(req.body?.roleId || "personal"); const scoped = listeningLibraryScope(library, roleId);
    const existing = scoped.favorites.findIndex(item => Number(item.songId) === Number(track.songId));
    if (existing >= 0) scoped.favorites.splice(existing, 1);
    else scoped.favorites.unshift({ ...track, savedAt:chatNow() });
    writeListeningLibrary(library);
    res.json({ favorited:existing < 0, library:publicListeningLibrary(roleId, library) });
  } catch (error) { res.status(502).json({ error:error.message || "收藏歌曲失败" }); }
});
app.delete("/api/listening/library/recent/:songId", apiAuth, (req, res) => {
  const library = readListeningLibrary(); const roleId = String(req.query?.roleId || "personal"); const scoped = listeningLibraryScope(library, roleId);
  scoped.recent = scoped.recent.filter(item => Number(item.songId) !== Number(req.params.songId));
  writeListeningLibrary(library); res.json({ library:publicListeningLibrary(roleId, library) });
});
function listeningRoomSettings(room, conversation, role) {
  const settings = readChatSettings();
  if (conversation?.presetId && conversation?.model) { settings.activePresetId = conversation.presetId; settings.presets = ensureArray(settings.presets).map(item => item.id === conversation.presetId ? { ...item, model:conversation.model } : item); }
  const rolePrompt = role ? [role.identity ? `你的身份：${role.identity}` : "", role.relationship ? `你与 Iris 的关系：${role.relationship}` : "", role.prompt || ""].filter(Boolean).join("\n\n") : "";
  const track = room.currentTrack ? `当前歌曲：${room.currentTrack.songName} — ${room.currentTrack.artistName}` : "当前还没有歌曲";
  settings.persona = { ...(settings.persona || {}), systemPrompt:[rolePrompt || settings.persona?.systemPrompt || DEFAULT_CHAT_SETTINGS.persona.systemPrompt, `你正在和 Iris 的“一起听”房间里。${track}；播放状态：${room.playback?.status === "playing" ? "正在播放" : "暂停"}；已有效一起听 ${Math.floor(listeningElapsed(room) / 60)} 分钟。你能通过一起听工具搜歌、加入列表或控制播放。回复温柔自然，通常 1–3 句；不要解释系统规则。`, companionSourceChatPrompt({ sourceChatContext:room.sourceChatContext || [] })].filter(Boolean).join("\n\n") };
  return settings;
}
app.post("/api/listening/rooms/:id/messages", apiAuth, async (req, res) => {
  const { rooms, index, room } = findListeningRoom(req.params.id); if (index < 0) return res.status(404).json({ error:"一起听房间不存在" });
  if (room.status === "ended") return res.status(409).json({ error:"这次一起听已经结束" });
  const content = String(req.body?.content || "").trim().slice(0, 1000); if (!content) return res.status(400).json({ error:"请输入想说的话" });
  const message = { id:generateId(), role:"iris", content, createdAt:chatNow() }; room.messages ||= []; room.messages.push(message);
  const conversations = readChatConversations(); const conversation = conversations.find(item => item.id === room.conversationId); const role = readChatRoles().find(item => item.id === room.roleId || item.id === conversation?.roleId);
  try {
    const settings = listeningRoomSettings(room, conversation, role);
    const result = await callOpenAICompatible({ preset:getActiveChatPreset(settings), settings, content, history:ensureArray(room.messages).slice(-24), manageListening:createAiListeningHandler([], conversation, conversations, role, room.id) });
    const replyGroupId = generateId(); const parts = splitAiParts(String(result.text || "我在，和你一起听。")); const replies = parts.map((part, itemIndex) => ({ id:generateId(), replyGroupId, role:"claude", content:part, createdAt:new Date(Date.now() + itemIndex).toISOString() })); room.messages.push(...replies); room.updatedAt = chatNow(); rooms[index] = room; writeListeningRooms(rooms.slice(-100)); res.status(201).json({ message, replies, room:listeningRoomForClient(room) });
  } catch (error) { room.updatedAt = chatNow(); rooms[index] = room; writeListeningRooms(rooms.slice(-100)); res.status(502).json({ error:error.message || "TA 回复失败" }); }
});
app.post("/api/listening/rooms/:id/complete", apiAuth, (req, res) => {
  const { rooms, index, room } = findListeningRoom(req.params.id); if (index < 0) return res.status(404).json({ error:"一起听房间不存在" });
  if (!room.endedAt) { commitListeningClock(room); room.status = "ended"; room.endedAt = chatNow(); room.updatedAt = room.endedAt; }
  let completion = null; if (!room.completionMessageId && room.conversationId) { completion = listeningCompletionMessage(room); const messages = readChatMessages(); messages.push(completion); writeChatMessages(messages); room.completionMessageId = completion.id; const conversations = readChatConversations(); const conversation = conversations.find(item => item.id === room.conversationId); if (conversation) { conversation.updatedAt = room.endedAt; writeChatConversations(conversations); } }
  rooms[index] = room; writeListeningRooms(rooms.slice(-100)); markListeningInvitationsEnded(room.id); res.json({ room:listeningRoomForClient(room), completion:completion ? publicMessage(completion) : null });
});
app.post("/api/chat/listening-invitations", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim(); const conversations = readChatConversations(); const conversation = conversations.find(item => item.id === conversationId); if (!conversation) return res.status(404).json({ error:"聊天房间不存在" });
  const now = chatNow(); const invitation = { id:generateId(), from:"iris", status:"pending", roomId:null, roomStatus:null, createdAt:now };
  const message = { id:generateId(), replyGroupId:generateId(), conversationId, role:"iris", systemType:"listening_invitation", listeningInvitation:invitation, content:String(req.body?.message || "想邀请你一起听歌").replace(/\s+/g, " ").trim().slice(0, 240), favorite:false, createdAt:now, updatedAt:now };
  const messages = readChatMessages(); messages.push(message); writeChatMessages(messages); conversation.updatedAt = now; writeChatConversations(conversations); res.status(201).json(publicMessage(message));
});
app.post("/api/chat/listening-invitations/:messageId/respond", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim(); const decision = String(req.body?.decision || ""); const conversations = readChatConversations(); const conversation = conversations.find(item => item.id === conversationId); const messages = readChatMessages(); const message = messages.find(item => item.id === req.params.messageId && item.conversationId === conversationId); const invitation = message?.listeningInvitation;
  if (!conversation || !invitation || invitation.status !== "pending") return res.status(409).json({ error:"这张一起听邀请已经不能再处理" });
  if (!["accept", "decline"].includes(decision)) return res.status(400).json({ error:"请选择同意或拒绝" });
  const now = chatNow(); invitation.status = decision === "accept" ? "accepted" : "declined"; invitation.respondedAt = now; invitation.updatedAt = now; message.updatedAt = now;
  let room = null; if (invitation.status === "accepted") { const ensured = ensureListeningRoomForInvitation(invitation, conversation); room = ensured.room; writeListeningRooms(ensured.rooms.slice(-100)); }
  const response = { id:generateId(), replyGroupId:generateId(), conversationId, role:"system", systemType:"listening_invitation_response", content:decision === "accept" ? "Iris 已同意一起听歌邀请" : "Iris 拒绝了一起听歌邀请", listeningInvitationResponse:{ sourceMessageId:message.id, invitationId:invitation.id, decision, actor:"iris" }, favorite:false, createdAt:now, updatedAt:now };
  messages.push(response); writeChatMessages(messages); conversation.updatedAt = now; writeChatConversations(conversations); res.json({ invitation:publicMessage(message), systemMessage:publicMessage(response), room:room ? listeningRoomForClient(room) : null });
});
app.post("/api/chat/listening-invitations/:messageId/enter", apiAuth, (req, res) => {
  const conversationId = String(req.body?.conversationId || "").trim(); const conversation = readChatConversations().find(item => item.id === conversationId); const messages = readChatMessages(); const message = messages.find(item => item.id === req.params.messageId && item.conversationId === conversationId); const invitation = message?.listeningInvitation;
  if (!conversation || !invitation || invitation.status !== "accepted") return res.status(409).json({ error:"请先同意这张一起听邀请" });
  try { const ensured = ensureListeningRoomForInvitation(invitation, conversation); writeListeningRooms(ensured.rooms.slice(-100)); message.updatedAt = chatNow(); writeChatMessages(messages); res.json({ room:listeningRoomForClient(ensured.room), created:ensured.created }); }
  catch (error) { res.status(409).json({ error:error.message }); }
});

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
