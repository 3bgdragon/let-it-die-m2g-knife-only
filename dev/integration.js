'use strict';
// Usage: node dev/integration.js "source game folder" ["Python trial folder"]
// Reads source only. All test writes are isolated under .test-output/node-integration-*.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const t = require('../tool'), p = require('../package-patch');
const { verify } = require('./verify');
const root = path.resolve(__dirname, '..');
if (!process.argv[2]) throw new Error('Source game folder required');
const sourceGame = path.resolve(process.argv[2]), before = t.readPair(sourceGame), beforeHashes = t.hashes(before);
fs.mkdirSync(path.join(root, '.test-output'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, '.test-output/node-integration-'));
const distribution = path.join(output, '배포 도구'), game = path.join(output, '게임 복사본');
fs.mkdirSync(distribution);
for (const name of ['tool.js', 'bytecode.js', 'package-patch.js', 'known-combinations.json', 'package.json', 'run.bat', 'setup.bat']) fs.copyFileSync(path.join(root, name), path.join(distribution, name));
for (const rel of ['vendor/README.md', 'vendor/lzo1x/LICENSE', 'vendor/lzo1x/dist/index.cjs']) {
  const target = path.join(distribution, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, rel), target);
}
for (const key of Object.keys(t.FILES)) {
  const file = path.join(game, t.FILES[key]);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, before[key], { flag: 'wx' });
}
// Minimal distribution: no Python reference, .venv, npm package install or node_modules.
// Windows OS utilities remain available for tasklist/Steam registry checks.
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
env.PATH = `${path.dirname(process.execPath)};${path.join(process.env.SystemRoot, 'System32')}`;
function cli(command, expected = 0) {
  const result = spawnSync(process.execPath, [path.join(distribution, 'tool.js'), command, '--game', game, '--yes'], { encoding: 'utf8', env, windowsHide: true });
  assert.equal(result.status, expected, result.stdout + result.stderr);
  return result.stdout;
}
// Testing a copy still observes the production game-running guard.
cli('status'); cli('apply');
const after = t.readPair(game), report = verify(before, after);
assert.match(cli('status'), /적용됨/);
cli('apply', 1); // duplicate application must fail without touching either file
assert.deepEqual(t.hashes(t.readPair(game)), t.hashes(after));
cli('restore');
assert.deepEqual(t.hashes(t.readPair(game)), beforeHashes);
const legacyDir = process.argv[3];
if (legacyDir) {
  const legacy = { upk: fs.readFileSync(path.join(legacyDir, 'BrgGame.upk')), exe: fs.readFileSync(path.join(legacyDir, 'BrgGame-Steam.exe')) };
  verify(before, legacy);
  const le = p.entries(legacy.upk), ne = p.entries(after.upk);
  for (let i = 0; i < le.length; i++) assert.ok(p.unpack(legacy.upk, le[i]).equals(p.unpack(after.upk, ne[i])), `Python/Node mismatch chunk ${i}`);
  // Emulate the exact v1.0.0 record schema, including non-ASCII folder paths.
  const folder = path.join(distribution, 'backups', '20990101-000000-1-legacy');
  fs.mkdirSync(folder);
  for (const key of Object.keys(t.FILES)) {
    fs.writeFileSync(path.join(folder, key + '.bak'), before[key]);
    fs.writeFileSync(path.join(game, t.FILES[key]), legacy[key]);
  }
  fs.writeFileSync(path.join(folder, 'record.json'), JSON.stringify({ version: 1, game, state: 'applied', before: beforeHashes, after: t.hashes(legacy) }));
  assert.match(cli('status'), /적용됨/); cli('restore');
  assert.deepEqual(t.hashes(t.readPair(game)), beforeHashes);
  report.pythonLogicalChunksIdentical = true;
  report.legacyPythonPatchRestored = true;
}
const bat = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'run.bat --version'], { cwd: distribution, encoding: 'utf8', env, input: '\n', windowsHide: true });
assert.equal(bat.status, 0, bat.stdout + bat.stderr); assert.ok(bat.stdout.includes(t.VERSION));
assert.deepEqual(t.hashes(t.readPair(sourceGame)), beforeHashes);
report.cleanNodeOnlyDistribution = true;
report.exactRestore = true;
report.sourceUntouched = true;
report.output = output;
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
