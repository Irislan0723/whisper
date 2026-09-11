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
const diaryTags = new Function("ensureArray", `${extractFunction("diaryTags")}; return diaryTags;`)(value => Array.isArray(value) ? value : []);
const diaryDayKey = memory => (memory.tags || []).find(tag => String(tag).startsWith("__diary_date:"))?.slice("__diary_date:".length) || "";
const periodStatusForDay = new Function(
  "ensureArray", "daysBetweenCalendar",
  `${extractFunction("periodStatusForDay")}; return periodStatusForDay;`
)(
  value => Array.isArray(value) ? value : [],
  (start, end) => Math.floor((Date.parse(String(end) + "T00:00:00Z") - Date.parse(String(start) + "T00:00:00Z")) / 86400000)
);
const calendarEventOccursOnDate = new Function("ensureArray", `
  const CALENDAR_RECURRENCE_TYPES = new Set(["none", "daily", "weekly", "custom"]);
  const CALENDAR_DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/;
  ${extractFunction("normalizeCalendarRecurrence")}
  ${extractFunction("normalizeRecurrenceEndDate")}
  ${extractFunction("calendarWeekday")}
  ${extractFunction("calendarEventOccursOnDate")}
  return calendarEventOccursOnDate;
`)(value => Array.isArray(value) ? value : []);
const makeTodayCalendarContext = new Function(
  "calendarDateKey", "dbAll", "moodFromDb", "eventFromDb", "supabase", "courseFromDb", "periodStatusForDay", "timetableSettingsFromMeta", "daysBetweenCalendar", "courseOccursInTeachingWeek", "timetableCourseTimeRange", "calendarEventOccursOnDate",
  `return (async () => { async ${extractFunction("buildTodayCalendarContext")}; return buildTodayCalendarContext; })();`
);

async function buildTodayCalendarFixture({ day = "2026-09-07", moods = [], events = [], courses = [], timetable = {} } = {}) {
  const settings = {
    term:"2026-2027-1", semesterStart:"2026-09-07", totalWeeks:16,
    periodTimes:[
      { periodStart:1, periodEnd:2, startTime:"08:20", endTime:"09:50" },
      { periodStart:5, periodEnd:6, startTime:"14:00", endTime:"15:30" }
    ],
    ...timetable
  };
  const dbAll = async table => table === "moods" ? moods : table === "calendar_events" ? events : [];
  const supabase = {
    from(table) {
      return {
        select() {
          if (table === "calendar_settings") return { eq: () => ({ maybeSingle: async () => ({ data:{ cycle_length:28, period_length:5 }, error:null }) }) };
          if (table === "calendar_meta") return { eq: () => ({ maybeSingle: async () => ({ data:{ value:settings }, error:null }) }) };
          if (table === "calendar_courses") return Promise.resolve({ data:courses, error:null });
          return Promise.resolve({ data:[], error:null });
        }
      };
    }
  };
  const build = await makeTodayCalendarContext(
    () => day, dbAll, value => value, value => value, supabase, value => value,
    periodStatusForDay, value => value, (start, end) => Math.floor((Date.parse(String(end) + "T00:00:00Z") - Date.parse(String(start) + "T00:00:00Z")) / 86400000),
    (course, week) => week >= course.weekStart && week <= course.weekEnd && (course.weekType !== "odd" || week % 2 === 1) && (course.weekType !== "even" || week % 2 === 0) && (course.weekType !== "list" || course.weeks.includes(week)),
    (course, periodTimes) => {
      const first = periodTimes.find(item => course.periodStart >= item.periodStart && course.periodStart <= item.periodEnd);
      const last = periodTimes.find(item => course.periodEnd >= item.periodStart && course.periodEnd <= item.periodEnd);
      return first && last ? `${first.startTime}–${last.endTime}` : "";
    },
    calendarEventOccursOnDate
  );
  return build();
}

function memoryWriterAt(iso, rows = []) {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [iso])); }
  }
  const writeChatMemorySource = source.slice(source.indexOf("async function writeChatMemory"), source.indexOf("async function executeChatTool"));
  const writeChatMemory = new Function(
    "ensureArray", "dbAll", "memoryFromDb", "resolveDiaryTargetDay", "diaryDayKey", "diaryTags", "generateId", "diaryCreatedAt", "dbUpsert", "memoryToDbRow", "refreshJsonBackup", "memoriesDescribeSameEvent", "Date",
    `${writeChatMemorySource}; return writeChatMemory;`
  )(
    value => Array.isArray(value) ? value : [],
    async () => rows.map(item => ({ ...item })),
    item => ({ ...item }),
    resolveDiaryTargetDay,
    diaryDayKey,
    diaryTags,
    () => `memory-${rows.length + 1}`,
    day => new Date(`${day}T12:00:00+08:00`).toISOString(),
    async (_table, item) => {
      const index = rows.findIndex(row => row.id === item.id);
      if (index >= 0) rows[index] = { ...item };
      else rows.push({ ...item });
      return { ...item };
    },
    item => item,
    async () => {},
    () => false,
    FixedDate
  );
  return { rows, writeChatMemory };
}

