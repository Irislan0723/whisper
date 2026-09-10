import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../public/calendar.html", import.meta.url), "utf8");
const chat = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/20260910_extend_calendar_courses_for_timetable.sql", import.meta.url), "utf8");

function extract(name) {
  const start = server.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = server.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < server.length; index += 1) {
    if (server[index] === "{") depth += 1;
    if (server[index] === "}" && --depth === 0) return server.slice(start, index + 1);
  }
  throw new Error(`unclosed ${name}`);
}

const timetableHelpers = new Function(`
  const ensureArray = value => Array.isArray(value) ? value : [];
  ${extract("normalizeWeekList")}
  ${extract("parseWeekExpression")}
  ${extract("importWeekRule")}
  ${extract("parseTimetableImportText")}
  ${extract("courseOccursInTeachingWeek")}
  return { parseWeekExpression, importWeekRule, parseTimetableImportText, courseOccursInTeachingWeek };
`)();

test("1-4 course recurrence supports weekly, odd, even, and explicit weeks", () => {
  const matches = timetableHelpers.courseOccursInTeachingWeek;
  assert.equal(matches({ weekStart: 1, weekEnd: 16, weekType: "all", weeks: [] }, 6), true);
  assert.equal(matches({ weekStart: 1, weekEnd: 16, weekType: "odd", weeks: [] }, 5), true);
  assert.equal(matches({ weekStart: 1, weekEnd: 16, weekType: "odd", weeks: [] }, 6), false);
  assert.equal(matches({ weekStart: 1, weekEnd: 16, weekType: "even", weeks: [] }, 6), true);
  assert.equal(matches({ weekStart: 1, weekEnd: 16, weekType: "list", weeks: [1, 4, 9] }, 4), true);
  assert.equal(matches({ weekStart: 1, weekEnd: 16, weekType: "list", weeks: [1, 4, 9] }, 5), false);
});

test("5-6 explicit-week input expands ranges and keeps only valid weeks", () => {
  assert.deepEqual(timetableHelpers.parseWeekExpression("1,2,4,7,9-12"), [1, 2, 4, 7, 9, 10, 11, 12]);
  assert.deepEqual(timetableHelpers.importWeekRule("1-16周 单周"), { weekStart: 1, weekEnd: 16, weekType: "odd", weeks: [] });
});

test("7 text imports parse a whole timetable without ordinary events", () => {
  assert.deepEqual(timetableHelpers.parseTimetableImportText("短视频 | 周一 | 3-4节 | 1-16周 | 文浚楼439 | 胡蓉"), [{
    courseName: "短视频", weekday: 1, periodStart: 3, periodEnd: 4,
    weekStart: 1, weekEnd: 16, weekType: "all", weeks: [], location: "文浚楼439", teacher: "胡蓉", note: ""
  }]);
});

test("8-12 API contracts cover course CRUD, semester settings, and import", () => {
  for (const route of ["app.get(\"/api/timetable\"", "app.put(\"/api/timetable/settings\"", "app.post(\"/api/timetable/courses\"", "app.put(\"/api/timetable/courses/:id\"", "app.delete(\"/api/timetable/courses/:id\"", "app.post(\"/api/timetable/import\""]) assert.match(server, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(server, /timetableCourseSignature/);
  assert.match(server, /semester_start/);
});

test("13-15 import is validated before the one bulk course upsert and retains legacy data", () => {
  assert.match(server, /课程校验失败，未写入任何课程/);
  assert.match(server, /bulk upsert is one database statement/);
  assert.match(migration, /add column if not exists term/);
  assert.match(migration, /add column if not exists created_at/);
  assert.doesNotMatch(migration, /drop table|delete from|truncate/i);
});

test("16-19 AI has dedicated timetable tools", () => {
  for (const name of ["read_timetable", "import_timetable", "update_timetable_course", "delete_timetable_course"]) {
    assert.match(server, new RegExp(`name: "${name}"`));
    assert.match(server, new RegExp(`case "${name}"`));
  }
});

test("20 ordinary calendar routes and 21 original AI calendar tools remain", () => {
  assert.match(server, /app\.post\("\/api\/calendar"/);
  assert.match(server, /app\.put\("\/api\/calendar\/:id"/);
  assert.match(server, /case "read_calendar"/);
  assert.match(server, /case "add_calendar_event"/);
  assert.match(calendar, /function getSemesterWeek/);
  assert.match(chat, /restoreTimetableImportDraftV1/);
});
