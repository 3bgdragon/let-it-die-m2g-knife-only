'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const b = require('../bytecode');
const p = require('../package-patch');
const t = require('../tool');

test('player gate, knife type and sentinel: disk 71 / runtime 91', () => {
  const { code, memory } = b.playerPrefix();
  assert.equal(code.length, 71); assert.equal(memory, 91);
  assert.deepEqual(b.inspect(code), { memory: 91, jumps: [[1, 91]] });
  assert.ok(code.includes(Buffer.concat([Buffer.from([0x0f]), b.instance(9325), Buffer.from([0x2c, 2])])));
  assert.ok(code.includes(b.call(62614, Buffer.from([0x2c, 6]))));
  const ref = Buffer.alloc(4); ref.writeUInt32LE(53632);
  assert.ok(code.includes(Buffer.concat([Buffer.from([0x2e]), ref, b.instance(9431)])));
});
test('original NPC jump relocation and function trailer preserved', () => {
  const code = Buffer.from([7, 5, 0, 0x27, 0x0b, 4, 0x0b, 0x53]);
  const header = Buffer.alloc(0x30);
  header.writeUInt32LE(b.inspect(code).memory, 0x28); header.writeUInt32LE(code.length, 0x2c);
  const trailer = Buffer.from('function-trailer');
  const result = b.patchPlayShot(Buffer.concat([header, code, trailer]));
  assert.equal(result.readUInt32LE(0x28), code.length + 91);
  assert.equal(result.readUInt32LE(0x2c), code.length + 71);
  assert.deepEqual(b.inspect(result.subarray(0x30, -trailer.length)).jumps, [[1, 91], [72, 96]]);
  assert.ok(result.subarray(-trailer.length).equals(trailer));
});
test('reject malformed tokens, truncated scripts, bad context and jump', () => {
  for (const hex of ['02', '01', '07020027', '19010100000002000000000000270b']) assert.throws(() => b.inspect(Buffer.from(hex, 'hex')));
  assert.throws(() => b.patchPlayShot(Buffer.alloc(8)));
});
test('LZO roundtrip: random, repeat, small, empty, multiblock', () => {
  for (const raw of [Buffer.alloc(0), Buffer.alloc(1), Buffer.alloc(131072), Buffer.from('knife'.repeat(100000)), randomBytes(320000), ...Array.from({ length: 24 }, (_, i) => randomBytes(i))]) {
    const packed = p.pack(raw);
    assert.deepEqual(p.unpack(packed, [0, raw.length, 0, packed.length]), raw);
  }
});
test('reject corrupt chunk sizes, payload lengths and truncated frames', () => {
  const raw = Buffer.from('knife'.repeat(10000)), packed = p.pack(raw), entry = [0, raw.length, 0, packed.length];
  assert.throws(() => p.unpack(packed, [0, raw.length + 1, 0, packed.length]));
  for (const offset of [0, 8, 12, 16, 20]) {
    const bad = Buffer.from(packed); bad.writeUInt32LE(0xffffffff, offset);
    assert.throws(() => p.unpack(bad, entry));
  }
  assert.throws(() => p.unpack(packed.subarray(0, -1), entry));
  assert.throws(() => p.pack(raw, 0));
});
test('EXE changes only two SHA-1 manifest entries; mismatched links rejected', () => {
  const before = Buffer.from('old'), after = Buffer.from('new');
  const sha1 = x => createHash('sha1').update(x).digest();
  const entry = Buffer.concat([Buffer.from('brggame.upk\0'), sha1(before), Buffer.from('keep-native-hooks')]);
  const source = Buffer.concat([Buffer.from('MZ'), entry, entry]);
  const result = p.linkExecutable(source, before, after);
  const expected = Buffer.from(source);
  let cursor = 0;
  while ((cursor = expected.indexOf(sha1(before), cursor)) !== -1) { sha1(after).copy(expected, cursor); cursor += 20; }
  assert.deepEqual(result, expected);
  assert.throws(() => p.linkExecutable(source, Buffer.from('wrong'), after));
  assert.throws(() => p.linkExecutable(Buffer.concat([Buffer.from('MZ'), entry]), before, after));
});

