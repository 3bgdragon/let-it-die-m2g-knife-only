'use strict';
const fs=require('node:fs'),path=require('node:path');
function resolve(input,files){
 let value=String(input||'').trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
 if(!value)return null;const entered=path.resolve(value),candidates=[entered];
 if(path.basename(entered).toLowerCase()==='brggame-steam.exe')candidates.push(path.resolve(path.dirname(entered),'..','..'));
 for(const root of candidates){try{if(files.every(f=>fs.statSync(path.join(root,f)).isFile()))return root;}catch{/* Try the next candidate. */}}
 return null;
}
async function choose({input,detect,files,ask,interactive,t}){
 let found=resolve(input,files);
 if(found)return found;
 if(!input&&detect){try{found=resolve(detect(),files);}catch{/* Offer manual selection. */}if(found)return found;}
 if(!interactive)throw Error(t('게임 설치 파일을 찾지 못했습니다. --game으로 설치 폴더 또는 EXE 경로를 지정하세요.','Game files not found. Use --game with the installation folder or EXE path.'));
 for(;;){const answer=await ask(t('게임 설치 폴더 또는 BrgGame-Steam.exe 경로 (Enter=취소): ','Installation folder or BrgGame-Steam.exe path (Enter=cancel): '));
  if(!String(answer||'').trim())throw Error(t('경로 선택을 취소했습니다.','Path selection cancelled.'));
  found=resolve(answer,files);if(found)return found;
  console.log(t('필수 게임 파일을 찾지 못했습니다. 경로를 다시 입력하세요.','Required game files not found. Please enter the path again.'));
 }
}
module.exports={resolve,choose};
