import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/chat.html", import.meta.url), "utf8");
const chat = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../public/calendar.html", import.meta.url), "utf8");
const modelsStart = html.indexOf('id="panel-models"');
const modelsEnd = html.indexOf('id="panel-roles"', modelsStart);
const models = html.slice(modelsStart, modelsEnd);

test("1. create tab contains the existing preset form", () => {
  assert.match(models, /data-model-settings-pane-v95="create"[\s\S]*?id="presetName"[\s\S]*?id="fetchModels"[\s\S]*?id="savePreset"/);
});
test("2. presets tab contains the saved preset list", () => assert.match(models, /data-model-settings-pane-v95="presets"[\s\S]*?id="presetCards"/));
test("3. status tab contains functional model status", () => assert.match(models, /data-model-settings-pane-v95="status"[\s\S]*?id="functionModelStatusCard"/));
test("4. functions tab contains the functional model assignment controls", () => assert.match(models, /data-model-settings-pane-v95="functions"[\s\S]*?id="mainModel"[\s\S]*?id="saveFunctions"/));
test("5. tab switching is local show/hide behavior", () => {
  assert.match(chat, /function activateModelSettingsTabV95\(tab\)/);
  assert.match(chat, /classList\.toggle\('active',pane\.dataset\.modelSettingsPaneV95===active\)/);
  assert.doesNotMatch(chat.slice(chat.indexOf("function activateModelSettingsTabV95"), chat.indexOf("function bindModelSettingsTabsV95")), /\bapi\(/);
});
test("6. saving a preset retains its original handler", () => assert.match(chat, /\$\('savePreset'\)\.onclick=savePreset/));
test("7. editing a preset retains its original handler", () => assert.match(chat, /\.edit-preset'\)\.forEach\(x=>x\.onclick=\(\)=>editPreset/));
test("8. deleting a preset retains its original handler", () => assert.match(chat, /\.delete-preset'\)\.forEach\(x=>x\.onclick=\(\)=>deletePreset/));
test("9. saving functional models retains its original handler", () => assert.match(chat, /\$\('saveFunctions'\)\.onclick=saveFunctions/));
test("10. immediate summary retains the shared handler", () => assert.match(chat, /button\.onclick=runSummaryNowV94/));
test("11. status card keeps its existing status renderer", () => assert.match(chat, /function renderFunctionModelStatusV94\(\)/));
test("12. status dot and label use a compact ten-pixel gap", () => assert.match(chat, /\.status-title-row-v95\{display:flex;align-items:flex-start;gap:10px\}/));
test("13. every model name shares the same title-row structure", () => assert.match(chat, /<div class="status-title-row-v95"><i class="status-dot-v95"[\s\S]*?<strong>'\+esc\(FUNCTION_MODEL_LABELS_V94\[role\]\)/));
test("14. light theme uses existing Whisper variables", () => assert.match(chat, /\.model-settings-tabs-v95\{[^}]*background:var\(--chat-surface\)[^}]*border:1px solid var\(--chat-border\)/));
test("15. dark theme uses the project html appearance selector", () => assert.match(chat, /html\[data-appearance="dark"\] \.model-settings-tabs-v95/));
test("16. four tabs are equal-width and compact at phone width", () => {
  assert.match(chat, /\.model-settings-tab-v95\{flex:1;min-width:0/);
  assert.match(chat, /@media\(max-width:400px\)\{\.model-settings-tab-v95/);
});
test("17. Calendar's existing segmented control remains present", () => {
  assert.match(calendar, /\.cal-tabs\{display:flex;padding:3px/);
  assert.match(calendar, /\.cal-tab\.active\{background:var\(--accent\)/);
  assert.match(calendar, /id="calTabs"/);
});
