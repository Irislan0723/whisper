import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
const renderStatus = chat.slice(chat.indexOf("function renderFunctionModelStatusV94"), chat.indexOf("async function refreshFunctionModelStatusV94"));
const renderModels = chat.slice(chat.indexOf("function presetSummaryV97"), chat.indexOf("function updateProviderHints"));
const styles = chat.slice(chat.indexOf("function injectModelSettingsPolishV97"), chat.indexOf("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectModelSettingsPolishV97)"));

test("1. main-model status row is left aligned", () => assert.match(styles, /function-model-status-list-v97\{[^}]*text-align:left!important/));
test("2. summary-model status row is left aligned", () => assert.match(styles, /model-status-row-v96\{[^}]*justify-content:flex-start!important[^}]*text-align:left!important/));
test("3. translation-model status row is left aligned", () => assert.match(renderStatus, /\['main','summary','translation','image'\]\.map/));
test("4. image-model status row is left aligned", () => assert.match(styles, /model-status-content-v96\{[^}]*text-align:left!important/));
test("5. all four status labels share one left-edge content container", () => assert.match(renderStatus, /model-status-content-v96"><strong>'\+esc\(FUNCTION_MODEL_LABELS_V94\[role\]\)/));
test("6. changing status color does not change dot geometry", () => {
  const colorRules = chat.slice(chat.indexOf(".model-status--normal-v96"), chat.indexOf(".function-model-status-v94 strong"));
  assert.match(colorRules, /model-status--normal-v96 \.model-status-dot-v96\{background:#4eaf76\}/);
  assert.match(colorRules, /model-status--error-v96 \.model-status-dot-v96\{background:#d65c5c\}/);
  assert.doesNotMatch(colorRules, /width|height|margin|padding|flex|transform|position/);
});
test("7. presets use a short representative-model summary", () => {
  assert.match(renderModels, /function presetSummaryV97\(p\)/);
  assert.match(renderModels, /first\+' · \+'\+\(models\.length-1\)/);
});
test("8. even twenty models cannot widen a preset card", () => {
  assert.doesNotMatch(renderModels, /\.join\('、'\)/);
  assert.match(styles, /preset-summary-v97\{[^}]*overflow:hidden[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/);
});
test("9. edit and delete actions stay fixed beside the text", () => assert.match(styles, /model-preset-actions-v96\{flex-shrink:0!important/));
test("10. edit switches directly to the create tab", () => assert.match(renderModels, /activateModelSettingsTabV95\('create'\)/));
test("11. edit loads the complete saved preset fields", () => {
  for (const id of ["editingPresetId", "presetName", "apiProvider", "baseUrl", "apiKey"]) assert.match(renderModels, new RegExp("\\$\\('" + id + "'\\)"));
  assert.match(renderModels, /renderFetchedModels\(p\.models\|\|\[p\.model\]\.filter\(Boolean\)/);
});
test("12. saving an edit updates the original preset without a duplicate", () => {
  assert.match(chat, /editing=!!\$\('editingPresetId'\)\.value/);
  assert.match(chat, /idx=settings\.presets\.findIndex\(x=>x\.id===id\);if\(idx>=0\)settings\.presets\[idx\]=item;else settings\.presets\.push\(item\)/);
  assert.match(chat, /if\(editing\)activateModelSettingsTabV95\('presets'\)/);
});
test("13. clicking the create tab clears edit mode and the form", () => {
  assert.match(chat, /if\(tab==='create'\)clearPreset\(\);activateModelSettingsTabV95\(tab\)/);
  assert.match(renderModels, /function clearPreset\(\)\{\$\('editingPresetId'\)\.value=''/);
});
test("14. preset-list internal scrolling remains enabled", () => assert.match(chat, /saved-presets-list-v96\{[^}]*max-height:[^}]*overflow-y:auto[^}]*overscroll-behavior:contain/));
test("15. the light theme keeps variable-based status and preset surfaces", () => assert.match(styles, /color:var\(--chat-text\)|color:var\(--chat-muted\)/));
test("16. dark mode uses the required html appearance selector", () => {
  assert.match(styles, /html\[data-appearance="dark"\] \.function-model-status-list-v97/);
  assert.match(styles, /html\[data-appearance="dark"\] \.preset-summary-v97/);
});
