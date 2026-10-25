const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=n=>fs.readFileSync(path.join(root,'src/common',n+'.js'),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/export /g,'');
function clock(){let now=0,id=0;const timers=new Map();return {timers,setTimeout(fn,delay){const n=++id;timers.set(n,{fn,at:now+delay});return n;},clearTimeout(n){timers.delete(n);},tick(ms){const end=now+ms;let n=0;while(true){const e=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!e)break;assert(++n<10000);now=e[1].at;timers.delete(e[0]);e[1].fn();}now=end;}};}
function player(){const c=clock(),events=[],audio={play(){events.push('play');if(this.onplay)this.onplay();},stop(){events.push('stop');if(this.onstop)this.onstop();}};
 Object.defineProperty(audio,'volume',{set(){throw Error('System volume must not change')}});
 const sandbox=vm.createContext({...c,audio,console:{log(){},error(){}}});vm.runInContext(source('title-music')+';globalThis.music=makeTitleMusic(audio);',sandbox);return {...c,audio,events,music:sandbox.music};}

test('full title track stops before EOF and restarts after a gap without native looping',()=>{
 const p=player();p.music.update(true);for(let i=0;i<10;i++)p.music.update(true);assert.deepEqual(p.events,['play']);assert.equal(p.audio.loop,false);assert.equal(p.audio.autoplay,false);
 p.tick(72926);assert.deepEqual(p.events,['play']);p.tick(1);assert.deepEqual(p.events,['play','stop']);p.tick(1199);assert.equal(p.events.length,2);p.tick(1);assert.deepEqual(p.events,['play','stop','play']);p.tick(72927+1200);assert.deepEqual(p.events,['play','stop','play','stop','play']);
});
test('leaving the title during playback or the restart gap cancels every later restart',()=>{
 for(const delay of [500,72927,73500]){const p=player();p.music.update(true);p.tick(delay);p.music.update(false);const before=p.events.length;p.tick(300000);assert.equal(p.events.length,before);assert.equal(p.timers.size,0);}
});
test('late timer and stop callbacks cannot clear or stop a newer playback generation',()=>{
 const p=player();p.music.update(true);const stale=[...p.timers.values()][0].fn;p.music.update(false);p.music.update(true);const current=[...p.timers.keys()][0];stale();assert.ok(p.timers.has(current));p.audio.onstop();assert.equal(p.events.filter(x=>x==='play').length,2);p.tick(72927);assert.equal(p.events.filter(x=>x==='stop').length,2);
});
test('audio errors and unexpected EOF fail closed until an explicit retry',()=>{
 for(const event of ['onerror','onended']){const p=player();p.music.update(true);p.audio[event]('test');p.tick(300000);assert.deepEqual(p.events,['play','stop']);p.music.update(true);assert.equal(p.events.length,2);p.music.retry();p.music.update(true);assert.equal(p.events.at(-1),'play');}
});
test('destruction releases the player, removes handlers and ignores late callbacks',()=>{
 const p=player();p.music.update(true);const stale=[...p.timers.values()][0].fn;p.music.destroy();stale();p.tick(300000);assert.deepEqual(p.events,['play','stop']);assert.equal(p.timers.size,0);for(const k of ['onplay','onstop','onpause','onended','onerror'])assert.equal(p.audio[k],null);
});
test('duplicate play notifications and focus loss do not create replay storms',()=>{
 const p=player();p.music.update(true);p.audio.onplay();p.audio.onplay();assert.equal(p.timers.size,1);p.audio.onpause();p.tick(300000);assert.deepEqual(p.events,['play','stop']);assert.equal(p.timers.size,0);
});

const api=new Function(['catalog','auto-reader','text-font','portrait-layout','progress','engine','saves','gallery','assets'].map(source).join('\n')+';return {titleBackground,autoSpeeds,autoWait,portraitBox,PROGRESS_KEY,emptyProgress,decodeProgress,progressFromState,withProgress,lightCount,afterUnlocked,textFont,catalog,newState,restore,readFrame,readChapterSkip,next,nextChapter,choose,previous,previewMap,SLOT_COUNT,LEGACY_KEY,slotKey,decodeSave,createSave,slotRow,imagePath,groupGallery,stepVariant};')();
function page(settings={}){
 const c=clock(),events=[],saved=new Map([['clannad_rw5_settings_v1',JSON.stringify(settings)]]),audio={play(){events.push('play');if(this.onplay)this.onplay();},stop(){events.push('stop');if(this.onstop)this.onstop();}};
 const sandbox=vm.createContext({...c,...api,audio,Date,console:{log(){},error(){}},prompt:{showToast(){}},file:{readText(o){o.success({text:fs.readFileSync(path.join(root,'src',o.uri),'utf8')});}},storage:{get(o){o.success(saved.get(o.key)||'');},set(o){saved.set(o.key,o.value);if(o.success)o.success();}}});
 const s=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8').split('<script>')[1].split('</script>')[0].replace(/^import[^\n]*\n/gm,'').replace('export default','globalThis.page=');
 vm.runInContext(source('title-music')+'\n'+s,sandbox);const p=sandbox.page;Object.assign(p,JSON.parse(JSON.stringify(p.private)));p.$element=()=>({scrollTo(){}});p.onInit();return {...c,p,events,saved};
}
test('actual page plays by default, retains the toggle and keeps manual reading settings',()=>{
 const m=page({textSpeed:0,autoSpeed:2});assert.deepEqual(m.events,[]);m.tick(1799);assert.deepEqual(m.events,[]);m.tick(1);assert.deepEqual(m.events,['play']);m.p.openConfig();assert.deepEqual(m.events,['play']);m.p.toggleMusic();assert.deepEqual(m.events,['play','stop']);const settings=JSON.parse(m.saved.get('clannad_rw5_settings_v1'));assert.equal(settings.soundEnabled,false);assert.equal(settings.textSpeed,0);assert.equal(settings.autoSpeed,2);assert.deepEqual(page(settings).events,[]);
});
test('actual page stops music for story, save selectors and background, and restores it at title',()=>{
 const m=page();m.tick(1800);m.p.startNew();assert.equal(m.events.at(-1),'stop');m.p.toTitle();m.tick(1800);assert.equal(m.events.at(-1),'play');m.p.onHide();const before=m.events.length;m.tick(300000);assert.equal(m.events.length,before);m.p.onShow();m.tick(1800);assert.equal(m.events.at(-1),'play');m.p.continueGame();assert.equal(m.events.at(-1),'stop');m.p.closeSlots();m.tick(1800);assert.equal(m.events.at(-1),'play');m.p.onDestroy();m.tick(0);assert.equal(m.timers.size,0);
});

test('leaving before delayed title startup cancels sound and stale startup callbacks',()=>{
 const m=page();const stale=[...m.timers.values()][0].fn;m.p.openRoutes();m.tick(3000);assert.deepEqual(m.events,[]);m.p.toTitle();const current=[...m.timers.keys()][0];stale();assert.ok(m.timers.has(current));m.tick(1800);assert.deepEqual(m.events,['play']);m.p.onDestroy();assert.equal(m.timers.size,0);
});
test('runtime controls use one green style and contain no blue bitmap buttons',()=>{
 const text=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8');assert.ok(!text.includes('/common/ui/button.png'));assert.ok(text.includes('background-color:#dceae2'));const menu=text.split("mode === 'menu'")[1].split('</div>')[0];assert.ok(menu.includes('class="menu-action reading-action" onclick="saveGame"'));assert.ok(menu.includes('class="menu-action reading-action" onclick="loadGame"'));
});
