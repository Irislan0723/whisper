import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const init = fs.readFileSync(new URL('public/init.js', root), 'utf8');
const css = fs.readFileSync(new URL('public/style.css', root), 'utf8');
const more = fs.readFileSync(new URL('public/more.html', root), 'utf8');
const shell = fs.readFileSync(new URL('public/app.html', root), 'utf8');

test('1. More places the beautify entry directly after Clawd', () => {
  assert.match(more, /id="clawdPetBtn"[\s\S]*?<\/button>\s*<button class="settings-item" id="beautifyBtn"/);
});

test('2. the beautify entry uses an inline currentColor-compatible paintbrush SVG', () => {
  assert.match(more, /id="beautifyBtn"[\s\S]*?<svg viewBox="0 0 24 24"[\s\S]*?<path d="m14\.7 4\.2/);
  assert.doesNotMatch(more, /beautifyBtn[\s\S]{0,500}<img/i);
});

test('3. the first-version dialog exposes only the requested wallpaper, glass, and reset controls', () => {
  for (const id of ['wallpaperUpload', 'wallpaperVisibility', 'wallpaperBlur', 'removeWallpaper', 'uiOpacity', 'glassBlur', 'resetBeautify']) {
    assert.match(more, new RegExp(`id="${id}"`));
  }
});

test('4. upload accepts jpg, png, and webp without adding an asset dependency', () => {
  assert.match(more, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(more, /jpe\?g\|png\|webp/);
});

test('5. scalar visual settings have one localStorage key and normalized readable bounds', () => {
  assert.match(init, /KEY='whisper_global_appearance_v1'/);
  assert.match(init, /wallpaperVisibility:clamp\(value\.wallpaperVisibility,0,100/);
  assert.match(init, /wallpaperBlur:clamp\(value\.wallpaperBlur,0,24/);
  assert.match(init, /uiOpacity:clamp\(value\.uiOpacity,60,100/);
  assert.match(init, /glassBlur:clamp\(value\.glassBlur,0,30/);
});

test('6. wallpaper data is staged as a Blob and only reaches IndexedDB when Save is pressed', () => {
  assert.match(init, /indexedDB\.open\(DB,1\)/);
  assert.match(init, /function previewWallpaper\(file\)/);
  assert.match(init, /function save\(\)[\s\S]*?store\.put\(wallpaperBlob,WALLPAPER\)/);
  assert.match(init, /wallpaperBlob\?URL\.createObjectURL\(wallpaperBlob\)/);
  assert.doesNotMatch(init, /localStorage\.setItem\([^\n]*wallpaper[^\n]*file/i);
});

test('7. wallpaper is a separate cover layer with independent visibility and blur', () => {
  assert.match(css, /\.whisper-wallpaper-layer[\s\S]*?background-position: center;[\s\S]*?background-size: cover;[\s\S]*?filter: blur\(var\(--whisper-wallpaper-blur\)\)/);
  assert.match(css, /\.whisper-wallpaper-layer::after[\s\S]*?--whisper-wallpaper-overlay/);
});

test('8. global surfaces derive layered opacity variables and use both backdrop-filter variants', () => {
  for (const variable of ['--ui-surface-opacity', '--card-surface-opacity', '--panel-surface-opacity', '--modal-surface-opacity', '--nav-surface-opacity', '--glass-blur']) {
    assert.match(css, new RegExp(variable.replace(/[-]/g, '\\-')));
  }
  assert.match(css, /-webkit-backdrop-filter: blur\(var\(--glass-blur\)\)/);
  assert.match(css, /backdrop-filter: blur\(var\(--glass-blur\)\)/);
});

test('9. top nav, bottom nav, cards, modal, sidebar, drawer and settings all receive the glass treatment', () => {
  for (const selector of ['.top-bar', '.dock', '.card', '.modal', '.sidebar', '.drawer', '.settings-list']) {
    assert.match(css, new RegExp(selector.replace('.', '\\.') + '[,\\s]'));
  }
});

test('10. dark glass selectors retain the html[data-appearance="dark"] convention', () => {
  assert.match(css, /html\[data-appearance="dark"\]\[data-whisper-global-appearance="true"\]/);
  assert.doesNotMatch(css, /(^|\n)\[data-appearance="dark"\]/);
});

test('11. wallpaper is above the theme background but below ordinary page content, while Chat remains isolated', () => {
  assert.match(css, /\.whisper-wallpaper-layer[\s\S]*?z-index: 0/);
  assert.match(css, /body > :not\(\.whisper-wallpaper-layer\)[\s\S]*?z-index: 1/);
  assert.match(init, /var isChatRoom=\/\\\/chat\\\.html\$\/i/);
  assert.match(init, /if\(isChatRoom\) return;/);
  assert.doesNotMatch(more, /Chat.*壁纸|Chat.*透明度/);
});

test('12. active frames are notified without transferring wallpaper bytes', () => {
  assert.match(init, /type:'whisper:global-appearance-changed'/);
  assert.match(shell, /event\.data\?\.type==='whisper:global-appearance-changed'/);
  assert.doesNotMatch(init, /postMessage\([^\n]*wallpaperUrl/);
});

test('13. removal can be staged, reset remains protected, and settings have an explicit save action', () => {
  assert.match(init, /function previewRemoveWallpaper\(\)/);
  assert.match(init, /function reset\(\).*state=normalize\(DEFAULTS\)/s);
  assert.match(more, /id="beautifyConfirm" hidden/);
  assert.match(more, /id="confirmBeautifyReset"/);
  assert.match(more, /id="saveBeautify"/);
  assert.doesNotMatch(more, /confirm\(/);
});

test('14. the beautify sheet scrolls internally and prevents the page behind it from scrolling', () => {
  assert.match(more, /\.beautify-modal\{overflow:hidden;overscroll-behavior:contain\}/);
  assert.match(more, /\.beautify-modal \.modal\{[^}]*overflow:auto;overscroll-behavior:contain/);
  assert.match(more, /body\.beautify-open\{overflow:hidden;overscroll-behavior:none\}/);
  assert.match(more, /document\.body\.classList\.add\('beautify-open'\)/);
});
