import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
const polish = chat.slice(chat.indexOf("function injectMcpSavedListPolishV99"), chat.indexOf("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectMcpSavedListPolishV99)"));
const v98 = chat.slice(chat.indexOf("function injectMcpManagementV98Styles"), chat.indexOf("function initMcpManagementV98"));
const actions = chat.slice(chat.indexOf("function bindMcpCardActionsV98"), chat.indexOf("function openMcpFormV98"));

test("1. light MCP cards explicitly use the shared light surface", () => assert.match(polish, /\.mcp-card-v98\{[^}]*background:var\(--chat-surface\)/));
test("2. dark MCP cards are scoped by the html appearance selector", () => assert.match(polish, /html\[data-appearance="dark"\] \.mcp-card-v98\{[^}]*background:#262626/));
test("3. theme selector cannot leave a bare card selector after a comma", () => assert.doesNotMatch(polish, /html\[data-appearance="dark"\][^}]*,\.mcp-card-v98/));
test("4. one MCP remains within the natural saved-list height", () => assert.match(polish, /\.mcp-saved-list-v98\{max-height:568px/));
test("5. four MCP cards fit before scrolling", () => assert.match(polish, /max-height:568px/));
test("6. five 106px cards and four 9px gaps fit exactly", () => assert.equal(5 * 106 + 4 * 9 + 2, 568));
test("7. a sixth card uses existing internal vertical scrolling", () => assert.match(v98, /\.mcp-saved-list-v98\{[^}]*overflow-y:auto/));
test("8. the fifth card has no partial-height cutoff", () => assert.ok(568 >= 5 * 106 + 4 * 9 + 2));
test("9. saved cards still prohibit horizontal scrolling", () => assert.match(v98, /\.mcp-saved-list-v98\{[^}]*overflow-x:hidden/));
test("10. action controls use four equal grid tracks", () => assert.match(polish, /\.mcp-card-actions-v98\{display:grid;grid-template-columns:repeat\(4,minmax\(40px,1fr\)\)/));
test("11. refresh handler remains unchanged", () => assert.match(actions, /data-mcp-refresh-v98[\s\S]*?\/refresh',\{method:'POST'\}/));
test("12. edit handler remains unchanged", () => assert.match(actions, /data-mcp-edit-v98[\s\S]*?openMcpFormV98/));
test("13. delete handler remains unchanged", () => assert.match(actions, /data-mcp-delete-v98[\s\S]*?method:'DELETE'/));
test("14. detail expansion handler remains unchanged", () => assert.match(actions, /data-mcp-toggle-details-v98[\s\S]*?is-expanded/));
test("15. expanded details remain below the operation row", () => assert.match(chat, /mcp-card-bottom-v98[\s\S]*?mcp-details-v98/));
test("16. buttons retain 40px mobile touch height and compact gap", () => {
  assert.match(polish, /\.mcp-icon-button-v98\{[^}]*height:40px;min-height:40px/);
  assert.match(polish, /@media\(max-width:400px\)\{\.mcp-card-actions-v98\{gap:6px/);
});
