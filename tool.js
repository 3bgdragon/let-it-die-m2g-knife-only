'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const patch = require('./package-patch');
const VERSION = '1.1.0';
const FILES = { upk: 'BrgGame/CookedPCConsole/BrgGame.upk', exe: 'Binaries/Win64/BrgGame-Steam.exe' };
const keys = Object.keys(FILES);
function gameRunning() {
  // Fail closed if process enumeration is unavailable. Never terminate a game.
  const output = execFileSync('tasklist.exe', ['/FO', 'CSV', '/NH'], { windowsHide: true, encoding: 'utf8' });
  return output.toLowerCase().includes('brggame-steam.exe');
}
const readPair = game => Object.fromEntries(keys.map(k => [k, fs.readFileSync(path.join(game, FILES[k]))]));
const hashes = pair => Object.fromEntries(keys.map(k => [k, patch.sha(pair[k])]));
const sameHashes = (a, b) => keys.every(k => a?.[k] === b?.[k]);
function buildPair(pair) {
  const upk = patch.build(pair.upk);
  return { upk, exe: patch.linkExecutable(pair.exe, pair.upk, upk) };
}
function writeExclusive(file, data) {
  const fd = fs.openSync(file, 'wx');
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
function saveRecord(folder, record) {
  const pending = path.join(folder, `record-${randomUUID()}.pending`);
  writeExclusive(pending, JSON.stringify(record, null, 2));
  fs.renameSync(pending, path.join(folder, 'record.json'));
}
function replacePair(game, before, after, { running = gameRunning, replace = fs.renameSync } = {}) {
  if (running()) throw new Error('게임을 완전히 종료하세요.');
  const beforeHashes = hashes(before), afterHashes = hashes(after);
  if (!sameHashes(hashes(readPair(game)), beforeHashes)) throw new Error('작업 중 게임 파일이 변경됐습니다.');
  const suffix = `.m2g-${randomUUID()}.tmp`, staged = {}, installed = [];
  try {
    for (const key of keys) {
      const temporary = path.join(game, FILES[key]) + suffix;
      // Register only after exclusive open succeeds: never delete an existing file.
      const fd = fs.openSync(temporary, 'wx'); staged[key] = temporary;
      try { fs.writeFileSync(fd, after[key]); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      if (patch.sha(fs.readFileSync(temporary)) !== afterHashes[key]) throw new Error('임시 파일 검증 실패');
    }
    if (running() || !sameHashes(hashes(readPair(game)), beforeHashes)) throw new Error('설치 직전 게임 실행/파일 변경 감지');
    for (const key of keys) {
      replace(staged[key], path.join(game, FILES[key])); installed.push(key);
    }
    if (!sameHashes(hashes(readPair(game)), afterHashes)) throw new Error('설치 후 검증 실패');
  } catch (error) {
    for (const key of installed.reverse()) {
      const destination = path.join(game, FILES[key]);
      if (patch.sha(fs.readFileSync(destination)) !== afterHashes[key]) throw new Error('외부 파일 변경: 자동 복원 중단. 전용 백업을 보존했습니다.', { cause: error });
      const rollback = destination + suffix + '.rollback';
      writeExclusive(rollback, before[key]); fs.renameSync(rollback, destination);
    }
    throw error;
  } finally {
    for (const file of Object.values(staged)) if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}
function apply(game, backupRoot, { running = gameRunning, builder = buildPair } = {}) {
  if (running()) throw new Error('게임을 완전히 종료하세요.');
  const before = readPair(game), after = builder(before);
  const now = new Date(), pad = n => String(n).padStart(2, '0');
  // Same sortable local-time prefix as v1.0.0 Python backups.
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const folder = path.join(backupRoot, `${stamp}-${BigInt(Date.now()) * 1000000n}-${randomUUID().slice(0, 8)}`);
  fs.mkdirSync(backupRoot, { recursive: true }); fs.mkdirSync(folder);
  for (const key of keys) {
    const file = path.join(folder, key + '.bak');
    writeExclusive(file, before[key]);
    if (patch.sha(fs.readFileSync(file)) !== patch.sha(before[key])) throw new Error('백업 검증 실패');
  }
  const record = { version: 1, game: path.resolve(game), state: 'prepared', before: hashes(before), after: hashes(after) };
  saveRecord(folder, record);
  replacePair(game, before, after, { running });
  record.state = 'applied'; saveRecord(folder, record);
  return folder;
}
const canonical = value => path.resolve(value).toLowerCase();
function records(game, backupRoot) {
  if (!fs.existsSync(backupRoot)) return [];
  const result = [];
  for (const item of fs.readdirSync(backupRoot, { withFileTypes: true }).filter(d => d.isDirectory()).sort((a, b) => b.name.localeCompare(a.name))) {
    const folder = path.join(backupRoot, item.name), file = path.join(folder, 'record.json');
    if (!fs.existsSync(file)) continue;
    const record = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (record.version === 1 && typeof record.game === 'string' && canonical(record.game) === canonical(game)) {
      if (!['prepared', 'applied', 'restored'].includes(record.state) || !keys.every(k => /^[a-f0-9]{64}$/.test(record.before?.[k]) && /^[a-f0-9]{64}$/.test(record.after?.[k]))) throw new Error(`백업 기록 형식 오류: ${file}`);
      result.push({ folder, record });
    }
  }
  return result;
}
function restore(game, backupRoot, { running = gameRunning } = {}) {
  if (running()) throw new Error('게임을 완전히 종료하세요.');
  const current = readPair(game), currentHashes = hashes(current);
  for (const { folder, record } of records(game, backupRoot)) {
    if (record.state === 'restored') continue;
    if (!keys.every(k => [record.before[k], record.after[k]].includes(currentHashes[k]))) throw new Error('패치 이후 다른 도구/업데이트가 파일을 변경했습니다. 전체 백업으로 덮어쓰지 않고 중단합니다.');
    const original = Object.fromEntries(keys.map(k => [k, fs.readFileSync(path.join(folder, k + '.bak'))]));
    if (!sameHashes(hashes(original), record.before)) throw new Error('백업이 손상됐습니다.');
    replacePair(game, current, original, { running });
    record.state = 'restored'; saveRecord(folder, record);
    return folder;
  }
  throw new Error('이 게임 경로의 복원 가능한 전용 백업이 없습니다. 기존 버전의 backups 폴더를 함께 옮기세요.');
}
function detectGame() {
  const steamRoots = [path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Steam')];
  try {
    const registry = execFileSync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const match = registry.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (match) steamRoots.unshift(match[1].trim());
  } catch { /* Manual path and default Steam location remain available. */ }
  const roots = [...steamRoots];
  for (const steam of steamRoots) {
    const file = path.join(steam, 'steamapps/libraryfolders.vdf');
    if (fs.existsSync(file)) for (const match of fs.readFileSync(file, 'utf8').matchAll(/"path"\s+"([^"]+)"/g)) roots.push(match[1].replace(/\\\\/g, '\\'));
  }
  for (const root of new Set(roots)) {
    const game = path.join(root, 'steamapps/common/LET IT DIE');
    if (keys.every(k => fs.existsSync(path.join(game, FILES[k])))) return path.resolve(game);
  }
  return null;
}
async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    version: { type: 'boolean' }, help: { type: 'boolean' }, yes: { type: 'boolean' }, game: { type: 'string' }, output: { type: 'string' },
  } });
  if (values.version) { console.log(VERSION); return; }
  if (values.help) { console.log('node tool.js [status|trial|apply|restore] [--game "게임 설치 폴더"] [--yes]\ntrial: --output "새 출력 폴더" 필수'); return; }
  if (positionals.length > 1 || (positionals.length && !['status', 'trial', 'apply', 'restore'].includes(positionals[0]))) throw new Error('지원하지 않는 명령입니다. --help로 확인하세요.');
  let input, lines;
  async function ask(prompt) {
    if (!input) { input = require('node:readline').createInterface({ input: process.stdin, crlfDelay: Infinity }); lines = input[Symbol.asyncIterator](); }
    process.stdout.write(prompt);
    const line = await lines.next();
    if (line.done) throw new Error('입력이 종료됐습니다.');
    return line.value.trim();
  }
  try {
    let game = values.game || detectGame(), command = positionals[0];
    if (!game && !command) game = (await ask('LET IT DIE 설치 폴더: ')).replace(/^"|"$/g, '');
    if (!game) throw new Error('--game "설치 폴더"를 지정하세요.');
    game = path.resolve(game);
    const backupRoot = path.join(__dirname, 'backups');
    if (!command) {
      console.log(`\nM2G 나이프 전용 모드 ${VERSION} · Node.js\n게임: ${game}`);
      console.log('플레이어 일반 사격만 나이프로 변경. 레이지·AI·피해 배율·비용 유지.');
      console.log('조준 룰렛 그림은 그대로지만 실제 사격은 나이프입니다.');
      console.log('다른 UPK 패치 도구는 이 모드를 먼저 복원한 뒤 사용하세요.');
      console.log('1. 상태 확인\n2. 적용\n3. 전용 백업으로 복원\n0. 종료');
      const choice = await ask('선택: ');
      if (choice === '0') return;
      command = { 1: 'status', 2: 'apply', 3: 'restore' }[choice];
      if (!command) throw new Error('잘못된 선택');
    }
    if (command === 'status') {
      const pair = readPair(game), current = hashes(pair);
      if (records(game, backupRoot).some(({ record }) => record.state !== 'restored' && sameHashes(record.after, current))) console.log('나이프 전용 적용됨. 기존 버전 백업도 지원합니다.');
      else { buildPair(pair); console.log('지원되는 M2G 함수/실행 파일 해시 연결 확인. 현재 미적용.'); }
    } else if (command === 'trial') {
      if (!values.output) throw new Error('trial은 --output "새 출력 폴더"가 필요합니다.');
      const before = readPair(game), after = buildPair(before), output = path.resolve(values.output);
      fs.mkdirSync(output);
      for (const key of keys) writeExclusive(path.join(output, path.basename(FILES[key])), after[key]);
      if (!sameHashes(hashes(readPair(game)), hashes(before))) throw new Error('검증 중 원본이 변경됐습니다.');
      console.log(`복사본 생성 완료: ${output}\n원본 게임은 변경하지 않았습니다.`);
    } else {
      if (!values.yes && !['y', 'yes'].includes((await ask(`게임 종료 후 실행하세요. ${command} 진행? (y/N): `)).toLowerCase())) return;
      console.log('파일 검증 및 처리 중입니다. 창을 닫지 마세요.');
      const folder = command === 'apply' ? apply(game, backupRoot) : restore(game, backupRoot);
      console.log(`${command} 완료. 백업: ${folder}`);
    }
  } finally { input?.close(); }
}
if (require.main === module) main().catch(error => {
  console.error(`오류: ${error.message}\n파일 접근이 거부되면 터미널을 관리자 권한으로 실행하세요.`);
  process.exitCode = 1;
});
module.exports = { VERSION, FILES, gameRunning, readPair, hashes, buildPair, saveRecord, replacePair, apply, records, restore, detectGame, main };
