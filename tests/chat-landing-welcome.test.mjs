import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/chat.html", import.meta.url), "utf8");
const welcomeStart = chat.indexOf("const WELCOME_GREETING_POOLS_V93");
const welcomeEnd = chat.indexOf("function injectLandingWelcomeStylesV93");
assert.notEqual(welcomeStart, -1, "welcome pools should exist");
assert.notEqual(welcomeEnd, -1, "welcome helper boundary should exist");
const welcome = new Function(`${chat.slice(welcomeStart, welcomeEnd)}; return { WELCOME_GREETING_POOLS_V93, WELCOME_WEEKDAY_V93, welcomeTimeKeyV93, getWelcomeGreeting };`)();

function localTime(hour, minute = 0, weekday = 1) {
  const date = new Date(2026, 8, 7 + weekday, hour, minute);
  return date;
}

test("New chat landing uses the local Claude logo instead of the star or subtitle", () => {
  assert.match(html, /<img src="\/icons\/claude-logo\.png" alt="Claude">/);
  assert.doesNotMatch(html.slice(html.indexOf('id="landing"'), html.indexOf('id="messages"')), /现在想和 TA 说点什么|landing-mark[^>]*>\s*<svg/);
  const initIcons = chat.slice(chat.indexOf("function initIcons"), chat.indexOf("function initTopBar"));
  assert.match(initIcons, /landingMark.*claude-logo\.png/);
  assert.doesNotMatch(initIcons, /landingMark.*ICON\.spark/);
  assert.doesNotMatch(chat.slice(welcomeStart, welcomeEnd), /supabase|https?:\/\//i);
});

test("welcome greetings select the correct local-time pool for every time period", () => {
  const cases = [[5, "dawn"], [8, "morning"], [11, "morning"], [11, "noon"], [14, "afternoon"], [18, "evening"], [22, "night"], [1, "night"], [2, "late"], [4, "late"]];
  for (const [hour, expected] of cases) assert.equal(welcome.welcomeTimeKeyV93(localTime(hour, hour === 11 && expected === "noon" ? 30 : 0)), expected);
});

test("welcome pool is broad, supports occasional weekdays, and avoids an immediate repeat", () => {
  const count = Object.values(welcome.WELCOME_GREETING_POOLS_V93).flat().length + Object.values(welcome.WELCOME_WEEKDAY_V93).flat().length;
  assert.ok(count >= 50, `expected at least 50 greetings, got ${count}`);
  const weekday = localTime(10, 0, 1);
  const sequence = [0.1, 0.9, 0.99];
  const weekdayGreeting = welcome.getWelcomeGreeting(weekday, () => sequence.shift() ?? 0.99);
  assert.ok(welcome.WELCOME_WEEKDAY_V93[weekday.getDay()].includes(weekdayGreeting));
  const first = welcome.getWelcomeGreeting(localTime(15), () => 0);
  const second = welcome.getWelcomeGreeting(localTime(15), () => 0);
  assert.notEqual(first, second);
});

test("landing styling is compact, responsive, dark-safe, and leaves start behavior intact", () => {
  assert.match(chat, /#landing\.landing-v93 \.landing-mark img\{[^}]*object-fit:contain[^}]*box-shadow:none/);
  assert.match(chat, /#landing\.landing-v93 h1\{[^}]*max-width:min\(88vw,560px\)[^}]*clamp\(30px,8vw,38px\)/);
  assert.match(chat, /@media\(max-width:350px\)/);
  assert.match(chat, /html\[data-appearance="dark"\] #landing\.landing-v93 h1/);
  assert.match(chat, /const showLandingV93Base=showLanding;showLanding=function\(\)\{showLandingV93Base\(\);prepareLandingWelcomeV93\(true\)\}/);
  assert.doesNotMatch(chat.slice(welcomeStart, chat.indexOf("const showLandingV93Base")), /setInterval|setTimeout/);
  assert.match(chat, /\$\('startChatBtn'\)\.onclick=/);
});
