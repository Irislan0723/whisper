import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const chat = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
const affectSource = source.slice(source.indexOf("const MEMORY_AFFECT_LIMITS"), source.indexOf("function memoryToDb"));
const affect = new Function(`${affectSource}; return { normaliseMemoryAffect, normaliseMemoryAffects };`)();
const statusSource = source.slice(source.indexOf("const DEFAULT_STATUS_INJECTION_CONFIG"), source.indexOf("function normaliseRoleToolConfig"));
const status = new Function("ensureArray", `${statusSource}; return { normaliseStatusInjectionConfig, formatAgentDailyStatusContext };`)(value => Array.isArray(value) ? value : []);
const diaryTool = source.slice(source.indexOf('{ name: "write_diary"'), source.indexOf('{ name: "update_memory"'));
const diaryWriter = source.slice(source.indexOf("async function writeChatMemory"), source.indexOf("async function executeChatTool"));
const ccStatic = source.slice(source.indexOf("const ccStaticSystemPrompt"), source.indexOf("// ── API 模式完整 system prompt"));

test("1. valence database range is -1 to 1", () => assert.deepEqual(affect.normaliseMemoryAffects({ valence:-1 }).valence, -1));
test("2. arousal database range is 0 to 1", () => assert.deepEqual(affect.normaliseMemoryAffects({ arousal:0 }).arousal, 0));
test("3. diary schema matches both database ranges", () => {
  assert.match(diaryTool, /valence: \{ type: "number", minimum: -1, maximum: 1/);
  assert.match(diaryTool, /arousal: \{ type: "number", minimum: 0, maximum: 1/);
});
test("4. diary description states valid affect ranges", () => assert.match(diaryTool, /valence 可选.*-1～1；arousal 可选.*0～1/));
test("5. minimum legal affect values are preserved", () => assert.deepEqual(affect.normaliseMemoryAffects({ valence:-1, arousal:0 }), { valence:-1, arousal:0 }));
test("6. maximum legal affect values are preserved", () => assert.deepEqual(affect.normaliseMemoryAffects({ valence:1, arousal:1 }), { valence:1, arousal:1 }));
test("7. low affect values clamp before persistence", () => assert.deepEqual(affect.normaliseMemoryAffects({ valence:-9, arousal:-5 }), { valence:-1, arousal:0 }));
test("8. high affect values clamp before persistence", () => assert.deepEqual(affect.normaliseMemoryAffects({ valence:9, arousal:5 }), { valence:1, arousal:1 }));
test("9. memory database mapper is a final affect safety boundary", () => assert.match(source.slice(source.indexOf("function memoryToDb"), source.indexOf("function loadMoods")), /const affect = normaliseMemoryAffects\(memory\)/));
test("10. diary writes normalise affect before every upsert", () => assert.match(diaryWriter, /normaliseMemoryAffects\(args, existingDiary\)[\s\S]*normaliseMemoryAffects\(args\)/));
test("11. self profile database read remains available", () => assert.match(source, /async function readSelfProfile\(\)/));
test("12. self profile tools remain available", () => {
  assert.match(source, /name: "read_self_profile"/);
  assert.match(source, /name: "update_self_profile"/);
});
test("13. Claude Code static prompt no longer includes self-profile text", () => assert.doesNotMatch(ccStatic, /selfProfileText/));
test("14. role card persona remains in Claude Code static prompt", () => assert.match(ccStatic, /settings\.persona\?\.systemPrompt/));
test("15. no Rei mood gives the concise unrecorded status", () => assert.match(status.formatAgentDailyStatusContext({ config:{}, mood:"心情：今日未记录" }), /心情：今日未记录/));
test("16. a Rei mood gives the concise recorded status", () => assert.match(status.formatAgentDailyStatusContext({ config:{}, mood:"心情：今日已记录" }), /心情：今日已记录/));
test("17. mood status checks only the Claude mood owner", () => assert.match(source, /item\.type === "mood" && item\.who === "claude" && item\.date === today/));
test("18. disabled mood injection omits its line", () => assert.equal(status.formatAgentDailyStatusContext({ config:{ mood:false }, mood:"心情：今日已记录" }), ""));
test("19. enabled mood injection restores its line", () => assert.match(status.formatAgentDailyStatusContext({ config:{ mood:true }, mood:"心情：今日已记录" }), /心情：今日已记录/));
test("20. mood setting is role-scoped, persisted, and default-on", () => {
  assert.match(source, /DEFAULT_STATUS_INJECTION_CONFIG[^\n]*mood:true/);
  assert.match(chat, /DEFAULT_STATUS_INJECTION_V92[^\n]*mood:true/);
  assert.match(chat, /data-status="mood"/);
  assert.match(chat, /statusInjectionConfig:config/);
});
