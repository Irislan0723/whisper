import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const app = fs.readFileSync(new URL('public/chat-app-20260821-1310.js', root), 'utf8');
const html = fs.readFileSync(new URL('public/chat.html', root), 'utf8');

test('1. left header button no longer starts as the hamburger action', () => {
  assert.match(app, /function initIcons\(\)\{\$\('openLeft'\)\.innerHTML=ICON\.back/);
});

test('2. left header button uses the existing chevron back SVG', () => {
  assert.match(app, /back:'<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/);
});

test('3. left header button returns through same-origin history or Home', () => {
  assert.match(app, /function navigateChatBackV100\(\).*history\.back\(\).*location\.href='index\.html'/s);
});

test('4. right header button no longer starts as the gear action', () => {
  assert.match(app, /function initIcons\(\).*\$\('openRight'\)\.innerHTML=ICON\.menu/s);
  assert.doesNotMatch(app, /\$\('openRight'\)\.innerHTML=GEAR/);
});

test('5. right header button uses the three-line menu SVG', () => {
  assert.match(app, /menu:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/);
});

test('6. right header button opens the main left Chat drawer', () => {
  assert.match(app, /\$\('openRight'\)\.onclick=\(\)=>openDrawer\('left'\)/);
});

test('7. Chat Settings remains reachable from the main sidebar', () => {
  assert.match(app, /function ensureConversationSettingsEntryV100\(\).*button\.onclick=\(\)=>openDrawer\('right'\)/s);
  assert.match(app, /conversationSettingsEntryV100/);
});

test('8. light-mode icons inherit currentColor', () => {
  assert.match(app, /\.chat-head #openLeft svg,\.chat-head #openRight svg\{width:24px;height:24px;fill:none;stroke:currentColor/);
});

test('9. dark mode uses the existing html appearance selector', () => {
  assert.match(app, /html\[data-appearance="dark"\] \.chat-head \.icon-btn/);
});

test('10. header controls provide 44px touch targets', () => {
  assert.match(app, /\.chat-head \.icon-btn\{width:44px;height:44px\}/);
});

test('11. header height is unchanged', () => {
  assert.match(html, /\.chat-head\{[^}]*height:46px/);
  assert.doesNotMatch(app, /chatTopBarControlsV100[^]*\.chat-head\{[^}]*height:/);
});

test('12. equal header columns preserve the centered title', () => {
  assert.match(app, /\.chat-head\{grid-template-columns:44px minmax\(0,1fr\) 44px\}/);
  assert.match(html, /<div class="chat-title" id="chatTitle">New chat<\/div>/);
});
