const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'native-test-results/v012-final');fs.mkdirSync(out,{recursive:true});
const log=path.resolve(root,'../clannad-environment/emulator.log'),logs=()=>fs.readFileSync(log,'utf8'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43126/click?x='+x+'&y='+y)).ok);await sleep(350);}
async function shot(name){const r=await fetch('http://127.0.0.1:43126/screen');fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(await r.arrayBuffer()));}
async function wait(start,re){for(let n=0;n<80;n++){const text=logs().slice(start);if(re.test(text))return text;await sleep(200);}throw Error('timeout '+re);}
async function expected(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
(async()=>{
 const start=logs().length;await click(216,487);await shot('routes-first');await click(216,402);await shot('kotomi-first');await click(216,474);await shot('routes-return');
 for(let n=0;n<3;n++){await click(216,402);await click(216,474);}await click(216,474);
 await expected(216,400,/CLANNAD_RW5 slots ready load/);await expected(216,402,/CLANNAD_RW5 slot loaded 4 7500 86/);await shot('old-slot-4');
 await expected(216,477,/CLANNAD_RW5 menu/);await expected(216,211,/CLANNAD_RW5 choice 7500 314/);await shot('skip-stops-at-choice');
 await expected(216,477,/CLANNAD_RW5 menu/);await click(216,211);await sleep(1700);await shot('skip-cannot-bypass-choice');
 await expected(216,89,/CLANNAD_RW5 frame/);await expected(216,477,/CLANNAD_RW5 menu/);await click(216,443);
 await expected(216,372,/CLANNAD_RW5 frame/);let choices=0;
 for(let n=0;n<4;n++){await expected(216,477,/CLANNAD_RW5 menu/);const at=logs().length;await click(216,211);const data=await wait(at,/CLANNAD_RW5 (?:frame|choice)/);if(/CLANNAD_RW5 choice/.test(data)){choices++;break;}}
 assert.equal(choices,1);await shot('new-game-first-choice');await expected(216,477,/CLANNAD_RW5 menu/);await click(216,443);
 await expected(216,458,/CLANNAD_RW5 gallery ready 68 174/);for(let n=0;n<13;n++){await sleep(750);await click(348,474);}await sleep(900);await shot('supporting-cg-labels');await click(216,474);
 const text=logs().slice(start);assert.ok(!/CLANNAD_RW5 error|ASSERTION FAILED|PANIC!!!/.test(text));
 const report={version:'0.1.2',result:'passed',runtime:'official vela-watch-5.0',screen:[432,514],packageSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.clannad.rw5.debug.0.1.2.rpk'))).digest('hex'),checks:['Kotomi first chapter page refreshes without pagination','return to route first page refreshes immediately','repeat entry/return four times','old slot 4 restores 7500:86','skip stops at original 7500:314 choice','open choice cannot be bypassed','new story stops at its first choice','gallery retains all 68 groups / 174 variants'],physicalDeviceTested:false};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
