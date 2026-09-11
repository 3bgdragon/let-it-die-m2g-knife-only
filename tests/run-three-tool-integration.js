'use strict';
// Developer-only real-file integration. All writes stay inside fresh fixtures.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const [sourceArg,guardArg,warpArg]=process.argv.slice(2);
if(!sourceArg||!guardArg||!warpArg)throw Error('Pass source game, guard repository, warp repository');
const source=path.resolve(sourceArg),guardRepo=path.resolve(guardArg),warpRepo=path.resolve(warpArg);
const m2g=require('../tool');
const parent=path.resolve(__dirname,'../.test-output');fs.mkdirSync(parent,{recursive:true});
const root=fs.mkdtempSync(path.join(parent,'three-tools-'));
function load(repo,file,exports,backup){const script=path.join(repo,file);const ctx={require:createRequire(script),__dirname:repo,Buffer,console,process,backup};vm.createContext(ctx);vm.runInContext(fs.readFileSync(script,'utf8').split('main().catch(')[0]+`\nisGameRunning=()=>false;backupRoot=()=>backup;globalThis.api={${exports}};`,ctx);return ctx.api;}
const g=load(guardRepo,'lid-justguard.js','applySettings,restoreBackup,readStatus',path.join(root,'gbackup'));
const w=load(warpRepo,'lid-tengoku-warp.js','setPatchState,restoreBackup,readStatus',path.join(root,'wbackup'));
const rel=['BrgGame/CookedPCConsole/BrgGame.upk','BrgGame/CookedPCConsole/AS_CH_Main_Male_Common_SF.upk','BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk','BrgGame/CookedPCConsole/BrgStart_PL.upk','Binaries/Win64/BrgGame-Steam.exe'];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function copy(a,b){fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b);}
function snapshot(game){return rel.map(r=>hash(path.join(game,r)));}
function clone(from,to){for(const r of rel)copy(path.join(from,r),path.join(to,r));}
const sourceHashes=snapshot(source),base=path.join(root,'base');clone(source,base);
const baseMb=path.join(root,'mbase');
if(m2g.inspectStatus(m2g.readPair(base)).applied)m2g.remove(base,baseMb,{running:()=>false});
w.setPatchState(base,false,true);g.applySettings(base,'stock','off','off');
const stock=snapshot(base),results=[];let canonical;
function cleanBackups(folders){for(const folder of folders){if(!path.resolve(folder).startsWith(root+path.sep))throw Error('outside test root');if(!fs.existsSync(folder))continue;for(const d of fs.readdirSync(folder)){const sub=path.join(folder,d);for(const f of fs.readdirSync(sub))fs.unlinkSync(path.join(sub,f));fs.rmdirSync(sub);}}}
for(const order of ['GWM','GMW','WGM','WMG','MGW','MWG']){
 const game=path.join(root,order);clone(base,game);const mb=path.join(root,order+'-mbackup');let firstBackup;
 function apply(action){if(action==='G')return g.applySettings(game,'soft','on','on').backupPath;if(action==='W')return w.setPatchState(game,true,true).backupPath;return m2g.apply(game,mb,{running:()=>false});}
 function restore(action,backup){if(action==='G')return g.restoreBackup(game,backup);if(action==='W')return w.restoreBackup(game,backup);return m2g.restore(game,mb,{running:()=>false});}
 firstBackup=apply(order[0]);restore(order[0],firstBackup);assert.deepEqual(snapshot(game),stock);
 for(const action of order){const backup=apply(action);if(action===order[0])firstBackup=backup;}
 assert.equal(w.readStatus(game).coherent,true);assert.equal(g.readStatus(game).groggy.m2g,true);assert.equal(m2g.inspectStatus(m2g.readPair(game)).applied,true);
 canonical ||= snapshot(game);assert.deepEqual(snapshot(game),canonical);
 const beforeUnsafe=snapshot(game);assert.throws(()=>restore(order[0],firstBackup),/다른|변경|복원/);assert.deepEqual(snapshot(game),beforeUnsafe);
 for(const action of [...order].reverse()){if(action==='G')g.applySettings(game,'stock','off','off');if(action==='W')w.setPatchState(game,false,true);if(action==='M')m2g.remove(game,mb,{running:()=>false});}
 assert.deepEqual(snapshot(game),stock);
 results.push({order,apply:'pass',reverseSelectiveRemoval:'pass',immediateFullRestore:'pass',laterModRestoreBlocked:'pass'});
 fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(results,null,2));console.log('PASS',order);
 cleanBackups([path.join(root,'gbackup'),path.join(root,'wbackup'),mb,baseMb]);
}
assert.deepEqual(snapshot(source),sourceHashes);
console.log('ALL PASSED; source untouched. Evidence:',root);
