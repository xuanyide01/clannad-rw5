const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const cat=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8').replace('export const','const');
const script=name=>fs.readFileSync(path.join(root,'src/common',name+'.js'),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/export /g,'');
const api=new Function(cat+['text-font','portrait-layout','progress','engine','saves','gallery','assets'].map(script).join('\n')+';return {checkpoint,portraitBox,PROGRESS_KEY,emptyProgress,decodeProgress,progressFromState,withProgress,lightCount,afterUnlocked,textFont,catalog,newState,restore,readFrame,readChapterSkip,next,nextChapter,choose,previous,previewMap,SLOT_COUNT,LEGACY_KEY,slotKey,decodeSave,createSave,slotRow,imagePath,groupGallery,stepVariant};')();
function page(progressFailure=false){const pending=[],timers=[];const source=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8').split('<script>')[1].split('</script>')[0].replace(/^import[^\n]*\n/gm,'').replace('export default','globalThis.page=');
 const writes=[];const context=vm.createContext({...api,file:{readText:o=>o.success({text:fs.readFileSync(path.join(root,'src',o.uri),'utf8')})},storage:{get:o=>pending.push(o),set:o=>writes.push(o)},prompt:{showToast(){}},console:{log(){},error(){}},Date,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}});
 vm.runInContext(source,context);const p=context.page;Object.assign(p,p.private);p.onInit();pending.shift().success('');const progress=pending.shift();if(progressFailure)progress.fail();else progress.success('');return {p,pending,timers,writes};
}
test('actual slot UI reads one slot at a time and keeps all 30 loaded previews',()=>{
 const {p,pending,timers}=page(),saved=JSON.stringify(api.createSave(api.newState(),'play',1));p.openSlots('load');assert.equal(p.loading,true);
 for(let i=0;i<30;i++){assert.equal(pending.length,1);const read=pending.shift();assert.equal(read.key,api.slotKey(i));read.success(i===7?'{}':saved);if(i<29){assert.equal(pending.length,0);assert.equal(timers.length,1);timers.shift()();}}
 assert.equal(p.loading,false);assert.equal(p._slotData.length,30);assert.equal(p._slotData[7].invalid,true);assert.equal(p.slotRows.length,4);
});
test('closing a loading slot list prevents any further reads and late callback updates',()=>{
 const {p,pending,timers}=page();p.openSlots('load');const first=pending.shift();p.closeSlots();first.success('');assert.equal(pending.length,0);assert.equal(timers.length,0);assert.equal(p.mode,'title');
});
test('actual Vela page loads the first Chinese frame and complete CG gallery using packaged TXT paths',()=>{
 const {p,timers}=page();p.textSpeed=0;p.startNew();for(let i=0;i<1000&&p.mode!=='play';i++){assert.ok(timers.length);timers.shift()();}assert.equal(p.mode,'play');assert.ok(/[\u4e00-\u9fff]/.test(p.fullText));p.toTitle();p.openGallery();assert.equal(p.loading,false);assert.equal(p._galleryCatalog.length,68);assert.equal(p._galleryTotal,174);
});
test('rare character names use the subset on complete UI strings, while ordinary text uses the system font',()=>{
 const {p}=page();assert.equal(api.textFont('芳野祐介'),'clannadextra');assert.equal(api.textFont('柊胜平'),'clannadextra');assert.equal(api.textFont('古河渚'),'sans-serif');
 p.openRoutes();p.browsePage=2;p.refreshBrowse();assert.equal(p.browseRows[3].name,'柊胜平');assert.equal(p.browseRows[3].font,'clannadextra');
 const options=p.visibleOptions([{text:'和芳野祐介交谈',target:12}]);assert.equal(options[0].font,'clannadextra');assert.equal(options[0].target,12);
 const s=api.newState(api.catalog.routes[14].scenes[0]);s.text='芳野祐介';const row=api.slotRow(0,api.createSave(s,'play',1));assert.equal(row.metaFont,'clannadextra');assert.equal(row.previewFont,'clannadextra');
});
test('actual page serializes progress writes and persists newer changes after a pending write',()=>{
 const {p,writes}=page();p.session=api.newState(414,true);p.session.variables['g:13']=1;p.syncProgress();assert.equal(writes.length,1);
 p.session.variables['g:0']=1;p.syncProgress();assert.equal(writes.length,1);writes.shift().success();assert.equal(writes.length,1);assert.equal(JSON.parse(writes[0].value).variables['g:0'],1);writes.shift().success();assert.equal(p._progressWriteBusy,false);
 p.session=api.newState(7500);p.session.variables['g:0']=13;p.syncProgress();assert.equal(p._progress.variables['g:0'],1);assert.equal(writes.length,0);
 p.toTitle();p.startNew();assert.equal(p.session.variables['g:13'],1);assert.equal(p.session.variables['g:0'],1);assert.equal(p.session.progression,'story');
});

test('failed progress read can be retried without starting a game or overwriting records',()=>{
 const {p,pending,writes}=page(true);assert.equal(p.mode,'error');p.startNew();assert.equal(p.session.progression,'chapter');assert.equal(writes.length,0);
 p.toTitle();assert.equal(p.loading,true);assert.equal(pending.length,1);pending.shift().success(JSON.stringify({version:1,variables:{'g:13':1,'g:0':2}}));assert.equal(p.loading,false);p.startNew();assert.equal(p.session.variables['g:0'],2);
});

test('previous dialogue preserves already earned persistent flags and orb count',()=>{
 const {p}=page();p.session=api.newState(414,true);api.next(p.session);p.session.variables['g:0']=2;p.session.variables['g:13']=1;p._progress=api.progressFromState(p.session);p.mode='play';p.textSpeed=0;
 p.goBack();assert.equal(p.session.variables['g:13'],1);assert.equal(p.session.variables['g:0'],2);
});

test('route and chapter first pages have different native recycler keys on entry and return',()=>{
 const {p}=page();p.openRoutes();const route=p.browseRows.map(x=>x.key),names=p.browseRows.map(x=>x.name);
 const kotomi=p._browseItems.findIndex(x=>x.name.includes('琴美'));assert.ok(kotomi<4);p.selectBrowse(kotomi);
 assert.equal(p.mode,'chapters');assert.ok(p.browseRows.every(x=>!route.includes(x.key)));assert.ok(p.browseRows.some(x=>!names.includes(x.name)));
 p.closeBrowse();assert.equal(p.mode,'routes');assert.deepEqual(p.browseRows.map(x=>x.key),route);assert.deepEqual(p.browseRows.map(x=>x.name),names);
});
test('actual menu skip stops at first selection and refuses to bypass an open choice',()=>{
 const {p,timers}=page();p.textSpeed=0;p.startNew();while(p.mode!=='play')timers.shift()();p.showMenu();p.goNextChapter();
 let calls=0;while(p._chapterSkip){assert.ok(++calls<1000);assert.ok(timers.length);timers.shift()();}
 assert.equal(p.session.progression,'story');assert.equal(p.loading,false);assert.ok(['play','choice'].includes(p.mode));
 while(p.mode!=='choice'){p.showMenu();p.goNextChapter();while(p._chapterSkip){assert.ok(++calls<3000);timers.shift()();}}
 const before=api.checkpoint(p.session);p.showMenu();p.goNextChapter();assert.equal(p.mode,'choice');assert.deepEqual(api.checkpoint(p.session),before);
});
