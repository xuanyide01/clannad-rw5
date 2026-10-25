const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),source=n=>fs.readFileSync(path.join(root,'src/common',n+'.js'),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/export /g,'');
const api=new Function(['catalog','auto-reader','text-font','portrait-layout','progress','engine','saves','gallery','assets'].map(source).join('\n')+';return {titleBackground,autoSpeeds,autoWait,checkpoint,portraitBox,PROGRESS_KEY,emptyProgress,decodeProgress,progressFromState,withProgress,lightCount,afterUnlocked,textFont,catalog,newState,restore,readFrame,readChapterSkip,next,nextChapter,choose,previous,previewMap,SLOT_COUNT,LEGACY_KEY,slotKey,decodeSave,createSave,slotRow,imagePath,groupGallery,stepVariant};')();
const pageSource=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8').split('<script>')[1].split('</script>')[0].replace(/^import[^\n]*\n/gm,'').replace('export default','globalThis.page=');
function model(settings={}){
 let now=0,id=0;const timers=new Map(),saved=new Map([['clannad_rw5_settings_v1',JSON.stringify({soundEnabled:false,...settings})]]),messages=[];
 class ClockDate extends Date{static now(){return now;}}
 const context=vm.createContext({...api,Date:ClockDate,audio:{play(){},stop(){}},
  setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:now+Number(ms||0)});return key;},clearTimeout(key){timers.delete(key);},
  file:{readText(o){context.setTimeout(()=>o.success({text:fs.readFileSync(path.join(root,'src',o.uri),'utf8')}),2);}},
  storage:{get(o){o.success(saved.get(o.key)||'');},set(o){saved.set(o.key,o.value);if(o.success)o.success();}},
  prompt:{showToast(){}},console:{log:(...args)=>messages.push(args.join(' ')),error(){}}});
 const music=fs.readFileSync(path.join(root,'src/common/title-music.js'),'utf8').replace(/export /g,'');
 vm.runInContext(music+'\n'+pageSource,context);const p=context.page;Object.assign(p,JSON.parse(JSON.stringify(p.private)));p.$element=()=>({scrollTo(){}});p.onInit();
 function tick(ms){const end=now+ms;let n=0;while(true){const e=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!e)break;assert(++n<20000,'timer loop');now=e[1].at;timers.delete(e[0]);e[1].fn();}now=end;}
 function start(){p.textSpeed=0;p.startNew();tick(20);assert.equal(p.mode,'play');assert.equal(p.displayText,p.fullText);}
 function enable(){p.showMenu();p.toggleAuto();p.resume();assert.equal(p.autoEnabled,true);}
 const position=()=>p.session.chapter+':'+p.session.cursor;
 return {p,tick,timers,saved,messages,start,enable,position};
}

