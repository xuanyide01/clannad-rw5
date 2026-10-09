// Integration policies checked against Kazamatsuri's original walkthrough and the supplied Steam Chinese scripts.
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..');
const moduleCode=name=>fs.readFileSync(path.join(root,'src/common',name+'.js'),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/export /g,'');
const api=new Function(moduleCode('catalog')+moduleCode('engine')+moduleCode('progress')+';return {newState,readFrame,readChapterSkip,nextChapter,next,choose,checkpoint,restore,withProgress,progressFromState,emptyProgress,decodeProgress,afterUnlocked};')();
const cache=new Map();function ops(id){if(!cache.has(id))cache.set(id,JSON.parse(fs.readFileSync(path.join(root,'converted-story',id+'.json'),'utf8')));return cache.get(id);}
const common={'3415:60':1,'415:259':1,'415:503':1,'415:693':0,'415:786':1,'2415:19':0,'415:926':0,'415:1129':1,'416:162':1,'416:233':1,'416:602':1,'417:213':1,'417:441':1,'417:586':1,'417:889':1,'417:929':1,'418:200':1,'418:208':1,'418:216':2,'1418:161':0,'2418:74':1,'2418:353':1,'418:236':1,'5418:181':0,'420:46':1,'421:27':0,'421:238':0,'421:250':0,'422:320':1,'422:412':1,'3422:374':0,'2422:699':0,'3424:729':1,'424:458':0,'5424:78':1,'6423:199':1,'6423:568':1};
const cases={
 misae:{flag:13,choices:{'415:1129':0,'418:316':0,'7500:314':0},sequence:['喜欢你会训斥别人','喜欢你会关心别人','喜欢你被子的香味']},
 tomoyo:{flag:3,choices:{'2415:19':1,'2415:78':0,'416:162':0,'417:441':0,'417:929':0,'417:945':0,'417:976':0,'415:1129':0,'418:316':0,'2418:74':0,'2418:353':0,'418:208':0,'1418:161':1,'418:236':0,'2419:58':0,'420:46':1,'421:27':0,'2421:15':0,'2421:177':0,'2422:141':1,'2422:699':0,'2423:919':1,'2424:385':0,'2426:68':1,'2505:21':1,'2506:214':1,'2506:650':1,'2511:850':0}},
 yukine:{flag:6,choices:{'418:208':0,'418:216':1,'1418:161':1,'418:236':0,'5418:181':1,'5418:282':0,'419:146':0,'419:158':2,'5422:21':0,'5424:78':1,'5430:1187':1,'5430:1657':0,'5430:2047':1}},
 kotomi:{flag:5,choices:{'415:259':0,'415:503':0,'4415:150':0,'416:233':0,'417:586':0,'4417:39':0,'4417:186':0,'418:200':0,'418:216':0,'4418:215':0,'4418:479':0,'4418:568':1,'4419:18':0,'4419:306':1,'4420:233':1,'4420:308':0,'4421:707':1,'4429:28':1,'4430:493':1,'4503:119':1,'4504:203':1,'4504:256':1,'4505:95':1,'4505:417':1,'4510:124':1,'4511:246':1,'4511:445':1}},
 kyou:{flag:4,choices:{'3415:60':0,'415:693':1,'415:926':1,'3416:258':0,'3422:374':1,'3423:141':1,'3424:729':0,'3425:222':1,'3426:597':0,'3428:359':0,'3503:589':0,'3504:64':1,'3505:444':0,'3507:311':0}},
 kappei:{flag:12,choices:{'420:46':0,'421:27':1,'3421:10':0,'7600:26':0,'7600:102':0,'422:412':1,'5424:78':1,'7600:1554':1}},
 mei:{flag:9,choices:{'2415:19':1,'2415:78':0,'416:162':0,'417:441':0,'417:889':0,'417:896':0,'417:976':0,'418:208':0,'1418:161':1,'420:46':0,'3423:141':0,'6423:568':0,'424:458':1,'7400:320':0}},
 fuko:{flag:2,choices:{'416:291':0,'416:602':0,'417:889':0,'417:896':0,'417:976':0,'418:208':0,'1418:161':1,'6418:189':0,'6423:199':1,'6423:546':1,'6423:568':0,'6424:324':0,'1428:1582':0,'1502:370':1,'1511:45':1,'1516:459':0},sequence:[]},
 koumura:{flag:15,choices:{'416:291':0,'416:602':0,'417:889':0,'417:896':0,'417:976':0,'418:208':0,'1418:161':1,'6423:199':1,'6423:568':1,'6424:324':1,'6428:351':0,'6428:353':1,'6428:890':0,'6428:2017':1,'6428:2056':1,'6430:2335':0}},
 nagisa:{flag:1,choices:{'2415:19':1,'2415:78':0,'415:1129':0,'416:162':0,'416:291':0,'416:602':0,'417:441':0,'417:889':0,'417:896':0,'417:976':0,'418:208':0,'1418:161':1,'420:46':0,'6423:199':1,'6423:568':0,'6424:324':1,'6426:274':1,'6426:944':0,'6427:50':0,'6727:50':0,'6428:351':0,'6428:353':1,'6428:890':0,'6428:2017':1,'6428:2056':1,'6430:2335':1,'6502:374':0,'6511:78':0,'6511:462':0}},
};
for(const name of ['fuko','koumura','nagisa'])cases[name].choices['1417:38']=1;
for(const name of ['fuko','koumura','nagisa'])cases[name].choices['6421:62']=1;
for(const name of ['fuko','koumura','nagisa'])cases[name].choices['6423:463']=1;
for(const name of ['koumura','nagisa'])cases[name].choices['6423:546']=1;
cases.nagisa.choices['6426:274']=0;
cases.kappei.choices['424:656']=1;
for(const name of ['kappei','mei','nagisa'])Object.assign(cases[name].choices,{'7100:27':1});
function run(name,progress=api.emptyProgress(),overrides={}){
 const c=cases[name],s=api.withProgress(api.newState(c.start||414,true),progress),trace=[],seen=new Set();let sequence=(c.sequence||[]).slice();
 for(let n=0;n<200000;n++){
  const all=ops(s.chapter),base=Math.floor(s.cursor/512)*512;const f=api.readFrame(all.slice(base,base+512),s,base,all.length);if(f.type==='jump'||f.type==='yield')continue;
  if(f.type==='end'){return {name,state:s,progress:api.progressFromState(s),flag:c.flag,reached:s.variables['g:'+c.flag]===1,trace};}
  if(f.type==='choice'){
   const key=s.chapter+':'+s.cursor,sig=key+JSON.stringify(s.variables);if(seen.has(sig))throw Error('Interactive loop '+name+' '+key);seen.add(sig);
   let index=overrides[key]??c.choices[key]??common[key]??0;
   if(ops(s.chapter)[s.cursor].op==='dynamicChoice')index=({1002:1,1003:1,1004:2,1005:2,1006:0,1008:3,1009:3})[s.chapter]??0;
   if(sequence.length&&s.chapter===7500){const match=f.items.findIndex(x=>x.text===sequence[0]);if(match>=0){index=match;sequence.shift();}}
   trace.push({key,id:ops(s.chapter)[s.cursor].id,index,text:f.items[index].text,options:f.items.map(x=>x.text)});api.choose(s,f.items[index],index);
   if(c.reload){const saved=JSON.stringify(api.checkpoint(s));Object.assign(s,api.restore(JSON.parse(saved)));}
  }else api.next(s);
 }
 throw Error('Limit '+name+' '+s.chapter+':'+s.cursor+' '+s.text.slice(0,30));
}
module.exports={api,run,cases,ops};
