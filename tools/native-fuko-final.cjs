const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),results=path.join(root,'native-test-results/v011-final'),log=path.join(process.env.STARRY_EMULATOR_HOME,'emulator.log');
const {api,ops}=require('../tests/support/guide-paths.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43126/click?x='+x+'&y='+y)).ok);await sleep(60);}
async function expected(x,y,re){const begin=logs().length;await click(x,y);for(let i=0;i<150;i++){const part=logs().slice(begin);if(re.test(part))return part;await sleep(40);}throw Error('Timeout '+re);}
async function shot(name){await sleep(600);const r=await fetch('http://127.0.0.1:43126/screen');fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 const begin=logs().length,s=api.newState(1003);let selection;
 for(let n=0;n<500;n++){const f=api.readFrame(ops(s.chapter),s);if(f.type==='jump'||f.type==='yield')continue;if(f.type==='choice'){if(ops(s.chapter)[s.cursor].op==='dynamicChoice'){selection=f;break;}api.choose(s,f.items[0],0);continue;}if(f.type==='end')throw Error('No prank menu');api.next(s);}
 assert.equal(selection.items.length,3);api.choose(s,selection.items[1],1);let text;
 for(let n=0;n<100;n++){const f=api.readFrame(ops(s.chapter),s);if(f.type==='text'){text=f.text;break;}assert.ok(['jump','yield'].includes(f.type));}
 if(process.argv.includes('--end'))await click(216,393);else{await expected(216,477,/CLANNAD_RW5 menu/);await click(216,443);}await click(216,487);await click(348,474);await click(216,126);
 let part=await expected(216,310,/CLANNAD_RW5 (frame|choice)/);
 for(let n=0;n<150&&!/CLANNAD_RW5 choice 1003 38/.test(part);n++)part=await expected(/CLANNAD_RW5 choice/.test(part)?216:366,/CLANNAD_RW5 choice/.test(part)?90:477,/CLANNAD_RW5 (frame|choice)/);
 assert.match(part,/CLANNAD_RW5 choice 1003 38/);await shot('fuko-dynamic-choice');
 await expected(216,166,new RegExp('CLANNAD_RW5 frame '+s.chapter+' '+s.cursor));await shot('fuko-choice-result');
 assert.ok(!/CLANNAD_RW5 error|PANIC!!!|ASSERTION FAILED|callback count.*larger than 30/.test(logs().slice(begin)));
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.clannad.rw5.debug.0.1.1.rpk'))).digest('hex');
 fs.writeFileSync(path.join(results,'fuko-report.json'),JSON.stringify({version:'0.1.1',packageSha256:hash,physicalDeviceTested:false,options:selection.items.map(x=>x.text),selectedIndex:1,expectedNextFrame:[s.chapter,s.cursor],expectedText:text,result:'passed'},null,2));console.log('NATIVE_FUKO_PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
