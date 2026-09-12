import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../public/chat-app-20260821-1310.js", import.meta.url), "utf8");
const v98 = chat.slice(chat.indexOf("// V98:"));
const styles = v98.slice(v98.indexOf('function injectMcpManagementV98Styles'), v98.indexOf('function ensureMcpPanelV98'));
const render = v98.slice(v98.indexOf('async function renderMcpWorkspaceV98'), v98.indexOf('function openMcpFormV98'));
const form = v98.slice(v98.indexOf('function openMcpFormV98'), v98.indexOf('const activateMcpPanelV98Base'));

test("1. MCP has saved and create segmented tabs", () => assert.match(v98, /data-mcp-tab-v98="saved">已保存[\s\S]*?data-mcp-tab-v98="create">新建/));
test("2. MCP tabs reuse the model-settings visual language", () => {
  assert.match(styles, /\.mcp-tabs-v98\{display:flex;padding:3px[\s\S]*?border-radius:999px[\s\S]*?box-shadow:var\(--shadow-sm\)/);
  assert.match(styles, /\.mcp-tab-v98\.active\{background:var\(--accent\);color:var\(--accent-contrast\)/);
});
test("3. saved tab contains only the saved connector list", () => assert.match(v98, /data-mcp-pane-v98="saved"[\s\S]*?id="mcpConnectorListV60"/));
test("4. create tab contains the connector form", () => assert.match(v98, /data-mcp-pane-v98="create"[\s\S]*?id="mcpNameV60"[\s\S]*?id="saveMcpConnectorV65"/));
test("5. collapsed MCP cards use compact top and action rows", () => {
  assert.match(styles, /\.mcp-card-v98\{[^}]*padding:12px 13px/);
  assert.match(styles, /\.mcp-card-icon-v98\{[^}]*width:34px;height:34px/);
  assert.match(styles, /\.mcp-icon-button-v98\{[^}]*width:40px;height:40px/);
});
test("6. enable toggle retains the actual connector update", () => assert.match(render, /data-mcp-enable-v98[\s\S]*?method:'PUT'[\s\S]*?enabled:input\.checked/));
test("7. refresh uses an inline SVG and existing refresh endpoint", () => {
  assert.match(v98, /const MCP_REFRESH_ICON_V98='<svg/);
  assert.match(render, /data-mcp-refresh-v98[\s\S]*?\/refresh',\{method:'POST'\}/);
});
test("8. edit uses an inline SVG and keeps its action", () => {
  assert.match(v98, /const MCP_EDIT_ICON_V98='<svg/);
  assert.match(render, /data-mcp-edit-v98[\s\S]*?openMcpFormV98/);
});
test("9. delete uses an inline SVG and keeps its action", () => {
  assert.match(v98, /const MCP_TRASH_ICON_V98='<svg/);
  assert.match(render, /data-mcp-delete-v98[\s\S]*?method:'DELETE'/);
});
test("10. chevron expands tool details", () => {
  assert.match(v98, /const MCP_CHEVRON_ICON_V98='<svg/);
  assert.match(render, /data-mcp-toggle-details-v98[\s\S]*?classList\.toggle\('is-expanded'/);
});
test("11. chevron can collapse tool details", () => assert.match(render, /expanded\?'收起工具详情':'展开工具详情'/));
test("12. tool details remain visible inside the current card", () => {
  assert.match(render, /mcp-tool-details-v98/);
  assert.match(v98, /tool\.description\?'<span>'/);
});
test("13. editing switches to the create tab", () => assert.match(form, /activateMcpTabV98\('create'\)/));
test("14. editing loads saved connector fields", () => {
  for (const id of ["mcpConnectorIdV60", "mcpNameV60", "mcpDescriptionV60", "mcpEndpointV60", "mcpTransportV60", "mcpEnabledV60"]) assert.match(form, new RegExp("\\$\\('" + id + "'\\)"));
});
test("15. saving an edit retains PUT instead of duplicate creation", () => assert.match(chat, /api\(id\?'\/api\/chat\/mcp-connectors\/'\+encodeURIComponent\(id\):'\/api\/chat\/mcp-connectors',\{method:id\?'PUT':'POST'/));
test("16. a refresh rerenders the tool count", () => assert.match(render, /\/refresh',\{method:'POST'\}[\s\S]*?await renderMcpWorkspaceV98\(\)/));
test("17. delete confirmation protection remains", () => assert.match(render, /confirm\('删除“'\+connector\.name\+'”吗？'\)/));
test("18. long connector names cannot widen a card", () => assert.match(styles, /\.mcp-name-v98\{[^}]*overflow:hidden[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/));
test("19. cards and list prevent horizontal scrolling", () => {
  assert.match(styles, /\.mcp-saved-list-v98\{[^}]*overflow-x:hidden/);
  assert.match(styles, /\.mcp-card-v98\{[^}]*min-width:0/);
});
test("20. many connectors scroll inside the list", () => assert.match(styles, /\.mcp-saved-list-v98\{[^}]*max-height:[^}]*overflow-y:auto[^}]*overscroll-behavior:contain/));
test("21. light theme uses existing variables", () => assert.match(styles, /background:var\(--chat-surface\)[\s\S]*?border:1px solid var\(--chat-border\)/));
test("22. dark mode uses the required html appearance selector", () => assert.match(styles, /html\[data-appearance="dark"\] \.mcp-tabs-v98/));
