// Samples normal route/section entry points; does not modify save slots.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),results=path.join(root,'native-test-results/v011'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');
const targets=JSON.parse(fs.readFileSync(path.join(root,'reports/portrait-targets-v011.json'),'utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43126/click?x='+x+'&y='+y)).ok);await sleep(300);}
async function expected(x,y,re){const n=logs().length;await click(x,y);for(let i=0;i<100;i++){const part=logs().slice(n);if(re.test(part))return part;await sleep(120);}throw Error('Timeout '+re);}
async function shot(name){await sleep(600);const r=await fetch('http://127.0.0.1:43126/screen');fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 const begin=logs().length,checks=[];
 for(const target of targets){
  await expected(216,477,/CLANNAD_RW5 menu/);await click(216,443);await click(216,487);
  for(let p=0;p<Math.floor(target.route/4);p++)await click(348,474);
  if(target.route===8)await shot('route-names');
  await click(216,126+(target.route%4)*92);for(let p=0;p<Math.floor(target.chapterIndex/4);p++)await click(348,474);
  let part=await expected(216,126+(target.chapterIndex%4)*92,/CLANNAD_RW5 frame/);
  for(let n=1;n<target.visibleFrames;n++)part=await expected(366,477,/CLANNAD_RW5 frame/);
  assert.match(part,new RegExp('CLANNAD_RW5 frame '+target.position.join(' ')));
  const file='portrait-route-'+target.route+'-'+target.bodies.length;await shot(file);checks.push({...target,file:file+'.png'});console.log('NATIVE_PORTRAIT',target.route,target.bodies.join(','));
 }
 assert.ok(!/CLANNAD_RW5 error|PANIC!!!|ASSERTION FAILED|callback count.*larger than 30/.test(logs().slice(begin)));
 const hash=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.clannad.rw5.debug.0.1.1.rpk'))).digest('hex');
 fs.writeFileSync(path.join(results,'portraits-report.json'),JSON.stringify({version:'0.1.1',packageSha256:hash,physicalDeviceTested:false,checks,result:'passed'},null,2));console.log('NATIVE_PORTRAITS_PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
