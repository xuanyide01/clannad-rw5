const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),common=path.join(root,'src/common');
const source=name=>fs.readFileSync(path.join(common,name+'.js'),'utf8').replace(/export /g,'');
const api=new Function(source('progress')+source('portrait-layout')+';return {titleBackground,trueEndingSeen,emptyProgress,decodeProgress,progressFromState,withProgress,afterUnlocked,lightCount,portraitBox};')();
test('all 384 single and multiple portrait image boxes meet the dialogue boundary',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'reports/portrait-layout.json'),'utf8'));
 for(const [file,size] of Object.entries(report.dimensions))for(const count of [1,2,3])for(let i=0;i<count;i++){
  const box=api.portraitBox('/common/images/'+file,count,i);assert.equal(box.top+box.height,286);assert.ok(box.top>=0&&box.left>=0&&box.left+box.width<=432);assert.ok(Math.abs(box.width/box.height-size[0]/size[1])<0.014);
 }
});
test('cross-playthrough records include g flags and exclude local romance/choice variables',()=>{
 const p=api.progressFromState({variables:{'g:0':2,'g:13':1,'f:1089':1,'z:99':4}});assert.deepEqual(Object.keys(p.variables),['g:0','g:13']);
 const loaded=api.decodeProgress(JSON.stringify(p)),next=api.withProgress({variables:{}},loaded);assert.equal(next.variables['g:13'],1);assert.equal(api.lightCount(loaded),2);assert.equal(next.variables['f:1089'],undefined);
});
test('After Story matches all original twelve flags, not total-orb shortcuts',()=>{
 const p=api.emptyProgress();p.variables['g:0']=13;assert.equal(api.afterUnlocked(p),false);
 const flags=[1,2,3,4,5,6,9,12,13,15,30,31];flags.forEach(n=>p.variables['g:'+n]=1);assert.equal(api.afterUnlocked(p),true);
 for(const n of flags){p.variables['g:'+n]=0;assert.equal(api.afterUnlocked(p),false,'g:'+n);p.variables['g:'+n]=1;}
});

test('Ushio title requires original true-end flag 45, not lights or After Story unlock',()=>{
 const p=api.emptyProgress();assert.equal(api.titleBackground(p),'/common/ui/title-before.jpg');p.variables['g:0']=13;p.variables['g:1007']=3;
 [1,2,3,4,5,6,9,12,13,15,30,31].forEach(n=>p.variables['g:'+n]=1);assert.equal(api.afterUnlocked(p),true);assert.equal(api.trueEndingSeen(p),false);
 p.variables['g:45']=1;const saved=api.decodeProgress(JSON.stringify(p));assert.equal(api.titleBackground(saved),'/common/ui/title.jpg');
 const restored=api.withProgress({variables:{'g:45':0}},saved);assert.equal(restored.variables['g:45'],1);
});
