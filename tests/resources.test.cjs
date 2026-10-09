const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const assetsSource=fs.readFileSync(path.join(root,'src/common/assets.js'),'utf8');
const a=new Function(assetsSource.replace(/export /g,'')+';return {assets,imagePath};')();
const cat=JSON.parse(fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8').replace(/^export const catalog=/,'').trim().slice(0,-1));
test('every converted background, character and official CG variant has an existing packaged resource',()=>{
 let references=0;
 const image=name=>{assert.ok(a.assets[name],name);assert.ok(fs.existsSync(path.join(root,'src/common/images',a.assets[name])),name);references++;};
 for(const id of Object.keys(cat.scenes)){
  const ops=JSON.parse(fs.readFileSync(path.join(root,'converted-story',id+'.json'),'utf8'));
  for(const op of ops){if(op.image)image(op.image);if(op.images)op.images.forEach(image);}
  const dir=path.join(root,'src/common/story',id),blocks=fs.readdirSync(dir).filter(x=>x.endsWith('.txt')).sort((a,b)=>Number(a.split('.')[0])-Number(b.split('.')[0]));
  assert.equal(blocks.length,Math.ceil(ops.length/512));assert.deepEqual(blocks.flatMap(x=>JSON.parse(fs.readFileSync(path.join(dir,x),'utf8'))),ops);
 }
 const items=JSON.parse(fs.readFileSync(path.join(root,'src/common/gallery.txt'),'utf8'));
 assert.equal(items.length,174);assert.equal(new Set(items.map(x=>x.image)).size,174);assert.equal(new Set(items.map(x=>x.group)).size,68);items.forEach(x=>image(x.image));
 assert.ok(references>1000);
 const mf=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8'));assert.equal(mf.name,'CLANNAD');assert.equal(mf.package,'com.codex.clannad.rw5');
 const logo=fs.readFileSync(path.join(root,'src/common/logo.png'));assert.equal(logo.readUInt32BE(16),192);assert.equal(logo.readUInt32BE(20),192);
});
test('all 30 independent save slots retain original variables, return stack and branches',()=>{
 const catSource=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8').replace('export const','const');
 const engine=fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace(/^import .*;\s*$/mg,'').replace(/export /g,'');
 const saves=fs.readFileSync(path.join(root,'src/common/saves.js'),'utf8').replace(/^import .*;\s*$/mg,'').replace(/export /g,'');
 const extra=fs.readFileSync(path.join(root,'src/common/text-font.js'),'utf8').replace(/export /g,'');
 const e=new Function(catSource+extra+engine+saves+';return {newState,slotKey,createSave,decodeSave,slotRow};')(),map=new Map();
 for(let i=0;i<30;i++){const s=e.newState(cat.chapters[i].id);s.variables['f:1089']=i;s.stack=[[414,i]];s.choices=[i%3];map.set(e.slotKey(i),JSON.stringify(e.createSave(s,'play',1000+i)));}
 assert.equal(map.size,30);
 for(let i=0;i<30;i++){const v=e.decodeSave(map.get(e.slotKey(i)));assert.equal(v.state.variables['f:1089'],i);assert.deepEqual(v.state.stack,[[414,i]]);assert.deepEqual(v.state.choices,[i%3]);assert.ok(e.slotRow(i,v).occupied);}
});
