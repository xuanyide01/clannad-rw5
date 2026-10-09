// Run after the 30-slot load test, while on a normal play frame.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),results=path.join(root,'native-test-results'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');
const targets=JSON.parse(fs.readFileSync(path.join(root,'reports/font-targets.json'),'utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43126/click?x='+x+'&y='+y)).ok);await sleep(300);}
async function expected(x,y,re){const begin=logs().length;await click(x,y);for(let i=0;i<100;i++){const text=logs().slice(begin);if(re.test(text))return text;await sleep(120);}throw Error('Timeout '+re);}
async function shot(name){await sleep(600);const r=await fetch('http://127.0.0.1:43126/screen');fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 const begin=logs().length;
 await expected(216,477,/CLANNAD_RW5 menu/);await click(216,443);await click(216,482);await click(348,474);await click(348,474);await shot('font-route-kappei');await click(348,474);await shot('font-route-yusuke');
 await click(80,474);await click(80,474); // route page 2
 const target=targets.find(x=>x.route===4);assert.ok(target);await click(216,126);
 for(let p=0;p<Math.floor(target.chapterIndex/4);p++)await click(348,474);
 let part=await expected(216,126+(target.chapterIndex%4)*92,/CLANNAD_RW5 frame/);
 for(let n=1;n<target.visibleFrames;n++)part=await expected(366,477,/CLANNAD_RW5 frame/);
 assert.match(part,new RegExp('CLANNAD_RW5 frame '+target.position.join(' ')));await shot('font-dialogue-yusuke');
 await expected(216,477,/CLANNAD_RW5 menu/);await click(216,327);await click(216,385);await shot('font-dialogue-large');
 await expected(216,477,/CLANNAD_RW5 menu/);await click(216,327);await click(216,385);
 assert.ok(!/CLANNAD_RW5 error|PANIC!!!|ASSERTION FAILED|callback count.*larger than 30/.test(logs().slice(begin)));
 fs.writeFileSync(path.join(results,'font-report.json'),JSON.stringify({version:'0.1.0',packageSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.clannad.rw5.debug.0.1.0.rpk'))).digest('hex'),physicalDeviceTested:false,target,sizes:[24,28],result:'passed'},null,2));console.log('NATIVE_FONT_PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
