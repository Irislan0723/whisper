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
  assert.match(periodForm, /await syncCalendarState\(\)/);
  assert.match(calendar, /function syncCalendarState\(\)[\s\S]*\/api\/calendar\/state/);
  assert.match(calendar, /id="pdDelete"/);
  assert.match(calendar, /async function deletePeriodDetail\(\)[\s\S]*\/api\/calendar\/period-details/);
  assert.match(calendar, /async function savePeriodMark\(dstr,phase\)[\s\S]*经期标记保存失败/);
  assert.match(source, /req\.path === "\/calendar\.html"/);
  assert.match(source, /supabase\.from\("calendar_events"\)/);
  assert.match(source, /supabase\.from\("period_details"\)/);
  assert.match(source, /app\.delete\("\/api\/calendar\/period-details\/:date"/);
});