test("memory tool CC payloads preserve Chinese punctuation, quotes, newlines, and emoji", () => {
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
    const xml = `<tool_call name="add_daily_memory">${JSON.stringify({ content })}</tool_call>`;
    const [call] = parseCcToolCalls(xml);
    assert.equal(call.parseError, "");
    assert.equal(call.args.content, content);
  }
});

test("malformed tool JSON reports its parser error instead of becoming empty memory content", () => {
  const [call] = parseCcToolCalls('<tool_call name="add_daily_memory">{"content":"lost}</tool_call>');
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

test("daily context labels a recorded period differently from a forecast", () => {
  const settings = { cycle_length: 28, period_length: 5 };
  const actual = periodStatusForDay([{ type:"period", phase:"start", date:"2026-09-10" }], settings, "2026-09-11");
  assert.deepEqual(actual, { kind:"actual", day:2, startDate:"2026-09-10", endDate:"2026-09-14" });

  const history = [
    { type:"period", phase:"start", date:"2026-08-01" },
    { type:"period", phase:"end", date:"2026-08-05" }
  ];
  assert.deepEqual(periodStatusForDay(history, settings, "2026-08-29"), { kind:"predicted", day:1, referenceDate:"2026-08-01" });

  const override = periodStatusForDay([...history, { type:"period", phase:"start", date:"2026-08-29" }], settings, "2026-08-29");
  assert.equal(override.kind, "actual");
  assert.equal(override.day, 1);
  assert.deepEqual(history, [
    { type:"period", phase:"start", date:"2026-08-01" },
    { type:"period", phase:"end", date:"2026-08-05" }
  ]);
});

test("daily context combines only today's active courses and ordinary events", async () => {
  const course = { term:"2026-2027-1", courseName:"数据新闻", weekday:1, periodStart:5, periodEnd:6, weekStart:1, weekEnd:16, weekType:"all", weeks:[], location:"文浚楼326" };
  const event = { date:"2026-09-05", name:"取快递", timeStart:"18:30", timeEnd:"", location:"", recurrence:{ type:"daily" } };

  const eventOnly = await buildTodayCalendarFixture({ events:[event] });
  assert.match(eventOnly.text, /日程：\n- 18:30 取快递/);
  assert.doesNotMatch(eventOnly.text, /课程：/);

  const courseOnly = await buildTodayCalendarFixture({ courses:[course] });
  assert.match(courseOnly.text, /课程：\n- 14:00–15:30 数据新闻 · 文浚楼326/);
  assert.doesNotMatch(courseOnly.text, /日程：/);

  const both = await buildTodayCalendarFixture({ courses:[course], events:[event] });
  assert.match(both.text, /课程：/);
  assert.match(both.text, /日程：/);

  const odd = await buildTodayCalendarFixture({ courses:[{ ...course, weekType:"odd" }, { ...course, courseName:"双周课", weekType:"even" }] });
  assert.match(odd.text, /数据新闻/);
  assert.doesNotMatch(odd.text, /双周课/);

  const changedTime = await buildTodayCalendarFixture({ courses:[course], timetable:{ periodTimes:[{ periodStart:5, periodEnd:6, startTime:"14:10", endTime:"15:40" }] } });
  assert.match(changedTime.text, /14:10–15:40 数据新闻/);
});

test("diaries are unique by diary target date without a late-night execution window", () => {
  const writeMemoryFunction = extractFunction("writeChatMemory");
  assert.doesNotMatch(writeMemoryFunction, /isDiaryClosingWindow|isCrossDayGracePeriod|isExplicitDiaryRequest|日记仅在 Iris 明确要求写日记时写入/);
  assert.match(writeMemoryFunction, /resolveDiaryTargetDay\(args\.date, new Date\(\)\)/);
  assert.match(writeMemoryFunction, /diaryDayKey\(memory\) === targetDiaryDay/);
  assert.match(writeMemoryFunction, /action:"updated"/);
  assert.match(writeMemoryFunction, /action:"created"/);
  assert.match(writeMemoryFunction, /diaryTags\(/);
  assert.match(source, /if \(targetDiaryDay > today\) throw new Error\("不能提前写未来日期的日记。"\)/);
});

test("memory writers are split by purpose and retain a safe legacy add_memory bridge", () => {
  for (const toolName of ["add_deep_memory", "add_daily_memory", "write_diary"]) assert.match(source, new RegExp(`name: "${toolName}"`));
  assert.match(source, /case "add_deep_memory": return await writeChatMemory\(args, "deep"\)/);
  assert.match(source, /case "add_daily_memory": return await writeChatMemory\(args, "daily"\)/);
  assert.match(source, /case "write_diary": return await writeChatMemory\(args, "diary"\)/);
  const legacyCase = source.slice(source.indexOf('case "add_memory":'), source.indexOf('case "update_memory":'));
  assert.match(legacyCase, /日记请使用 write_diary/);
  assert.doesNotMatch(legacyCase, /isExplicitDiaryRequest|日记仅在 Iris 明确要求写日记时写入/);
  assert.match(source, /CHAT_MEMORY_WRITE_TOOL_NAMES/);
  assert.match(source, /migratedAllowed/);
});

test("split writers preserve deep/daily behavior and diary upserts by target date", async () => {
  const evening = memoryWriterAt("2026-09-07T14:00:00.000Z"); // Shanghai 22:00
  const deep = await evening.writeChatMemory({ content:"长期偏好" }, "deep");
  const daily = await evening.writeChatMemory({ content:"今天的重要变化" }, "daily");
  assert.equal(deep.category, "deep");
  assert.equal(deep.pinned, true);
  assert.equal(daily.category, "daily");

  const firstToday = await evening.writeChatMemory({ content:"22 点写今天日记" }, "diary");
  assert.equal(firstToday.action, "created");
  assert.equal(firstToday.diaryDate, "2026-09-07");
  const updatedToday = await evening.writeChatMemory({ content:"同日更新原日记", tags:["important"] }, "diary");
  assert.equal(updatedToday.action, "updated");
  assert.equal(evening.rows.filter(row => row.category === "diary" && diaryDayKey(row) === "2026-09-07").length, 1);
  assert.equal(updatedToday.content, "同日更新原日记");
  assert.ok(updatedToday.tags.includes("__diary_date:2026-09-07"));

  const afternoon = memoryWriterAt("2026-09-07T09:00:00.000Z"); // Shanghai 17:00
  const explicitAt17 = await afternoon.writeChatMemory({ content:"17 点明确要求写今天日记" }, "diary");
  assert.equal(explicitAt17.action, "created");
  assert.equal(explicitAt17.diaryDate, "2026-09-07");

  const crossDayRows = [];
  const earlyMorning = memoryWriterAt("2026-09-06T17:00:00.000Z", crossDayRows); // Shanghai 01:00 on Sep 7
  const defaultYesterday = await earlyMorning.writeChatMemory({ content:"凌晨默认归昨天" }, "diary");
  assert.equal(defaultYesterday.diaryDate, "2026-09-06");
  const explicitYesterday = await earlyMorning.writeChatMemory({ content:"凌晨明确补昨天" , date:"2026-09-06" }, "diary");
  assert.equal(explicitYesterday.action, "updated");
  const laterThatDay = memoryWriterAt("2026-09-07T14:00:00.000Z", crossDayRows); // Shanghai 22:00
  const todayAfterYesterday = await laterThatDay.writeChatMemory({ content:"当天另一份日记" }, "diary");
  assert.equal(todayAfterYesterday.diaryDate, "2026-09-07");
  assert.deepEqual(crossDayRows.filter(row => row.category === "diary").map(diaryDayKey).sort(), ["2026-09-06", "2026-09-07"]);
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

test("Agent receives the daily calendar state in dynamic context, not its static prompt", () => {
  const agentStatic = source.slice(source.indexOf("const ccStaticSystemPrompt"), source.indexOf("// ── API 模式完整 system prompt"));
  const agentDynamic = source.slice(source.indexOf("const ccDynamic = ["), source.indexOf("// ── 首次调用"));
  assert.doesNotMatch(agentStatic, /dailyCalendarText \?/);
  assert.match(agentDynamic, /dailyCalendarText \?/);
  assert.match(agentDynamic, /预测经期.*不得把它说成已经实际开始/);
  assert.match(source, /课程：\\n/);
  assert.match(source, /日程：\\n/);
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
