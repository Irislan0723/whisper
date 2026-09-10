import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist in server.js`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const parseToolArguments = new Function(`${extractFunction("parseToolArguments")}; return parseToolArguments;`)();
const parseCcToolCalls = new Function("parseToolArguments", `${extractFunction("parseCcToolCalls")}; return parseCcToolCalls;`)(parseToolArguments);
const resolveDiaryTargetDay = new Function(`
  const CHAT_TIME_ZONE = "Asia/Shanghai";
  const CROSS_DAY_CONTEXT_CUTOFF_HOUR = 5;
  ${extractFunction("chatDayKey")}
  ${extractFunction("shanghaiHour")}
  ${extractFunction("isCrossDayGracePeriod")}
  ${extractFunction("defaultDiaryDay")}
  ${extractFunction("previousChatDay")}
  ${extractFunction("isChatDayKey")}
  ${extractFunction("resolveDiaryTargetDay")}
  return resolveDiaryTargetDay;
`)();

test("add_memory CC payloads preserve Chinese punctuation, quotes, newlines, and emoji", () => {
  const contents = [
    "普通中文内容",
    "她说“今天好困”",
    "我们的「Whisper」",
    "She said \"hello\"",
    "Iris said 'hello'",
    "第一行\n第二行",
    "今天很开心 🥹✨",
    "她说“好困”，但还是陪我聊了一会儿；「Whisper」很好。"
  ];
  for (const content of contents) {
    const xml = `<tool_call name="add_memory">${JSON.stringify({ content, category: "daily" })}</tool_call>`;
    const [call] = parseCcToolCalls(xml);
    assert.equal(call.parseError, "");
    assert.equal(call.args.content, content);
  }
});

test("malformed tool JSON reports its parser error instead of becoming empty memory content", () => {
  const [call] = parseCcToolCalls('<tool_call name="add_memory">{"content":"lost}</tool_call>');
  assert.match(call.parseError, /JSON 解析失败/);
  assert.deepEqual(call.args, {});
  assert.match(source, /if \(!candidate\.content\) throw new Error\("记忆内容不能为空"\)/);
});

test("diary target date supports evening today and early-morning yesterday", () => {
  assert.deepEqual(resolveDiaryTargetDay("", new Date("2026-09-07T14:00:00Z")), { today: "2026-09-07", targetDiaryDay: "2026-09-07" });
  assert.deepEqual(resolveDiaryTargetDay("", new Date("2026-09-06T17:00:00Z")), { today: "2026-09-07", targetDiaryDay: "2026-09-06" });
  assert.deepEqual(resolveDiaryTargetDay("2026-09-07", new Date("2026-09-07T14:00:00Z")), { today: "2026-09-07", targetDiaryDay: "2026-09-07" });
  assert.throws(() => resolveDiaryTargetDay("2026-09-08", new Date("2026-09-07T14:00:00Z")), /未来日期/);
});

test("diaries are unique by diary target date without a late-night execution window", () => {
  const addMemoryCase = source.slice(source.indexOf('case "add_memory":'), source.indexOf('case "update_memory":'));
  assert.doesNotMatch(addMemoryCase, /isDiaryClosingWindow|isCrossDayGracePeriod/);
  assert.match(addMemoryCase, /resolveDiaryTargetDay\(args\.date, nowDate\)/);
  assert.match(addMemoryCase, /diaryDayKey\(memory\) === targetDiaryDay/);
  assert.match(source, /if \(targetDiaryDay > today\) throw new Error\("不能提前写未来日期的日记。"\)/);
});

test("calendar writes wait for their persistent APIs and surface failures", () => {
  const calendar = readFileSync(new URL("../public/calendar.html", import.meta.url), "utf8");
  const eventForm = calendar.slice(calendar.indexOf("async function saveEventForm"), calendar.indexOf("function deleteEvent"));
  const periodForm = calendar.slice(calendar.indexOf("async function savePeriodDetailForm"), calendar.indexOf("/* Chip click handlers"));
  assert.match(eventForm, /await fetch\(BASE\+'\/api\/calendar'/);
  assert.match(eventForm, /日程保存失败/);
  assert.match(periodForm, /api\/calendar\/period-details\/.*method:'PUT'/);
  assert.match(calendar, /function syncCalendarState\(\)[\s\S]*\/api\/calendar\/state/);
  assert.match(calendar, /id="pdDelete"/);
  assert.match(calendar, /async function deletePeriodDetail\(\)[\s\S]*\/api\/calendar\/period-details/);
  assert.match(calendar, /async function savePeriodMark\(dstr,phase\)[\s\S]*经期标记保存失败/);
  assert.match(source, /req\.path === "\/calendar\.html"/);
  assert.match(source, /supabase\.from\("calendar_events"\)/);
  assert.match(source, /supabase\.from\("period_details"\)/);
  assert.match(source, /app\.delete\("\/api\/calendar\/period-details\/:date"/);
  assert.match(source, /app\.put\("\/api\/calendar\/period-details\/:date"/);
  assert.ok(source.indexOf('app.put("/api/calendar/state"') < source.indexOf('app.put("/api/calendar/:id"'), "calendar state route must precede the generic :id route");
  assert.match(source, /time:String\(e\.time \?\? e\.timeStart \?\? ""\)\.trim\(\) \|\| null/);
  assert.match(source, /time_end:String\(e\.time_end \?\? e\.timeEnd \?\? ""\)\.trim\(\) \|\| null/);
});

test("appearance controls do not inherit dark variables from their own data attribute", () => {
  const style = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");
  const more = readFileSync(new URL("../public/more.html", import.meta.url), "utf8");
  assert.equal((style.match(/(^|[^\w-])\\[data-appearance="dark"\\]/gm) || []).length, 0);
  assert.equal((more.match(/(^|[^\w-])\\[data-appearance="dark"\\]/gm) || []).length, 0);
  assert.match(more, /html\[data-appearance="dark"\] \.appearance-option/);
});

test("sticker library puts package creation first and exposes long-press package deletion", () => {
  const stickers = readFileSync(new URL("../public/stickers.html", import.meta.url), "utf8");
  assert.match(stickers, /toolbar\.prepend\(add\)/);
  assert.match(stickers, /长按删除此表情包/);
  assert.match(stickers, /\/api\/chat\/sticker-packs\//);
  assert.match(stickers, /\.role-preferences,\.sticker-badges\{display:none\}/);
  assert.match(source, /app\.delete\("\/api\/chat\/sticker-packs\/:id"/);
  const sample = source.slice(source.indexOf("function weightedStickerSample"), source.indexOf("async function buildStickerPrompt"));
  assert.doesNotMatch(sample, /favoriteIds|signatureIds|招牌/);
});

test("global music player is opt-in and chat dark mode owns its page surfaces", () => {
  const init = readFileSync(new URL("../public/init.js", import.meta.url), "utf8");
  const listening = readFileSync(new URL("../public/listening.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../public/chat.html", import.meta.url), "utf8");
  assert.match(init, /listen_global_player_default_off_v2/);
  assert.match(init, /enabled=playerFlag==='1'&&localStorage\.getItem\('listen_global_player_hidden'\)!=='1'/);
  assert.match(listening, /toggle\.checked=localStorage\.getItem\('listen_global_player_enabled'\)==='1'/);
  assert.match(listening, /listen_global_player_enabled',toggle\.checked\?'1':'0'/);
  assert.match(app, /listen_global_player_enabled','0'/);
  assert.equal((chat.match(/(^|[^\w-])\[data-appearance="dark"\]/gm) || []).length, 0);
  assert.match(chat, /html\[data-appearance="dark"\] \.chat-main\{background:#1E1E1E!important;background-image:none!important\}/);
  assert.match(chat, /html\[data-appearance="dark"\] \.composer\{background:#181818!important\}/);
  assert.match(chat, /\.message-group\.user \.avatar\{border:0!important/);
});

test("chat suppresses in-app banners while visible and does not reopen a room automatically", () => {
  const init = readFileSync(new URL("../public/init.js", import.meta.url), "utf8");
  const chatApp = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
  assert.match(init, /function showBanner\(payload\) \{\s*if \(inChatRoom\(\)\) return;/);
  assert.match(init, /document\.getElementById\('viewFrame'\)/);
  assert.match(init, /view\.contentWindow\.location\.pathname/);
  assert.doesNotMatch(chatApp, /LAST_OPEN_ROOM_KEY_V22/);
  assert.doesNotMatch(chatApp, /if\(lastId&&conversations\.some\(item=>item\.id===lastId/);
  assert.match(chatApp, /function restoreLastRouteV33\(\)\{\}/);
  assert.doesNotMatch(chatApp, /location\.replace\('companion\.html\?session='/);
});
