'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../lid-justguard-tool/.integration-temp/guard25386710-test-iuKM3H/game');
test('M2G real package apply/reapply/remove preserves unrelated EXE bytes',{skip:!fs.existsSync(path.join(root,'Binaries/Win64/BrgGame-Steam.exe'))},()=>{
 const tool=require('../tool'),pair={upk:fs.readFileSync(path.join(root,'BrgGame/CookedPCConsole/BrgGame.upk')),exe:fs.readFileSync(path.join(root,'Binaries/Win64/BrgGame-Steam.exe'))};pair.exe[0x100000]^=1;
 const result=tool.buildPair(pair);assert.equal(result.exe[0x100000],pair.exe[0x100000]);
 assert.deepEqual(tool.buildPair(result).exe,result.exe);
 const removed=tool.removePatchPair(result);assert.deepEqual(removed.exe,pair.exe);assert.deepEqual(removed.upk,pair.upk);
 const conflict=Buffer.from(pair.exe),at=conflict.indexOf(Buffer.from('brggame.upk\0'))+12;conflict[at]^=1;
 assert.throws(()=>tool.buildPair({...pair,exe:conflict}),/hash does not match|해시/);
});
