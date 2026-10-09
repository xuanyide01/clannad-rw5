const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),results=path.join(root,'native-test-results/v011-final'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');fs.mkdirSync(results,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){const r=await fetch('http://127.0.0.1:43126/click?x='+x+'&y='+y);assert.ok(r.ok);await sleep(250);}
async function waitLog(start,re){for(let i=0;i<100;i++){const part=logs().slice(start);if(re.test(part))return part;await sleep(200);}throw new Error('Timeout '+re);}
async function expected(x,y,re){const b=logs().length;await click(x,y);return waitLog(b,re);}
async function shot(name){const r=await fetch('http://127.0.0.1:43126/screen');fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
async function menu(){await expected(216,477,/CLANNAD_RW5 menu/);}
async function slots(role){await expected(216,role==='save'?95:155,new RegExp('CLANNAD_RW5 slots ready '+role));}
async function chooseSlot(i,re){for(let p=0;p<Math.floor(i/4);p++)await click(348,474);return expected(216,126+(i%4)*92,re);}
(async()=>{
 const start=logs().length,report={version:'0.1.1',runtime:'official vela-watch-5.0',screen:[432,514],physicalDeviceTested:false,packageSha256:require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.clannad.rw5.debug.0.1.1.rpk'))).digest('hex')};
 if(process.argv.includes('--persist')){
  const prev=JSON.parse(fs.readFileSync(path.join(results,'slots-report.json'),'utf8'));
  const first=process.argv.includes('--resume-four')?3:29;
  if(first===3){await menu();await slots('load');}else await expected(216,400,/CLANNAD_RW5 slots ready load/);
  for(let i=first;i>=0;i--){
   if(i!==first){await menu();await slots('load');}
   await chooseSlot(i,new RegExp('CLANNAD_RW5 slot loaded '+(i+1)+' '+prev.positions[i].join(' ')));
   if(i===29)await shot('cold-load-slot-30');
  }
  const currentLogs=logs().slice(logs().lastIndexOf('CLANNAD_RW5 title ready'));
  for(let i=0;i<30;i++)assert.match(currentLogs,new RegExp('CLANNAD_RW5 slot loaded '+(i+1)+' '+prev.positions[i].join(' ')));
  report.coldBoot30Slots=true;report.positions=prev.positions;fs.writeFileSync(path.join(results,'persistence-report.json'),JSON.stringify(report,null,2));console.log('PERSIST_PASSED');return;
 }
 await shot('title');
 const oldGallery=/CLANNAD_RW5 gallery ready \d+ \d+/.exec(logs().slice(logs().lastIndexOf('CLANNAD_RW5 title ready')));let galleryLog;if(oldGallery){await click(216,447);galleryLog=oldGallery[0];}else galleryLog=await expected(216,447,/CLANNAD_RW5 gallery ready/);const match=/CLANNAD_RW5 gallery ready (\d+) (\d+)/.exec(galleryLog);assert.equal(Number(match[1]),68);assert.equal(Number(match[2]),174);report.gallery={groups:Number(match[1]),variants:174};await shot('gallery');
 await expected(114,170,/CLANNAD_RW5 cg 1 1 /);await shot('cg-variant-01');await expected(216,216,/CLANNAD_RW5 cg 1 2 /);await shot('cg-variant-02');await click(216,487);await click(216,474);
 await expected(216,360,/CLANNAD_RW5 frame/);await shot('opening');await menu();if(!process.argv.includes('--instant-existing'))await click(216,269);await click(216,385);
 const positions=[];
 for(let i=0;i<30;i++){
  if(i){const text=await expected(366,477,/CLANNAD_RW5 (frame|choice)/);if(/CLANNAD_RW5 choice/.test(text))await expected(216,89,/CLANNAD_RW5 frame/);}
  await menu();await slots('save');let saved=await chooseSlot(i,new RegExp('CLANNAD_RW5 (?:slot saved|overwrite) '+(i+1)+'(?:\\s|$)'));if(saved.includes('CLANNAD_RW5 overwrite'))saved=await expected(216,250,new RegExp('CLANNAD_RW5 slot saved '+(i+1)+' '));const m=new RegExp('CLANNAD_RW5 slot saved '+(i+1)+' (\\d+) (\\d+)').exec(saved);positions.push([Number(m[1]),Number(m[2])]);await sleep(1600);if(i%5===4)console.log('SLOTS_SAVED',i+1);
  if(i===29){await menu();await slots('load');for(let p=0;p<7;p++)await click(348,474);await shot('slots-29-30');await click(216,474);await click(216,385);}
 }
 assert.equal(new Set(positions.map(x=>x.join(':'))).size,30);
 for(let i=29;i>=0;i--){await menu();await slots('load');await chooseSlot(i,new RegExp('CLANNAD_RW5 slot loaded '+(i+1)+' '+positions[i].join(' ')));}
 await menu();await expected(216,211,/CLANNAD_RW5 (frame|map ready)/);await shot('chapter-skip');
 const data=logs().slice(start);assert.ok(!/CLANNAD_RW5 error|ASSERTION FAILED|PANIC!!!/.test(data));report.slots=30;report.positions=positions;report.result='passed';fs.writeFileSync(path.join(results,'slots-report.json'),JSON.stringify(report,null,2));console.log('CLANNAD_NATIVE_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
