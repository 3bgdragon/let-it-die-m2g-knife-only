'use strict';
// Developer regression: all writes are isolated in a fresh .test-output folder.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),workspace=path.dirname(root),warp=path.join(workspace,'lid-tengoku-warp-tool');
const engine=require('../package-patch'),tool=require('../tool'),compat=require(path.join(warp,'compat/m2g'));
const profiles=require('../known-combinations.json').profiles;
const output=fs.mkdtempSync(path.join(root,'.test-output/remove-integration-')),distribution=path.join(output,'m2g'),logs=[];
for(const rel of ['tool.js','bytecode.js','package-patch.js','known-combinations.json','package.json','vendor/lzo1x/dist/index.cjs','vendor/lzo1x/LICENSE']){
 const target=path.join(distribution,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,rel),target);
}
const bases=path.join(warp,'.integration-temp/sha1-investigation-udfTrF'),legacy=path.join(warp,'.integration-temp/legacy-m2g-fixtures');
const live='C:/Program Files (x86)/Steam/steamapps/common/LET IT DIE';
const files={upk:'BrgGame/CookedPCConsole/BrgGame.upk',exe:'Binaries/Win64/BrgGame-Steam.exe',map:'BrgGame/CookedPCConsole/Heaven_A01_ST_COL.upk',start:'BrgGame/CookedPCConsole/BrgStart_PL.upk'};
const inputExe=path.join(root,'.test-output/game-copy',files.exe),exe=fs.readFileSync(inputExe),map=fs.readFileSync(path.join(live,files.map)),start=fs.readFileSync(path.join(live,files.start));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=game=>Object.fromEntries(Object.entries(files).map(([k,f])=>[k,fs.readFileSync(path.join(game,f))]));
const hashes=pair=>Object.fromEntries(Object.entries(pair).map(([k,b])=>[k,sha(b)]));
function write(game,pair){for(const[k,b]of Object.entries(pair)){const target=path.join(game,files[k]);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);}}
function linked(upk){const b=Buffer.from(exe),needle=Buffer.from('brggame.upk\0');let pos=0,count=0;while((pos=b.indexOf(needle,pos))>=0){pos+=needle.length;crypto.createHash('sha1').update(upk).digest().copy(b,pos);count++;}assert.equal(count,2);return b;}
function cli(which,game,command,expected=0){const entry=which==='warp'?path.join(warp,'lid-tengoku-warp.js'):path.join(distribution,'tool.js');const args=[entry,command,'--game',game,'--yes'];if(which==='warp')args.push('--experimental');const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,env:{...process.env,LID_TENGOKU_BACKUP_DIR:path.join(output,'warp-backups')}});logs.push({which,case:path.basename(game),command,exit:r.status,stdout:r.stdout,stderr:r.stderr});fs.writeFileSync(path.join(output,'commands.json'),JSON.stringify(logs,null,2));assert.equal(r.status,expected,r.stdout+r.stderr);return r;}
// Independently verify selective removal of all sixteen known packages.
for(const p of profiles){const state=p.warp?'warp':'no-warp',base=fs.readFileSync(path.join(bases,`${p.guard}-${state}.upk`));const upk=p.legacy?fs.readFileSync(path.join(legacy,`${p.guard}-${state}.upk`)):engine.build(base);assert.equal(sha(upk),p.sha256);const pair={upk,exe:linked(upk)},removed=tool.removePatchPair(pair);assert.equal(sha(removed.upk),sha(base));assert.ok(removed.exe.equals(linked(base)));assert.ok(compat.strip(upk).equals(base));const broken={upk:Buffer.from(upk),exe:pair.exe};broken.upk[20]^=1;assert.throws(()=>tool.removePatchPair(broken));}
console.log('16 known Node/legacy combinations: selective removal + tamper rejection passed');
const warpedBase=fs.readFileSync(path.join(bases,'on-on-warp.upk'));
const setup=path.join(output,'setup');write(setup,{upk:warpedBase,exe:linked(warpedBase),map,start});cli('warp',setup,'remove');const clean=read(setup),cleanHashes=hashes(clean);cli('warp',setup,'apply');const warped=read(setup);assert.equal(sha(warped.upk),sha(warpedBase));
const results=[];
// Exact user sequence: warp -> M2G -> remove warp -> full restore blocked -> remove M2G.
const a=path.join(output,'node-warp-removed-first');write(a,warped);cli('m2g',a,'apply');cli('warp',a,'remove');const knifeOnly=hashes(read(a));const refused=cli('m2g',a,'restore',1);assert.match(refused.stderr,/remove/);assert.doesNotMatch(refused.stderr,/관리자 권한/);cli('m2g',a,'remove');assert.deepEqual(hashes(read(a)),cleanHashes);assert.match(cli('m2g',a,'status').stdout,/미적용/);cli('m2g',a,'restore');assert.deepEqual(hashes(read(a)),knifeOnly);cli('m2g',a,'remove');assert.deepEqual(hashes(read(a)),cleanHashes);results.push({case:'user-sequence',passed:true,removeUndoExact:true});console.log('User sequence passed');
const b=path.join(output,'node-m2g-removed-first');write(b,clean);cli('m2g',b,'apply');cli('warp',b,'apply');cli('m2g',b,'remove');assert.deepEqual(hashes(read(b)),hashes(warped));cli('warp',b,'remove');assert.deepEqual(hashes(read(b)),cleanHashes);results.push({case:'node-opposite-removal-order',passed:true});console.log('Opposite removal order passed');
for(const first of ['warp','m2g']){const game=path.join(output,`legacy-${first}-removed-first`),upk=fs.readFileSync(path.join(legacy,'on-on-warp.upk'));write(game,{...warped,upk,exe:linked(upk)});assert.match(cli('warp',game,'status').stdout,/M2G 나이프/);assert.match(cli('m2g',game,'status').stdout,/적용됨/);const before=hashes(read(game));cli('warp',game,'apply');assert.deepEqual(hashes(read(game)),before);cli(first,game,'remove');if(first==='m2g')assert.deepEqual(hashes(read(game)),hashes(warped));else assert.equal(hashes(read(game)).upk,profiles.find(p=>!p.legacy&&!p.warp&&p.guard==='on-on').sha256);cli(first==='warp'?'m2g':'warp',game,'remove');assert.deepEqual(hashes(read(game)),cleanHashes);results.push({case:`legacy-${first}-removed-first`,passed:true});console.log(`Legacy ${first} first passed`);}
assert.ok(fs.readFileSync(inputExe).equals(exe));assert.ok(fs.readFileSync(path.join(live,files.map)).equals(map));assert.ok(fs.readFileSync(path.join(live,files.start)).equals(start));
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({knownCombinations:16,sourceUntouched:true,results},null,2));console.log('REPORT '+path.join(output,'results.json'));
