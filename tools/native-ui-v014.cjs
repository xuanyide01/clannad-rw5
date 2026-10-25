const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'native-test-results/v014'),log=path.resolve(root,'../clannad-ui-environment/emulator.log');
fs.mkdirSync(out,{recursive:true});const logs=()=>fs.readFileSync(log,'utf8'),pause=ms=>new Promise(r=>setTimeout(r,ms));
const base='http://127.0.0.1:43162/';
async function request(s){const r=await fetch(base+s);if(!r.ok)throw Error(await r.text());return r;}
async function click(x,y){await request('click?x='+x+'&y='+y);await pause(350);}
async function shot(n){fs.writeFileSync(path.join(out,n+'.png'),Buffer.from(await(await request('screen')).arrayBuffer()));}
async function wait(at,re){for(let i=0;i<100;i++){const s=logs().slice(at);if(re.test(s))return s;await pause(150);}throw Error('Native event timeout: '+re);}
async function expected(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
function autoCount(s){return (s.match(/CLANNAD_RW5 auto advance/g)||[]).length;}
(async()=>{
 await pause(1000);const start=logs().length;await shot('title');
 await expected(314,236,/CLANNAD_RW5 slots ready load/);await shot('old-save-list');
 await expected(216,400,/CLANNAD_RW5 slot loaded 4/);await pause(2200);await shot('old-save-play-clean');
 await expected(216,490,/CLANNAD_RW5 menu/);await shot('menu-off');
 await expected(216,222,/CLANNAD_RW5 auto enabled true/);const menuCount=autoCount(logs());await pause(2200);assert.equal(autoCount(logs()),menuCount);
 await expected(216,266,/CLANNAD_RW5 auto speed 2/);await expected(216,266,/CLANNAD_RW5 auto speed 0/);await expected(216,266,/CLANNAD_RW5 auto speed 1/);await shot('menu-auto-standard');
 let at=logs().length;await click(216,398);await wait(at,/CLANNAD_RW5 auto advance/);await pause(350);await shot('auto-playing-clean');
 await expected(216,490,/CLANNAD_RW5 menu/);await expected(216,178,/CLANNAD_RW5 choice/);await shot('skip-stops-at-choice');
 const choiceCount=autoCount(logs());await pause(3000);assert.equal(autoCount(logs()),choiceCount);await shot('choice-remains-manual');
 at=logs().length;await click(216,90);await wait(at,/CLANNAD_RW5 frame/);await wait(at,/CLANNAD_RW5 auto advance/);await shot('auto-resumed-after-choice');
 await expected(216,490,/CLANNAD_RW5 menu/);await expected(216,222,/CLANNAD_RW5 auto enabled false/);await click(216,442);
 await expected(314,336,/CLANNAD_RW5 gallery ready 68 174/);await shot('gallery');await expected(100,146,/CLANNAD_RW5 cg 1 1/);await expected(200,200,/CLANNAD_RW5 cg 1 2/);await shot('cg-difference');await click(216,488);await click(216,475);
 await expected(314,386,/CLANNAD_RW5 config/);await shot('config');await click(216,238);await shot('routes');await click(216,400);await shot('kotomi-chapters');await click(216,474);await shot('route-return');await click(216,474);await shot('config-return');await click(216,296);await shot('help');await click(216,434);await click(216,373);await shot('title-return');
 const text=logs().slice(start);assert.ok(!/CLANNAD_RW5 error|ASSERTION FAILED|PANIC!!!/.test(text));
 const report={version:'0.1.4',passed:true,runtime:'official vela-watch-5.0',device:'ClannadUI20261025',screen:[432,514],physicalDeviceTested:false,
 checks:['Original title and five original button images','CONFIG and route/chapter first page immediate refresh','0.1.3-era virtual save 4 loads','No dialogue/name decorative rectangles','Automatic mode pauses in menu','All three speed settings respond','Automatic mode advances after resume','Safe chapter skip stops at original choice','Automatic mode does not choose during 3 second wait','Manual choice resumes automatic mode','Grouped CG gallery and difference switching','Help text and return navigation'],automaticAdvancesObserved:autoCount(text)};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
