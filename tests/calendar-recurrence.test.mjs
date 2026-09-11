import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../public/calendar.html", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/20260912_add_calendar_event_recurrence.sql", import.meta.url), "utf8");

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

const helpers = new Function(`
  const ensureArray = value => Array.isArray(value) ? value : [];
  const CALENDAR_RECURRENCE_TYPES = new Set(["none", "daily", "weekly", "custom"]);
  const CALENDAR_DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/;
  ${extractFunction("normalizeCalendarRecurrence")}
  ${extractFunction("normalizeRecurrenceEndDate")}
  ${extractFunction("calendarWeekday")}
  ${extractFunction("calendarEventOccursOnDate")}
  ${extractFunction("calendarDateRange")}
  ${extractFunction("nextCalendarDate")}
  ${extractFunction("calendarEventOccurrences")}
  ${extractFunction("assertCalendarRecurrence")}
  ${extractFunction("eventFromDb")}
  ${extractFunction("eventToDbRow")}
  return { normalizeCalendarRecurrence, calendarEventOccursOnDate, calendarEventOccurrences, assertCalendarRecurrence, eventFromDb, eventToDbRow };
`)();

const daily = { id:"daily", title:"背单词", date:"2026-09-12", recurrence:{ type:"daily" } };
const weekly = { id:"weekly", title:"组会", date:"2026-09-16", recurrence:{ type:"weekly" } }; // Wednesday
const weekdays = { id:"weekdays", title:"晨读", date:"2026-09-14", recurrence:{ type:"custom", weekdays:[1,2,3,4,5] } };

test("1. legacy event without recurrence is a one-off event", () => {
  assert.equal(helpers.calendarEventOccursOnDate({ id:"old", date:"2026-09-12" }, "2026-09-12"), true);
  assert.equal(helpers.calendarEventOccursOnDate({ id:"old", date:"2026-09-12" }, "2026-09-13"), false);
});

test("2. daily recurrence occurs after its start date", () => {
  assert.equal(helpers.calendarEventOccursOnDate(daily, "2026-09-13"), true);
});

test("3. daily recurrence honors its inclusive end date", () => {
  const event = { ...daily, recurrenceEndDate:"2026-09-14" };
  assert.equal(helpers.calendarEventOccursOnDate(event, "2026-09-14"), true);
  assert.equal(helpers.calendarEventOccursOnDate(event, "2026-09-15"), false);
});

test("4. weekly recurrence only occurs on its start weekday", () => {
  assert.equal(helpers.calendarEventOccursOnDate(weekly, "2026-09-23"), true);
  assert.equal(helpers.calendarEventOccursOnDate(weekly, "2026-09-24"), false);
});

test("5. custom recurrence occurs on selected weekdays", () => {
  assert.equal(helpers.calendarEventOccursOnDate(weekdays, "2026-09-15"), true);
});

test("6. custom weekday recurrence excludes unselected weekends", () => {
  assert.equal(helpers.calendarEventOccursOnDate(weekdays, "2026-09-19"), false);
});

test("7. recurrence never occurs before its start date", () => {
  assert.equal(helpers.calendarEventOccursOnDate(daily, "2026-09-11"), false);
});

test("8. recurrence normalizes weekday values and legacy fields", () => {
  assert.deepEqual(helpers.normalizeCalendarRecurrence({ type:"custom", weekdays:[5,1,1,0,8,"3"] }), { type:"custom", weekdays:[1,3,5] });
  assert.deepEqual(helpers.eventFromDb({ id:"old", title:"旧日程", date:"2026-09-12" }).recurrence, { type:"none" });
});

test("9. custom recurrence requires at least one weekday", () => {
  assert.throws(() => helpers.assertCalendarRecurrence({ type:"custom", weekdays:[] }, null, "2026-09-12"), /at least one weekday/);
});

test("10. recurrence end date must not precede its start date", () => {
  assert.throws(() => helpers.assertCalendarRecurrence({ type:"daily" }, "2026-09-11", "2026-09-12"), /cannot be before/);
});

test("11. persisted recurrence is one row with JSON rule and nullable end", () => {
  const row = helpers.eventToDbRow({ ...weekdays, recurrenceEndDate:null });
  assert.equal(row.id, "weekdays");
  assert.deepEqual(row.recurrence, { type:"custom", weekdays:[1,2,3,4,5] });
  assert.equal(row.recurrence_end_date, null);
  assert.match(migration, /add column if not exists recurrence jsonb/);
  assert.match(migration, /add column if not exists recurrence_end_date date null/);
  assert.doesNotMatch(migration, /drop table|delete from|truncate/i);
});

test("12. range reads expand only matching virtual occurrences", () => {
  const result = helpers.calendarEventOccurrences([daily, weekly, weekdays], "2026-09-19", "2026-09-20", 20);
  assert.deepEqual(result.map(item => [item.id, item.occurrenceDate]), [["daily", "2026-09-19"], ["daily", "2026-09-20"]]);
});

test("13. virtual occurrence keeps its original record id for updates and deletes", () => {
  const [occurrence] = helpers.calendarEventOccurrences([daily], "2026-09-14", "2026-09-14", 10);
  assert.equal(occurrence.id, "daily");
  assert.equal(occurrence.date, "2026-09-12");
  assert.equal(occurrence.occurrenceDate, "2026-09-14");
});

test("14. Agent tool schemas expose recurrence and real occurrences", () => {
  assert.match(source, /name: "add_calendar_event"[\s\S]*recurrenceEndDate/);
  assert.match(source, /name: "update_calendar_event"[\s\S]*recurrenceEndDate/);
  assert.match(source, /case "read_calendar": \{ const events=.*calendarEventOccurrences/);
});

test("15. daily Agent context uses the shared occurrence matcher", () => {
  const context = source.slice(source.indexOf("async function buildTodayCalendarContext"), source.indexOf("const WEATHER_CONTEXT_CACHE_MS"));
  assert.match(context, /events\.filter\(item => calendarEventOccursOnDate\(item, day\)\)/);
});

test("16. Calendar UI provides recurrence choices and weekday multi-select", () => {
  assert.match(calendar, /id="eRecurrence"/);
  assert.match(calendar, /value="daily">每天/);
  assert.match(calendar, /value="weekly">每周/);
  assert.match(calendar, /id="eWeekdays"/);
  assert.match(calendar, /id="eRecurrenceEndDate"/);
});

test("17. Calendar month and date details share the recurrence matcher", () => {
  assert.match(calendar, /function getEventsForDate\(dstr\)\{return eventsData\.filter\(function\(e\)\{return eventOccursOnDate\(e,dstr\)\}\)\}/);
  assert.match(calendar, /var events=getEventsForDate\(dstr\)/);
  assert.match(calendar, /var dayEvents=getEventsForDate\(selDate\)/);
});

test("18. schedule actions use the existing variable-driven segmented appearance", () => {
  assert.match(calendar, /class="schedule-actions"/);
  assert.match(calendar, /\.schedule-actions\{display:flex;padding:3px;background:var\(--bg-card\)/);
  assert.match(calendar, /\.schedule-action\.active\{background:var\(--accent\);color:var\(--accent-contrast\)/);
  assert.equal((calendar.match(/(^|[^\w-])\[data-appearance="dark"\]/gm) || []).length, 0);
});