test('three automatic speeds wait after the final glyph and cap long-paragraph extension',()=>{
 assert.equal(api.autoWait(0,20),2600);assert.equal(api.autoWait(1,20),1500);assert.equal(api.autoWait(2,20),800);assert.equal(api.autoWait(1,61),1555);assert.equal(api.autoWait(1,10000),6500);
});
test('boot defaults automatic reading off; only speed is saved with old settings compatible',()=>{
 const m=model({fontSize:28,textSpeed:0,autoSpeed:2,autoEnabled:true});assert.equal(m.p.autoEnabled,false);assert.equal(m.p.autoSpeed,2);m.start();m.p.showMenu();m.p.cycleAutoSpeed();const value=JSON.parse(m.saved.get('clannad_rw5_settings_v1'));assert.equal(value.autoSpeed,0);assert.equal(value.textSpeed,0);assert.ok(!('autoEnabled' in value));assert.equal(model({}).p.autoSpeed,1);
});
test('automatic display uses 30ms glyphs without changing manual display speed',()=>{
 const m=model(),p=m.p;m.start();m.enable();const before=m.position();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);const current=m.position();assert.equal(p.textSpeed,0);assert.ok(p.displayText.length<p.fullText.length);
 const remaining=(p.fullText.length-p.displayText.length)*30;m.tick(remaining-1);assert.equal(m.position(),current);assert.ok(p.displayText.length<p.fullText.length);m.tick(1);assert.equal(p.displayText,p.fullText);m.tick(api.autoWait(p.autoSpeed,p.fullText.length)-1);assert.equal(m.position(),current);m.tick(1);assert.notEqual(m.position(),current);
});
test('manually completing a typing line starts a fresh reading wait',()=>{
 const m=model();m.start();m.enable();m.tick(1500);const current=m.position();m.p.advance();assert.equal(m.p.displayText,m.p.fullText);m.tick(api.autoWait(m.p.autoSpeed,m.p.fullText.length)-1);assert.equal(m.position(),current);m.tick(1);assert.notEqual(m.position(),current);
});
test('menus and 30-slot selectors pause automatic reading and resume with a fresh wait',()=>{
 const m=model(),p=m.p;m.start();m.enable();const before=m.position();m.tick(500);p.showMenu();m.tick(60000);assert.equal(m.position(),before);p.openSlots('load');m.tick(10000);assert.equal(p.mode,'slots');assert.equal(p._slotData.length,30);assert.equal(m.position(),before);p.closeSlots();p.resume();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('actual original choice requires manual selection and then automatic reading continues',()=>{
 const m=model(),p=m.p;m.start();p.clearTyping();p.autoEnabled=true;p.session=api.newState(7500);p.session.cursor=314;p.cachedChapter=0;p.renderFrame();m.tick(20);assert.equal(p.mode,'choice');const before=JSON.stringify(p.session);m.tick(60000);assert.equal(JSON.stringify(p.session),before);assert.equal(p.autoEnabled,true);p.pick(0);m.tick(20);assert.equal(p.mode,'play');m.tick(p.fullText.length*30+api.autoWait(p.autoSpeed,p.fullText.length)+30);assert.ok(m.messages.some(x=>x.startsWith('CLANNAD_RW5 auto advance')));
});
test('touch and scrolling pause automatic reading without treating a drag as a tap',()=>{
 const m=model(),p=m.p;m.start();m.enable();const before=m.position();p.dialogueTouchStart({touches:[{clientX:250,clientY:420}]});m.tick(60000);assert.equal(m.position(),before);p.dialogueTouchMove({touches:[{clientX:250,clientY:350}]});p.dialogueTouchEnd();p.dialogueTap();assert.equal(m.position(),before);m.tick(500);p.dialogueScrolled();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('background suspension and return restart the automatic reading delay',()=>{
 const m=model();m.start();m.enable();const before=m.position();m.tick(400);m.p.onHide();m.tick(60000);assert.equal(m.position(),before);m.p.onShow();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('previous line, title, error, ending and destruction stop automatic callbacks',()=>{
 for(const action of ['goBack','toTitle','fail','onDestroy','ending']){
  const m=model(),p=m.p;m.start();m.enable();if(action==='ending'){p.session.cursor=api.catalog.scenes[String(p.session.chapter)].length;p.session.stack=[];p.renderFrame();m.tick(20);assert.equal(p.mode,'end');}else p[action]('test');
  const before=m.position();m.tick(60000);assert.equal(p.autoEnabled,false,action);assert.equal(m.position(),before,action);assert.equal(m.timers.size,0,action);
 }
});
test('late cancelled callbacks cannot consume a newer automatic timer or advance a changed frame',()=>{
 const m=model();m.start();m.enable();const old=m.timers.get(m.p._autoTimer).fn,before=m.position();m.p.showMenu();m.p.resume();const current=m.p._autoTimer;old();assert.equal(m.position(),before);assert.equal(m.p._autoTimer,current);m.p.loading=true;m.tick(2000);assert.equal(m.position(),before);
});
