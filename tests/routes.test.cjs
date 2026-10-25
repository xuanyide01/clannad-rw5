const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {api,run,cases,ops}=require('./support/guide-paths.cjs');
const root=path.resolve(__dirname,'..');

test('walkthrough paths from prologue earn school flags, unlock After Story and reach true end across saved playthroughs',()=>{
 let progress=api.emptyProgress();const results=[];
 function check(name){const r=run(name,api.decodeProgress(JSON.stringify(progress)));assert.equal(r.reached,true,name+' original clear flag');progress=api.decodeProgress(JSON.stringify(r.progress));results.push({route:name,finalScene:r.state.chapter,choices:r.trace.length,originalFlag:r.flag,lightCount:progress.variables['g:0']||0,restoredAfterEveryChoice:true});return r;}
 assert.equal(api.afterUnlocked(progress),false);
 for(const name of Object.keys(cases)){cases[name].reload=true;check(name);}
 assert.equal(api.afterUnlocked(progress),true);assert.equal(progress.variables['g:0'],7);
 cases.after={start:6800,flag:35,reload:true,choices:{'6800:5314':0,'6800:5647':1,'6800:6051':1,'6800:10549':1,'7100:837':1,'7100:1163':1,'6802:2716':0}};
 check('after');for(const n of [8,10,11,14,35])assert.equal(progress.variables['g:'+n],1);assert.equal(progress.variables['g:0'],12);
 cases.akio={start:6800,flag:7,reload:true,choices:{'6800:5314':1,'7200:448':0,'7200:586':0}};
 check('akio');assert.equal(progress.variables['g:0'],13);
 assert.notEqual(progress.variables['g:45'],1);cases.trueEnd={...cases.after,flag:45};const end=check('trueEnd');assert.equal(end.state.chapter,6803);assert.equal(progress.variables['g:45'],1);
 fs.writeFileSync(path.join(root,'reports/guide-validation.json'),JSON.stringify({source:'https://kazamatsuri.org/clannad-walkthrough/',edition:'user-supplied Steam Chinese SceneZH.pck',result:'passed',flagsGeneratedByPlaying:true,progressSavedAcrossPlaythroughs:true,chunkSize:512,paths:results},null,2)+'\n');
});

test('Ryou ending and Fuko alternate ending follow their original distinct choices',()=>{
 cases.ryou={...cases.kyou,flag:113};const r=run('ryou',api.emptyProgress(),{'3428:359':1,'3504:64':0});assert.equal(r.reached,true);assert.equal(r.progress.variables['g:4'],undefined);assert.equal(r.state.chapter,9999);
 cases.fukoB={...cases.fuko};const f=run('fukoB',api.emptyProgress(),{'1516:459':1});assert.equal(f.reached,true);assert.equal(f.trace.at(-1).text,'可以保持这样吗？');
});

test('Fuko dynamic prank menus preserve variable labels and original return indices across a save',()=>{
 const s=api.newState(1003,true);s.cursor=ops(1003).findIndex(x=>x.op==='dynamicChoice');s.variables['s:1011']='用鼻子喝饮料 Master';s.variables['s:1012']='丢到别的地方 Lv2';s.variables['s:1013']='替换聊天对象 Lv1';
 const f=api.readFrame(ops(1003),s);assert.equal(f.type,'choice');assert.deepEqual(f.items.map(x=>x.text),[s.variables['s:1011'],s.variables['s:1012'],s.variables['s:1013']]);
 api.choose(s,f.items[1],1);assert.equal(s.variables['f:1089'],1);const restored=api.restore(api.checkpoint(s));assert.equal(restored.variables['f:1089'],1);
});
