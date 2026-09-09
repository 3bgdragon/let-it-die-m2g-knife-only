'use strict';
// Read-only logical comparison. Game files are never written by this verifier.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const p = require('../package-patch');
const b = require('../bytecode');
function verify(source, patched) {
  const old = p.entries(source.upk), next = p.entries(patched.upk);
  const original = p.readAt(source.upk, old, p.PLAY_OFFSET, p.PLAY_SIZE).data;
  const expected = b.patchPlayShot(original);
  const slot = p.readAt(patched.upk, next, p.EXPORT_SLOT + 32, 8).data;
  const size = slot.readUInt32LE(), offset = slot.readUInt32LE(4);
  assert.equal(size, expected.length);
  assert.equal(offset, old.at(-1)[0] + old.at(-1)[1]);
  const exportIndex = p.readAt(source.upk, old, p.EXPORT_SLOT + 32, 8).index;
  for (let i = 0; i < old.length; i++) {
    const before = p.unpack(source.upk, old[i]), after = p.unpack(patched.upk, next[i]);
    let desired = before;
    if (i === exportIndex) { desired = Buffer.from(before); slot.copy(desired, p.EXPORT_SLOT + 32 - old[i][0]); }
    else if (i === old.length - 1) desired = Buffer.concat([before, expected]);
    assert.ok(after.equals(desired), `Unexpected logical change in chunk ${i}`);
  }
  assert.ok(p.linkExecutable(source.exe, source.upk, patched.upk).equals(patched.exe));
  const scriptDiskBytes = expected.readUInt32LE(0x2c), scriptRuntimeBytes = expected.readUInt32LE(0x28);
  assert.equal(b.inspect(expected.subarray(0x30, 0x30 + scriptDiskBytes)).memory, scriptRuntimeBytes);
  return { sourceSHA256: p.sha(source.upk), patchedSHA256: p.sha(patched.upk), chunksCompared: old.length,
    changedExistingLogicalBytes: 8, appendedFunctionBytes: size, scriptDiskBytes, scriptRuntimeBytes,
    unrelatedCodePreserved: true, executableOnlyTwoManifestDigestsChanged: true };
}
if (require.main === module) {
  if (process.argv.length !== 6) throw new Error('node dev/verify.js ORIGINAL.upk PATCHED.upk ORIGINAL.exe PATCHED.exe');
  const [upk, changedUpk, exe, changedExe] = process.argv.slice(2).map(f => fs.readFileSync(f));
  console.log(JSON.stringify(verify({ upk, exe }, { upk: changedUpk, exe: changedExe }), null, 2));
}
module.exports = { verify };
