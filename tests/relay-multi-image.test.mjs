import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const relay = readFileSync(new URL('relay-tmux.js', root), 'utf8');

function extractFunction(name) {
  const start = relay.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = relay.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < relay.length; index++) {
    if (relay[index] === '{') depth++;
    if (relay[index] === '}' && --depth === 0) return relay.slice(start, index + 1);
  }
  throw new Error(`could not extract ${name}`);
}

const helpers = new Function(`${extractFunction('buildImagePrompt')}\n${extractFunction('composeMessageWithImages')}\nreturn { buildImagePrompt, composeMessageWithImages };`)();
const { buildImagePrompt, composeMessageWithImages } = helpers;
const paths = count => Array.from({ length: count }, (_, index) => `/tmp/image-${index + 1}.png`);

function createDecoder({ failWriteAt } = {}) {
  const writes = [];
  let uuid = 0;
  const decode = new Function(
    'IMAGE_MAX_PER_MSG', 'IMAGE_MAX_BASE64_LEN', 'ALLOWED_IMAGE_MIME', 'MIME_TO_EXT', 'IMAGE_DIR', 'join', 'randomUUID', 'writeFileSync', 'console',
    `${extractFunction('receivedImageCount')}\n${extractFunction('decodeAndSaveImages')}\nreturn decodeAndSaveImages;`,
  )(6, 1_600_000, /^image\/(jpeg|jpg|png|webp)$/i, { 'image/png': 'png' }, '/tmp/images', (...parts) => parts.join('/'), () => `uuid-${++uuid}`, (path, buffer) => {
    writes.push({ path, buffer });
    if (writes.length === failWriteAt) throw new Error('simulated write failure');
  }, { warn() {} });
  return { decode, writes };
}

const image = label => `data:image/png;base64,${Buffer.from(label).toString('base64')}`;

test('single image is an explicit native Claude Code attachment', () => {
  const prompt = buildImagePrompt(paths(1));
  assert.match(prompt, /【本轮图片附件：共 1 张】/);
  assert.match(prompt, /\[Image 1\/1\]\n@\/tmp\/image-1\.png/);
  assert.match(prompt, /原生图片附件引用/);
  assert.doesNotMatch(prompt, /Read 工具/);
});

test('two and three images are all native attachments in source order', () => {
  for (const count of [2, 3]) {
    const prompt = buildImagePrompt(paths(count));
    assert.match(prompt, new RegExp(`本消息包含 ${count} 张图片`));
    assert.match(prompt, new RegExp(`Image 1 到 Image ${count} 的顺序作为本轮视觉上下文`));
    for (let index = 1; index <= count; index++) assert.match(prompt, new RegExp(`\\[Image ${index}/${count}\\]\\n@/tmp/image-${index}\\.png`));
  }
});

test('six images are all native attachments in original order and the instruction precedes them', () => {
  const prompt = buildImagePrompt(paths(6));
  assert.match(prompt, /【本轮图片附件：共 6 张】/);
  assert.ok(prompt.indexOf('原生图片附件引用') < prompt.indexOf('[Image 1/6]'));
  for (let index = 1; index <= 6; index++) {
    assert.match(prompt, new RegExp(`\\[Image ${index}/6\\]\\n@/tmp/image-${index}\\.png`));
  }
});

test('distinct images, comparison requests, and per-image requests retain all images and original text', () => {
  const distinct = ['/tmp/red.png', '/tmp/blue.png', '/tmp/cat.png', '/tmp/dog.png', '/tmp/a.png', '/tmp/z.png'];
  const comparison = composeMessageWithImages('比较第 1 和第 6 张图片的差异。', distinct, 6);
  const describeEach = composeMessageWithImages('请逐张描述这 6 张图。', distinct, 6);
  assert.ok(comparison.indexOf('/tmp/red.png') < comparison.indexOf('/tmp/z.png'));
  assert.match(comparison, /【用户原始消息】\n比较第 1 和第 6 张图片的差异。$/);
  assert.match(describeEach, /【用户原始消息】\n请逐张描述这 6 张图。$/);
});

test('a partial save failure uses the readable count, reports failure, and renumbers paths', () => {
  const prompt = buildImagePrompt(paths(5), 6);
  assert.match(prompt, /【本轮图片附件：共 5 张】/);
  assert.match(prompt, /本轮用户上传了 6 张，其中 1 张处理失败，当前可读取 5 张。/);
  assert.match(prompt, /Image 1 到 Image 5 的顺序作为本轮视觉上下文/);
  assert.match(prompt, /\[Image 5\/5\]/);
  assert.doesNotMatch(prompt, /\[Image 6\/6\]/);
});

test('all image failures and plain text are both explicit and safe', () => {
  assert.match(buildImagePrompt([], 6), /本轮用户上传了 6 张，但全部处理失败，当前无可读取图片。/);
  assert.equal(composeMessageWithImages('纯文字消息', [], 0), '纯文字消息');
});

test('decoder saves up to six distinct images in source order', () => {
  const { decode, writes } = createDecoder();
  const result = decode(['1', '2', '3', '4', '5', '6', '7'].map(image));
  assert.equal(result.received, 6);
  assert.deepEqual(result.paths, [
    '/tmp/images/img-uuid-1.png', '/tmp/images/img-uuid-2.png', '/tmp/images/img-uuid-3.png',
    '/tmp/images/img-uuid-4.png', '/tmp/images/img-uuid-5.png', '/tmp/images/img-uuid-6.png',
  ]);
  assert.equal(writes.length, 6);
  assert.deepEqual(writes.map(write => write.buffer.toString()), ['1', '2', '3', '4', '5', '6']);
});

test('a single disk write failure retains the other images in their original order', () => {
  const { decode } = createDecoder({ failWriteAt: 3 });
  const result = decode(['1', '2', '3', '4', '5', '6'].map(image));
  assert.equal(result.received, 6);
  assert.deepEqual(result.paths, [
    '/tmp/images/img-uuid-1.png', '/tmp/images/img-uuid-2.png', '/tmp/images/img-uuid-4.png',
    '/tmp/images/img-uuid-5.png', '/tmp/images/img-uuid-6.png',
  ]);
  assert.match(buildImagePrompt(result.paths, result.received), /其中 1 张处理失败，当前可读取 5 张/);
});

test('relay keeps ordered saving and emits only count-based image lifecycle logs', () => {
  assert.match(relay, /for \(const item of batch\)/);
  assert.match(relay, /saved\.push\(filepath\)/);
  assert.match(relay, /\[images\] received=\$\{imageBatch\.received\}/);
  assert.match(relay, /\[images\] saved=\$\{imagePaths\.length\}/);
  assert.match(relay, /\[images\] native_attached=\$\{imagePaths\.length\}/);
});
