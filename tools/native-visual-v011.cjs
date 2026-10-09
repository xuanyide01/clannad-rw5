const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),results=path.join(root,'native-test-results/v011'),log=path.join(process.env.STARRY_EMULATOR_HOME,'emulator.log');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43126/click?x='+x+'&y='+y)).ok);await sleep(300);}
async function expected(x,y,re){const begin=logs().length;await click(x,y);for(let i=0;i<100;i++){const part=logs().slice(begin);if(re.test(part))return part;await sleep(120);}throw Error('Timeout '+re);}
async function shot(name){await sleep(700);const r=await fetch('http://127.0.0.1:43126/screen');fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 const begin=logs().length;
 if(!process.argv.includes('--title')){await expected(216,477,/CLANNAD_RW5 menu/);await click(216,443);}await shot('title');
 await click(216,429);assert.ok(!/CLANNAD_RW5 frame/.test(logs().slice(begin)));await shot('after-locked');await sleep(1900);
 await expected(216,458,/CLANNAD_RW5 gallery ready 68 174/);await shot('gallery');
 await expected(114,170,/CLANNAD_RW5 cg 1 1 /);await shot('cg-01');await expected(216,216,/CLANNAD_RW5 cg 1 2 /);await shot('cg-02');
 await click(216,487);await click(216,474);await expected(216,372,/CLANNAD_RW5 frame/);await shot('opening');
 assert.ok(!/CLANNAD_RW5 error|PANIC!!!|ASSERTION FAILED|callback count.*larger than 30/.test(logs().slice(begin)));
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.clannad.rw5.debug.0.1.1.rpk'))).digest('hex');
 fs.writeFileSync(path.join(results,'visual-report.json'),JSON.stringify({version:'0.1.1',packageSha256:hash,physicalDeviceTested:false,title:'original STT_BG10 with Ushio',gallery:{groups:68,images:174,differencesSwitch:true},lockedAfterStoryDoesNotStart:true,result:'passed'},null,2));
 console.log('NATIVE_VISUAL_PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
