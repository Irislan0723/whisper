import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const app = fs.readFileSync(new URL('public/chat-app-20260821-1310.js', root), 'utf8');
const html = fs.readFileSync(new URL('public/chat.html', root), 'utf8');

test('1. landing start button renders only the plus SVG', () => assert.match(app, /\$\('startChatBtn'\)\.innerHTML=ICON\.plus;/));
test('2. landing start button has no visible New chat text', () => assert.doesNotMatch(app, /\$\('startChatBtn'\)\.innerHTML=ICON\.plus\+' New chat'/));
test('3. landing start button keeps its existing start handler', () => assert.match(app, /\$\('startChatBtn'\)\.onclick=\(\)=>/));
test('4. reply button final visual guard uses the Claude logo', () => assert.match(app, /if\(reply\)reply\.innerHTML=AI_REPLY_CLAUDE_LOGO/));
test('5. reply button uses the fixed-size local Claude logo', () => assert.match(app, /AI_REPLY_CLAUDE_LOGO='<img class="ai-reply-logo" src="\/icons\/claude-logo\.png" width="22" height="22"/));
test('6. reply button keeps the request-AI handler', () => assert.match(app, /\$\('askReplyBtn'\)\.onclick=requestAiReply/));
test('7. send button keeps the upward-arrow SVG', () => assert.match(app, /ICON\.send='<svg[^>]*><path d="M12 19V5M7 10l5-5 5 5"/));
test('8. send button keeps the existing user-send handler', () => assert.match(app, /\$\('sendBtn'\)\.onclick=sendUserBubble/));
test('9. both right-side buttons have the same explicit width', () => assert.match(app, /#askReplyBtn,\.chat-room \.composer-box #sendBtn\{box-sizing:border-box!important;width:48px!important/));
test('10. both right-side buttons have the same explicit height', () => assert.match(app, /height:48px!important;min-width:48px!important;min-height:48px!important;flex:0 0 48px!important/));
test('11. send button cannot grow beyond the shared circle size', () => assert.match(app, /#askReplyBtn,\.chat-room \.composer-box #sendBtn\{[^}]*border-radius:50%!important/s));
test('12. all actual chat rooms use the same two composer controls', () => assert.equal((html.match(/id="askReplyBtn"/g) || []).length, 1));
test('13. reply logo cannot participate in layout growth', () => assert.match(app, /#askReplyBtn \.ai-reply-logo\{display:block;width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;object-fit:contain/));
test('14. light mode keeps the send button on the existing theme accent', () => assert.match(html, /\.composer-box \.send\{background:var\(--chat-accent\);color:var\(--accent-contrast\)/));
