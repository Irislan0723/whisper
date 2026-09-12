import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
const statusRenderer = chat.slice(chat.indexOf("function renderFunctionModelStatusV94"), chat.indexOf("async function refreshFunctionModelStatusV94"));
const styles = chat.slice(chat.indexOf('function injectFunctionModelStatusStylesV94'), chat.indexOf('const renderModelSettingsV94Base'));
const modelSettings = chat.slice(chat.indexOf("function renderModelSettings"), chat.indexOf("function editPreset"));

test("1. a gray main-model dot uses the fixed dot structure", () => assert.match(statusRenderer, /model-status--'\+state\+'-v96[\s\S]*?model-status-dot-v96/));
test("2. a green main-model dot cannot move its name", () => {
  const normal = styles.slice(styles.indexOf(".model-status--normal-v96"), styles.indexOf(".model-status--error-v96"));
  assert.match(normal, /background:#4eaf76/);
  assert.doesNotMatch(normal, /width|height|margin|padding|flex|transform|position/);
});
test("3. an error dot cannot move its name", () => {
  const error = styles.slice(styles.indexOf(".model-status--error-v96"), styles.indexOf(".function-model-status-v94 strong"));
  assert.match(error, /background:#d65c5c/);
  assert.doesNotMatch(error, /width|height|margin|padding|flex|transform|position/);
});
test("4. all four model names use one fixed row renderer", () => {
  assert.match(statusRenderer, /\['main','summary','translation','image'\]\.map/);
  assert.match(statusRenderer, /model-status-content-v96"><strong>'\+esc\(FUNCTION_MODEL_LABELS_V94\[role\]\)/);
});
test("5. a short preset list has natural height", () => assert.match(styles, /saved-presets-list-v96\{[^}]*max-height:[^}]*overflow-y:auto/));
test("6. seven presets fit the designed list capacity", () => assert.match(styles, /--preset-card-height-v96:78px[\s\S]*?max-height:calc\(var\(--preset-card-height-v96\) \* 7 \+ 54px\)/));
test("7. more than seven presets scroll inside the list", () => assert.match(styles, /saved-presets-list-v96\{[^}]*overflow-y:auto[^}]*overscroll-behavior:contain/));
test("8. preset growth is bounded inside its card", () => assert.match(styles, /saved-presets-list-v96\{[^}]*max-height:/));
test("9. internal scrolling contains mobile overscroll", () => assert.match(styles, /overscroll-behavior:contain/));
test("10. edit SVG keeps the edit handler class", () => {
  assert.match(modelSettings, /class="preset-icon-btn-v96 edit-preset"/);
  assert.match(chat, /\.edit-preset'\)\.forEach\(x=>x\.onclick=\(\)=>editPreset/);
});
test("11. delete SVG keeps the delete handler class", () => {
  assert.match(modelSettings, /class="preset-icon-btn-v96 danger delete-preset"/);
  assert.match(chat, /\.delete-preset'\)\.forEach\(x=>x\.onclick=\(\)=>deletePreset/);
});
test("12. SVG icons use currentColor in light mode", () => assert.match(styles, /\.preset-icon-btn-v96 svg\{[^}]*stroke:currentColor/));
test("13. SVG controls have dark-mode styling", () => assert.match(styles, /html\[data-appearance="dark"\] \.preset-icon-btn-v96/));
test("14. icon-only buttons retain accessible labels", () => {
  assert.match(modelSettings, /aria-label="编辑预设"/);
  assert.match(modelSettings, /aria-label="删除预设"/);
});
test("15. preset text remains readable beside fixed touch targets", () => {
  assert.match(styles, /\.model-preset-info-v96\{flex:1 1 auto;min-width:0/);
  assert.match(styles, /text-overflow:ellipsis/);
  assert.match(styles, /\.preset-icon-btn-v96\{[^}]*flex:0 0 40px[^}]*width:40px;height:40px/);
});