function fixture(ctx) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lid-m2g-node-test-'));
  ctx.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('lid-m2g-node-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const game = path.join(root, '한글 게임 경로'), backups = path.join(root, 'backups');
  const before = { upk: Buffer.from('original guard warp'), exe: Buffer.from('MZ original hooks') };
  const after = { upk: Buffer.from('patched guard warp'), exe: Buffer.from('MZ linked hooks') };
  for (const key of Object.keys(t.FILES)) {
    const file = path.join(game, t.FILES[key]);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, before[key]);
  }
  return { root, game, backups, before, after, options: { running: () => false, builder: () => after } };
}
test('apply then restore: exact backups and record version 1', ctx => {
  const f = fixture(ctx), folder = t.apply(f.game, f.backups, f.options);
  assert.deepEqual(t.readPair(f.game), f.after);
  assert.deepEqual(fs.readFileSync(path.join(folder, 'upk.bak')), f.before.upk);
  assert.equal(t.records(f.game, f.backups)[0].record.version, 1);
  t.restore(f.game, f.backups, f.options);
  assert.deepEqual(t.readPair(f.game), f.before);
  assert.equal(t.records(f.game, f.backups)[0].record.state, 'restored');
});
test('failed second replacement rolls back first and cleans staged files', ctx => {
  const f = fixture(ctx); let count = 0;
  assert.throws(() => t.replacePair(f.game, f.before, f.after, { running: () => false, replace: (a, z) => {
    if (++count === 2) throw new Error('simulated executable lock');
    fs.renameSync(a, z);
  } }), /simulated/);
  assert.deepEqual(t.readPair(f.game), f.before);
  for (const rel of Object.values(t.FILES)) assert.equal(fs.readdirSync(path.dirname(path.join(f.game, rel))).length, 1);
});
test('running game and concurrent change block writes', ctx => {
  const f = fixture(ctx);
  assert.throws(() => t.replacePair(f.game, f.before, f.after, { running: () => true }));
  assert.deepEqual(t.readPair(f.game), f.before);
  fs.writeFileSync(path.join(f.game, t.FILES.exe), 'external');
  assert.throws(() => t.replacePair(f.game, f.before, f.after, f.options));
  assert.equal(t.readPair(f.game).exe.toString(), 'external');
});
test('game launched during staging blocks installation', ctx => {
  const f = fixture(ctx); let calls = 0;
  assert.throws(() => t.replacePair(f.game, f.before, f.after, { running: () => ++calls > 1 }));
  assert.deepEqual(t.readPair(f.game), f.before);
});
test('restore refuses later mods and damaged backups', ctx => {
  const f = fixture(ctx), folder = t.apply(f.game, f.backups, f.options);
  fs.writeFileSync(path.join(f.game, t.FILES.exe), 'external');
  assert.throws(() => t.restore(f.game, f.backups, f.options), /업데이트/);
  assert.equal(t.readPair(f.game).exe.toString(), 'external');
  fs.writeFileSync(path.join(f.game, t.FILES.exe), f.after.exe);
  fs.writeFileSync(path.join(folder, 'exe.bak'), 'corrupt');
  assert.throws(() => t.restore(f.game, f.backups, f.options), /손상/);
});
test('legacy Python JSON record + partial installation + case-insensitive game path', ctx => {
  const f = fixture(ctx), folder = path.join(f.backups, '20260910-001049-1788966649197254500-7f28a03a');
  fs.mkdirSync(folder, { recursive: true });
  for (const key of Object.keys(t.FILES)) fs.writeFileSync(path.join(folder, key + '.bak'), f.before[key]);
  fs.writeFileSync(path.join(folder, 'record.json'), JSON.stringify({ version: 1, game: f.game.toUpperCase(), state: 'prepared', before: t.hashes(f.before), after: t.hashes(f.after) }));
  fs.writeFileSync(path.join(f.game, t.FILES.upk), f.after.upk);
  t.restore(f.game, f.backups, f.options);
  assert.deepEqual(t.readPair(f.game), f.before);
});
test('rollback never overwrites an external modification', ctx => {
  const f = fixture(ctx); let count = 0;
  assert.throws(() => t.replacePair(f.game, f.before, f.after, { running: () => false, replace: (a, z) => {
    if (++count === 2) { fs.writeFileSync(path.join(f.game, t.FILES.upk), 'external'); throw new Error('locked'); }
    fs.renameSync(a, z);
  } }), /외부 파일 변경/);
  assert.equal(t.readPair(f.game).upk.toString(), 'external');
});
test('CLI version and help run with no Python or npm on PATH', () => {
  for (const arg of ['--version', '--help']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, '../tool.js'), arg], { encoding: 'utf8', env: { ...process.env, PATH: '' } });
    assert.equal(result.status, 0, result.stderr); assert.ok(result.stdout.trim());
  }
});

