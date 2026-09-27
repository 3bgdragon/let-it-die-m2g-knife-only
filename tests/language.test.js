'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { configure, text } = require('../language');
const directory = path.resolve(__dirname, '..');
test('explicit language preserves command arguments and supports switching', () => {
  assert.deepEqual(configure(['--lang', 'en', 'apply', '--game', 'C:/한국어 경로'], directory), ['apply', '--game', 'C:/한국어 경로']);
  assert.equal(text('한국어', 'English'), 'English');
  configure(['--lang', 'ko'], directory);
  assert.equal(text('한국어', 'English'), '한국어');
  assert.throws(() => configure(['--lang', 'en', '--lang', 'ko'], directory), /Usage/);
  assert.throws(() => configure(['--lang'], directory), /Usage/);
});
test('English help and invalid command diagnostics contain no Korean text', () => {
  for (const args of [['--help'], ['invalid-command']]) {
    const result = spawnSync(process.execPath, ['tool.js', '--lang', 'en', ...args], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, args[0] === '--help' ? 0 : 1);
    assert.doesNotMatch(result.stdout + result.stderr, /[가-힣]/);
  }
});
test('English safety errors retain rejection behavior', () => {
  const tool = require('../tool');
  configure(['--lang', 'en'], directory);
  try { assert.throws(() => tool.apply('unused', 'unused', { running: () => true }), /Close the game completely/); }
  finally { configure(['--lang', 'ko'], directory); }
});
