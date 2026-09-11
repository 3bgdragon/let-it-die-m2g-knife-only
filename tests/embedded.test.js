'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const embedded=require('../embedded'),data=require('../embedded-profiles.json');
test('embedded variants cover four guard combinations and both warp states',()=>{
 assert.equal(data.profiles.length,8);
 for(const g of ['off-off','off-on','on-off','on-on'])for(const w of [false,true]){
  const p=data.profiles.find(x=>x.guard===g&&x.warp===w);assert.ok(p);
  assert.match(p.sha256,/^[a-f0-9]{64}$/);assert.match(p.offSha256,/^[a-f0-9]{64}$/);
  assert.notEqual(p.sha256,p.offSha256);
 }
 assert.equal(embedded.identify(Buffer.from('unknown')),null);
 assert.throws(()=>embedded.set(Buffer.from('unknown'),false));
});

test('all embedded real packages: removal redirects only to original function and reapplies exactly',{
 skip:!process.env.LID_M2G_EMBEDDED_FIXTURES,
},()=>{
 const fs=require('node:fs'),path=require('node:path'),p=require('../package-patch');
 for(const profile of data.profiles){
  const input=fs.readFileSync(path.join(process.env.LID_M2G_EMBEDDED_FIXTURES,`guard-${profile.guard}${profile.warp?'-centered':''}.upk`));
  assert.equal(p.sha(input),profile.sha256);
  const off=embedded.set(input,false);assert.equal(p.sha(off),profile.offSha256);
  const table=p.entries(off),exp=p.readAt(off,table,p.EXPORT_SLOT+32,8).data;
  assert.equal(exp.readUInt32LE(),p.PLAY_SIZE);assert.equal(exp.readUInt32LE(4),p.PLAY_OFFSET);
  assert.ok(embedded.set(off,true).equals(input));
  assert.ok(embedded.set(off,false).equals(off));
 }
});
