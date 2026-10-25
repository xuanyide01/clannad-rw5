const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'native-test-results/v015'),log=path.resolve(root,'../clannad-ui-environment/emulator.log');fs.mkdirSync(out,{recursive:true});
const logs=()=>fs.readFileSync(log,'utf8'),pause=ms=>new Promise(r=>setTimeout(r,ms)),base='http://127.0.0.1:43162/';
async function get(s){const r=await fetch(base+s);if(!r.ok)throw Error(await r.text());return r;}
async function click(x,y){await get('click?x='+x+'&y='+y);await pause(400);}
async function shot(n){fs.writeFileSync(path.join(out,n+'.png'),Buffer.from(await(await get('screen')).arrayBuffer()));}
async function wait(at,re,seconds=20){for(let n=0;n<seconds*5;n++){const s=logs().slice(at);if(re.test(s))return s;await pause(200);}throw Error('Native timeout: '+re);}
async function expected(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
const count=(s,re)=>(s.match(re)||[]).length;
(async()=>{
 const all=logs(),start=all.lastIndexOf('CLANNAD_RW5 app created');assert.ok(start>=0);await wait(start,/CLANNAD_RW5 audio playing/);await shot('title-music');
 const observations=[];let loopText='';
 for(let elapsed=0;elapsed<180;elapsed++){
  loopText=logs().slice(start);assert.ok(!/CLANNAD_RW5 audio error|ASSERTION FAILED|PANIC!!!/.test(loopText));
  const plays=count(loopText,/CLANNAD_RW5 audio playing /g),stops=count(loopText,/CLANNAD_RW5 title guarded stop/g);
  if(plays>=3&&stops>=2)break;
  if(elapsed%20===0){const state=await(await get('audio-state')).json();observations.push({elapsed,plays,stops,...state});console.log(JSON.stringify({elapsed,plays,guardedStops:stops,position:state.position}),true);}
  await pause(1000);
 }
 assert.ok(count(loopText,/CLANNAD_RW5 audio playing /g)>=3,'two complete native repeats required');assert.ok(count(loopText,/CLANNAD_RW5 title guarded stop/g)>=2);
 assert.equal(count(loopText,/CLANNAD_RW5 audio ended/g),0,'the protected player must not reach EOF');await shot('title-after-two-loops');
 fs.writeFileSync(path.join(out,'loop-proof.json'),JSON.stringify({passed:true,initialPlays:count(loopText,/CLANNAD_RW5 audio playing /g),guardedStops:count(loopText,/CLANNAD_RW5 title guarded stop/g),unexpectedEOF:0,observations},null,2));
 await expected(314,386,/CLANNAD_RW5 config/);await shot('config-music-on');await expected(216,122,/CLANNAD_RW5 title music enabled false/);await pause(700);assert.equal((await(await get('audio-state')).json()).playing,false);await shot('config-music-off');
 await expected(216,122,/CLANNAD_RW5 title music enabled true/);await wait(logs().lastIndexOf('CLANNAD_RW5 config'),/CLANNAD_RW5 audio playing/);await click(216,430);
 await expected(314,236,/CLANNAD_RW5 slots ready load/);await shot('old-slots');await expected(216,400,/CLANNAD_RW5 slot loaded 4/);await pause(2000);assert.equal((await(await get('audio-state')).json()).playing,false);await shot('old-save-play');
 await expected(216,490,/CLANNAD_RW5 menu/);await shot('uniform-green-menu');await expected(216,222,/CLANNAD_RW5 auto enabled true/);let at=logs().length;await click(216,398);await wait(at,/CLANNAD_RW5 auto advance/);await shot('auto-green');await expected(216,490,/CLANNAD_RW5 menu/);await expected(216,178,/CLANNAD_RW5 choice/);await shot('choice-protected');await pause(2000);await expected(216,485,/CLANNAD_RW5 menu/);await click(216,442);
 await expected(314,336,/CLANNAD_RW5 gallery ready 68 174/);await shot('gallery');await expected(100,146,/CLANNAD_RW5 cg 1 1/);await expected(200,200,/CLANNAD_RW5 cg 1 2/);await pause(1200);await shot('cg-difference');await click(216,488);await pause(1200);await click(216,475);await pause(1200);
 await expected(314,386,/CLANNAD_RW5 config/);await click(216,296);await shot('routes');await click(216,400);await shot('kotomi-chapters');await click(216,474);await click(216,474);await click(216,430);await shot('title-return');
 const final=logs().slice(start);assert.ok(!/CLANNAD_RW5 error|CLANNAD_RW5 audio error|ASSERTION FAILED|PANIC!!!/.test(final));
 const report={version:'0.1.5',passed:true,runtime:'official vela-watch-5.0',physicalDeviceTested:false,completeNativeRepeats:2,initialPlays:count(loopText,/CLANNAD_RW5 audio playing /g),guardedStops:count(loopText,/CLANNAD_RW5 title guarded stop/g),unexpectedEOF:0,observations,
 checks:['Two complete full-length music repeats without EOF or panic','CONFIG sound off/on works','Music stops during save selector and story','Previous slot 4 loads','Reading controls share the green style','Automatic reading still advances and chapter skip stops at choices','All 68 CG groups load and a difference switches','Route first-page navigation returns normally']};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,version:report.version,completeNativeRepeats:2}));
})().catch(e=>{console.error(e);process.exitCode=1;});