function batch(name, args, withNode = true) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  env.PATH = (withNode ? path.dirname(process.execPath) + ';' : '') + path.join(process.env.SystemRoot, 'System32');
  return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', `${name} ${args}`], {
    cwd: path.join(__dirname, '..'), env, input: '\n', encoding: 'utf8', windowsHide: true,
  });
}
test('status validates EXE linkage even for a matching historical backup', () => {
  const upk = Buffer.from('test package');
  const entry = Buffer.concat([Buffer.from('brggame.upk\0'), createHash('sha1').update(upk).digest()]);
  const pair = { upk, exe: Buffer.concat([Buffer.from('MZ'), entry, entry]) };
  const records = [{ record: { state: 'applied', after: t.hashes(pair) } }];
  assert.deepEqual(t.inspectStatus(pair, records), { applied: true, exactBackup: true, combination: null });
  const broken = { ...pair, exe: Buffer.from(pair.exe) }; broken.exe[broken.exe.length - 1] ^= 1;
  assert.throws(() => t.inspectStatus(broken, [{ record: { state: 'applied', after: t.hashes(broken) } }]), /hash does not match/);
});
test('known status combinations cover four guard settings with and without warp', () => {
  const { profiles } = require('../known-combinations.json');
  assert.equal(profiles.length, 16); assert.equal(new Set(profiles.map(p => p.sha256)).size, 16);
  for (const guard of ['off-off', 'off-on', 'on-off', 'on-on']) {
    assert.equal(profiles.filter(p => p.guard === guard && p.warp).length, 2);
    assert.equal(profiles.filter(p => p.guard === guard && !p.warp).length, 2);
  }
  profiles.forEach(p => assert.match(p.sha256, /^[a-f0-9]{64}$/));
});
test('selective removal rejects unknown input before creating backups', ctx => {
  const f=fixture(ctx);
  assert.throws(()=>t.remove(f.game,f.backups,f.options),/지원하지 않는 M2G/);
  assert.deepEqual(t.readPair(f.game),f.before);
  assert.equal(fs.existsSync(f.backups),false);
});
test('removal backup cannot classify an unpatched package as applied', () => {
  const upk=Buffer.from('unknown base'),entry=Buffer.concat([Buffer.from('brggame.upk\0'),createHash('sha1').update(upk).digest()]);
  const pair={upk,exe:Buffer.concat([Buffer.from('MZ'),entry,entry])};
  assert.throws(()=>t.inspectStatus(pair,[{record:{state:'applied',operation:'remove',after:t.hashes(pair)}}]));
});
test('Windows run.bat and legacy setup.bat launch Node without Python', { skip: process.platform !== 'win32' }, () => {
  for (const name of ['run.bat', 'setup.bat']) {
    const result = batch(name, '--version');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(result.stdout.includes(t.VERSION));
  }
});
test('Windows launcher pauses and preserves CLI failure exit code', { skip: process.platform !== 'win32' }, () => {
  const result = batch('run.bat', '--unknown-option');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /unknown-option/);
  // pause prints a prompt even with redirected input; it must not erase status.
  assert.ok(result.stdout.trim().length > 0);
});
test('Windows launcher clearly reports missing Node without setup installation', { skip: process.platform !== 'win32' }, () => {
  const result = batch('run.bat', '--version', false);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Node\.js 22 or newer is required/);
  assert.match(result.stdout, /NOT required/);
});
