import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function readJSON(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

async function insert(table, data) {
  if (!data.length) {
    console.log(`${table}: 0`);
    return;
  }

  const { error } = await supabase
    .from(table)
    .upsert(data, { onConflict: table === "moods" ? "date,type,who" : "id" });

  if (error) throw new Error(`${table}: ${error.message}`);

  console.log(`${table}: ${data.length} 条完成`);
}

async function main() {

  // memories
  const memoriesRaw = readJSON("./memories.json");
  const memories = (memoriesRaw.memories || []).map(m => ({
    id: m.id,
    content: m.content || "",
    category: m.category || "daily",
    tags: m.tags || [],
    valence: m.valence ?? 0,
    arousal: m.arousal ?? 0.3,
    pinned: !!m.pinned,
    source: m.source || "migration",
    created_at: m.createdAt,
    updated_at: m.updatedAt
  }));

  await insert("memories", memories);


  // moods
  const moods = readJSON("./data/moods.json").map(m => ({
    date: m.date,
    type: m.type || "mood",
    who: m.who || "iris",
    mood: m.mood || null,
    phase: m.phase || null,
    note: m.note || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  await insert("moods", moods);


  // wishlist
  const wishlist = readJSON("./data/wishlist.json").map(w => ({
    id: w.id,
    text: w.text || "",
    category: w.category || "together",
    owner: w.owner || "both",
    done: !!w.done,
    created_at: w.createdAt,
    updated_at: w.updatedAt
  }));

  await insert("wishlist", wishlist);


  // letters
  const letters = readJSON("./data/letters.json").map(l => ({
    id: l.id,
    from_person: l.from || "iris",
    to_person: l.to || "claude",
    content: l.content || "",
    mood_tag: l.moodTag || "happy",
    unlock_at: l.unlockAt,
    password_hash: null,
    hide_until_unlock: !!l.hideUntilUnlock,
    allow_reply: l.allowReply !== false,
    is_unlocked: !!l.isUnlocked,
    reply: l.reply || null,
    created_at: l.createdAt,
    updated_at: l.updatedAt
  }));

  await insert("letters", letters);


  // calendar
  const calendar = readJSON("./data/calendar.json").map(c => ({
    id: c.id,
    title: c.title || "",
    date: c.date,
    time: c.time || null,
    note: c.note || "",
    type: c.type || "other",
    created_at: c.createdAt,
    updated_at: c.updatedAt
  }));

  await insert("calendar_events", calendar);


  console.log("迁移完成！");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
