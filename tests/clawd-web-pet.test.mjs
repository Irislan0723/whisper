import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const pet = read('public/clawd/clawd-pet.js');
const css = read('public/clawd/clawd-pet.css');
const app = read('public/app.html');
const init = read('public/init.js');
const more = read('public/more.html');
const chat = read('public/chat-app-20260821-1310.js');

test('Clawd ships the retained original theme, artwork, NOTICE, and asset license', () => {
  const base = new URL('public/clawd/', root);
  assert.ok(existsSync(new URL('theme.json', base)));
  assert.ok(existsSync(new URL('NOTICE.md', base)));
  assert.ok(existsSync(new URL('ASSETS-LICENSE', base)));
  assert.ok(readdirSync(new URL('assets/', base)).filter(name => /^clawd-.*\.svg$/.test(name)).length >= 48);
});

test('app shell owns one persistent Clawd root below music and search overlays', () => {
  assert.match(app, /id="clawdRoot"/);
  assert.match(app, /clawd\/clawd-pet\.css/);
  assert.match(app, /clawd\/clawd-pet\.js/);
  assert.match(css, /#clawdRoot\{[^}]*z-index:3/);
  assert.match(app, /\.float-root\{[^}]*z-index:10000/);
  assert.match(app, /\.player-search\{[^}]*z-index:10010/);
});

test('regular pages enter the persistent shell when either music or Clawd is enabled', () => {
  assert.match(init, /petEnabled=localStorage\.getItem\('whisper_clawd_enabled'\)==='1'/);
  assert.match(init, /if\(\(enabled\|\|petEnabled\)&&window\.top===window/);
});

test('Clawd state mapping and priority retain the original Web-relevant states', () => {
  for (const state of ['idle','roam','yawning','dozing','thinking','working','error','sleeping','waking','notification','attention','dizzy']) {
    assert.match(pet, new RegExp(`${state}:'clawd-`));
  }
  assert.match(pet, /error:8, notification:7, sweeping:6, attention:5/);
  assert.match(pet, /working:3, thinking:2/);
  assert.match(pet, /mouseIdle:20000, mouseSleep:60000/);
});

test('Clawd uses external original SVG documents and rebuilds them on state swaps', () => {
  assert.match(pet, /object\.type = 'image\/svg\+xml'/);
  assert.match(pet, /object\.data = `\$\{ASSET\}\$\{file\}\?r=\$\{Date\.now\(\)\}`/);
  assert.match(pet, /visual\.replaceChildren\(\)/);
});

test('Web roam is transform-based, bounded, randomized, and pauses after manual movement', () => {
  assert.match(pet, /translate3d/);
  assert.match(pet, /function clamp\(candidate\)/);
  assert.match(pet, /Math\.random\(\)/);
  assert.match(pet, /scheduleRoam\(90000\)/);
});

test('drag uses Pointer Events, capture, cancellation, and persistent positions', () => {
  for (const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture']) assert.ok(pet.includes(`addEventListener('${name}'`));
  assert.match(pet, /setPointerCapture/);
  assert.match(pet, /releasePointerCapture/);
  assert.match(pet, /whisper_clawd_position/);
  assert.match(pet, /visualViewport\?\.addEventListener\('resize'/);
});

test('visibility and iframe overlays pause or cover the pet without sharing music drag state', () => {
  assert.match(pet, /document\.addEventListener\('visibilitychange'/);
  assert.match(pet, /function stopTick\(\)/);
  assert.match(pet, /if \(pausedForVisibility\) \{ stopRoam\(\); stopTick\(\); \}/);
  assert.match(pet, /type === 'whisper:pet-overlay'/);
  assert.match(init, /whisper:pet-overlay/);
  assert.match(app, /WhisperClawd\?\.setCovered/);
  assert.doesNotMatch(pet, /floatRoot|floatDisc|iris_global_player_float/);
});

test('More exposes a default-off switch, three sizes, and reset position', () => {
  assert.match(more, /id="clawdPetBtn"/);
  assert.match(more, /id="clawdEnabled"/);
  assert.match(more, /data-clawd-size="small"/);
  assert.match(more, /data-clawd-size="medium"/);
  assert.match(more, /data-clawd-size="large"/);
  assert.match(more, /id="clawdResetPosition"/);
});

test('Chat sends only narrow lifecycle states to the parent pet bridge', () => {
  assert.match(chat, /function whisperPetStateV103\(state\)/);
  assert.match(chat, /whisperPetStateV103\('thinking'\)/);
  assert.match(chat, /whisperPetStateV103\(toolFailed\|\|pendingTurnGroupId\?'error':'attention'\)/);
  assert.match(init, /payload deliberately contains only UI state, never chat text or data/);
});

test('the Web pet introduces no Electron or native-module runtime dependency', () => {
  assert.doesNotMatch(pet, /require\(|BrowserWindow|ipcRenderer|koffi|child_process/);
});
