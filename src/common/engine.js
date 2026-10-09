import {catalog} from './catalog.js';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function newState(chapter,story){const id=chapter||catalog.initial;return {chapter:id,rootChapter:id,cursor:0,background:'kuro',regularBackground:'kuro',body:'',bodies:[],speaker:'',text:'',choices:[],history:[],variables:{},stack:[],ended:false,progression:story?'story':'chapter'};}
function clone(o){return JSON.parse(JSON.stringify(o));}
export function checkpoint(s){const o=Object.assign({},s);delete o.history;return clone(o);}
export function restore(saved){
 if(!saved||!catalog.scenes[String(saved.chapter)]||!Number.isInteger(saved.cursor)||saved.cursor<0||saved.cursor>catalog.scenes[String(saved.chapter)].length)throw Error('存档位置无效');
 if(!saved.variables||typeof saved.variables!=='object'||Array.isArray(saved.variables))throw Error('存档变量无效');
 if(!Array.isArray(saved.stack)||saved.stack.length>24)throw Error('存档调用栈无效');
 const s=Object.assign(newState(),clone(saved),{history:[]});if(!catalog.scenes[String(s.rootChapter)])throw Error('存档篇章无效');return s;
}
function key(e,s){return e[1]+(e.length>2?':'+value(e[2],s):'');}
function native(name,args,s,receiver,receiverKey){
 if(/\.counter\[\]\.start/.test(name)){if(!s.counters)s.counters={};s.counters[receiverKey]={value:args.length>1?args[1]:0,ticking:args.length<2};return 0;}
 if(name==='global.random')return 0;
 if(name==='global.get_scene_name')return catalog.scenes[String(s.chapter)].source;
 if(name==='global.get_line_no')return 0;
 if(name==='$filename_translate')return String(args[0]||'').toLowerCase();
 if(name==='global.namae')return {'％Ａ':'渚','％Ｂ':'秋生','％Ｃ':'朋也','％Ｄ':'朋也','％Ｅ':'朋也','％Ｆ':'朋也'}[args[0]]||'朋也';
 // These commands query desktop animation/input; the watch presents settled frames.
 if(/\.check$|\.check\(\)$|\.on_down$|\.check_skip$/.test(name))return 1;
 if(/\.counter\[\]\.get$/.test(name)){const counter=s.counters&&s.counters[receiverKey];if(!counter)return 0;if(counter.ticking)counter.value+=1000;return counter.value;}
 if(/\.(?:s|cur_call\.k)\[\]\.(?:search|len|cnt|mid|left|tonum)$/.test(name)){
  const text=String(receiver||''),method=name.slice(name.lastIndexOf('.')+1);
  if(method==='search')return text.indexOf(String(args[0]));if(method==='len'||method==='cnt')return text.length;if(method==='mid')return text.slice(args[0],args.length>1?args[0]+args[1]:undefined);if(method==='left')return text.slice(0,args[0]);return parseInt(text,10)||0;
 }
 if(name==='global.timewait_key')return 1;
 if(name==='$disp_dialog')return 1;
 if(/\.get_auto_mode_onoff_flag$/.test(name))return 0;
 if(/\.get_(?:open|close)_anime_(?:type|time)$/.test(name))return 0;
 if(/\.get_(?:no_wipe_anime_onoff|koe_dont_stop_onoff)$/.test(name))return 0;
 if(/\.get_filter_color_[rgba]$/.test(name))return 0;
 if(name==='$search_chara_center')return 0;
 throw Error('此演出尚未支持：'+name);
}
export function value(e,s){
 if(!Array.isArray(e))return e;
 const op=e[0];if(op==='v'){const k=key(e,s);return own(s.variables,k)?s.variables[k]:/^(k|cur_call\.k)/.test(e[1])?'':0;}
 if(op==='call')return native(e[1],e[2].map(x=>value(x,s)),s,e.length>3?value(e[3],s):undefined,e.length>3&&e[3][0]==='v'?key(e[3],s):'');
 const a=value(e[1],s);if(e.length===2){if(op==='-')return -a;if(op==='+')return +a;if(op==='!')return a?0:1;if(op==='~')return ~a;}
 if(op==='&&')return a?value(e[2],s)?1:0:0;if(op==='||')return a?1:value(e[2],s)?1:0;
 const b=value(e[2],s);
 switch(op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return b?Math.trunc(a/b):0;case '%':return b?a%b:0;case '==':return a===b?1:0;case '!=':return a!==b?1:0;case '<':return a<b?1:0;case '<=':return a<=b?1:0;case '>':return a>b?1:0;case '>=':return a>=b?1:0;case '&':return a&b;case '|':return a|b;case '^':return a^b;case '<<':return a<<b;case '>>':return a>>b;default:throw Error('剧情表达式无效：'+op);}
}
function assign(target,x,s){if(!Array.isArray(target)||target[0]!=='v')throw Error('剧情变量无效');s.variables[key(target,s)]=x;}
function jump(s,id,entry,call){
 const chapter=catalog.scenes[String(id)];if(!chapter)throw Error('章节不存在：'+id);
 if(call){if(s.stack.length>=24)throw Error('剧情调用次数过多');s.stack.push([s.chapter,s.cursor+1]);}
 s.chapter=id;s.cursor=chapter.entries[entry||0]||0;s.ended=false;
 if(!call&&!s.stack.length)s.rootChapter=id;
}
function returned(s){if(s.stack.length){const f=s.stack.pop();s.chapter=f[0];s.cursor=f[1];return {type:'jump'};}s.ended=true;return {type:'end'};}
export function readFrame(ops,s,base,total){
 base=base||0;total=total===undefined?ops.length:total;
 for(let guard=0;guard<256;guard++){
  if(s.cursor>=total)return returned(s);
  const local=s.cursor-base;if(local<0||local>=ops.length)return {type:'yield'};
  const o=ops[local];
  if(o.op==='text'){s.speaker=o.speaker;s.text=o.text;return {type:'text',speaker:o.speaker,text:o.text};}
  if(o.op==='choice')return {type:'choice',items:o.items.map(x=>Object.assign({},x,{target:o.target}))};
  if(o.op==='dynamicChoice')return {type:'choice',items:o.labels.map((x,i)=>({text:String(value(x,s)),value:i,target:o.target}))};
  if(o.op==='set')assign(o.target,value(o.value,s),s);
  else if(o.op==='native')value(o.call,s);
  else if(o.op==='goto')s.cursor=o.to-1;
  else if(o.op==='ifFalse'&&!value(o.condition,s))s.cursor=o.to-1;
  else if(o.op==='ifTrue'&&value(o.condition,s))s.cursor=o.to-1;
  else if(o.op==='call'){if(s.stack.length>=24)throw Error('剧情调用次数过多');s.stack.push([s.chapter,s.cursor+1]);s.cursor=o.to-1;}
  else if(o.op==='jumpScene'||o.op==='callScene'){jump(s,o.scene,o.entry,o.op==='callScene');return {type:'jump'};}
  else if(o.op==='return')return returned(s);
  else if(o.op==='end'){s.ended=true;return {type:'end'};}
  else if(o.op==='background'){s.background=o.image;if(o.clearBody){s.bodies=[];s.body='';}}
  else if(o.op==='bodies'){s.bodies=o.images.slice(0,3);s.body=s.bodies[0]||'';}
  else if(o.op==='bodyAdd'){const family=o.image.slice(0,4),at=s.bodies.findIndex(x=>x.slice(0,4)===family);if(at>=0)s.bodies[at]=o.image;else{if(s.bodies.length>=3)s.bodies.shift();s.bodies.push(o.image);}s.body=s.bodies[0]||'';}
  s.cursor++;
 }
 return {type:'yield'};
}
function remember(s){s.history.push(checkpoint(s));if(s.history.length>8)s.history.shift();}
export function next(s){remember(s);s.cursor++;}
export function choose(s,item,index){if(!item||!Array.isArray(item.target))throw Error('选项无效');remember(s);assign(item.target,item.value,s);s.choices.push(index);if(s.choices.length>300)s.choices.shift();s.cursor++;}
export function previous(s){const last=s.history.pop();if(!last)return false;const history=s.history;Object.assign(s,last,{history});return true;}
// Run the original interpreter until a decision or the next chapter's first text.
// The skip context is transient UI state; saves keep the original VM format.
export function nextChapter(state){
  if(state.ended)return null;
  remember(state);
  return {chapter:state.rootChapter};
}
export function readChapterSkip(ops,state,context,base,total){
  for(let count=0;count<64;count++){
    const frame=readFrame(ops,state,base,total);
    if(frame.type!=='text'||state.rootChapter!==context.chapter)return frame;
    state.cursor++;
  }
  return {type:'yield'};
}
export function previewMap(){return [];}
