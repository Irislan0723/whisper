import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const server = readFileSync(new URL('server.js', root), 'utf8');

function extractFunction(name) {
  const start = server.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = server.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < server.length; index++) {
    if (server[index] === '{') depth++;
    if (server[index] === '}' && --depth === 0) return server.slice(start, index + 1);
  }
  throw new Error(`could not extract ${name}`);
}

const formatToolResultForCcContinuation = new Function(
  'TOOL_RESULT_MAX_CHARS',
  `${extractFunction('formatToolResultForCcContinuation')}; return formatToolResultForCcContinuation;`,
)(48_000);

test('a normal three-course timetable reaches the Claude Code continuation intact', () => {
  const timetable = {
    settings: { term: '2026秋', periodTimes: Array.from({ length: 12 }, (_, i) => ({ period: i + 1, startTime: '08:00', endTime: '08:45' })) },
    courses: [
      { courseName: '课程一', periodStart: 1, periodEnd: 2, startTime: '08:00', endTime: '09:35', location: 'A101' },
      { courseName: '课程二', periodStart: 5, periodEnd: 6, startTime: '14:00', endTime: '15:35', location: 'B202' },
      { courseName: '大学生就业指导', periodStart: 9, periodEnd: 10, startTime: '19:00', endTime: '20:35', location: 'C303' },
    ],
  };
  const formatted = formatToolResultForCcContinuation('read_timetable', timetable);
  assert.equal(formatted.truncated, false);
  assert.equal(formatted.rawChars, formatted.sentChars);
  assert.deepEqual(JSON.parse(formatted.text), timetable);
  assert.match(formatted.text, /大学生就业指导/);
});

test('an extreme result is explicitly marked instead of silently truncating', () => {
  const formatted = formatToolResultForCcContinuation('search_memories', { items: ['x'.repeat(60_000)] });
  assert.equal(formatted.truncated, true);
  assert.equal(formatted.rawChars, JSON.stringify({ items: ['x'.repeat(60_000)] }).length);
  assert.equal(formatted.sentChars, formatted.text.length);
  assert.ok(formatted.sentChars <= 48_000);
  assert.match(formatted.text, /【工具结果已截断】name=search_memories/);
  assert.match(formatted.text, new RegExp(`raw_chars=${formatted.rawChars}`));
  assert.match(formatted.text, new RegExp(`sent_chars=${formatted.sentChars}`));
});

test('Claude Code continuation uses the shared formatter while the UI preview remains 260 characters', () => {
  assert.match(server, /const continuation = formatToolResultForCcContinuation\(call\.name, result\)/);
  assert.doesNotMatch(server, /resultParts\.push\(`\$\{call\.name\}: 成功\\n\$\{JSON\.stringify\(result, null, 0\)\.slice\(0, 2000\)\}`\)/);
  assert.match(server, /function toolTracePreview\(value, limit = 260\)/);
  assert.match(server, /\[tool-result\] name=\$\{call\.name\} raw_chars=\$\{continuation\.rawChars\}/);
});
