'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const input=require('../game-path'),files=['Binaries/Win64/BrgGame-Steam.exe','BrgGame/Content/masters.db'];
test('manual EXE or folder paths, retry, cancellation and noninteractive failure',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lid-manual-path-'));try{
 for(const name of files){const p=path.join(tmp,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'fixture');}
 const exe=path.join(tmp,files[0]),t=(_ko,en)=>en;
 assert.equal(input.resolve('"'+exe+'"',files),tmp);assert.equal(input.resolve(tmp,files),tmp);
 assert.equal(input.resolve(path.join(tmp,'missing'),files),null);
 const answers=['missing-game','"'+exe+'"'];let prompts=0;
 const game=await input.choose({input:'missing',files,ask:async()=>{prompts++;return answers.shift();},interactive:true,t});
 assert.equal(game,tmp);assert.equal(prompts,2);
 await assert.rejects(()=>input.choose({input:'missing',files,ask:async()=>'',interactive:true,t}),/cancelled/);
 await assert.rejects(()=>input.choose({input:'missing',files,interactive:false,t}),/--game/);
 assert.equal(await input.choose({files,detect:()=>tmp,interactive:false,t}),tmp);
 fs.unlinkSync(path.join(tmp,files[1]));assert.equal(input.resolve(exe,files),null);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
