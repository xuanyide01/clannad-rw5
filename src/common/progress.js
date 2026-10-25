// Persistent g[] flags belong to the original game's cross-playthrough state.
export const PROGRESS_KEY='clannad_rw5_progress_v1';
export function emptyProgress(){return {version:1,variables:{}};}
export function decodeProgress(raw){
  if(!raw)return emptyProgress();const p=typeof raw==='string'?JSON.parse(raw):raw;
  if(!p||p.version!==1||!p.variables||Array.isArray(p.variables)||typeof p.variables!=='object')throw Error('通关记录格式无效');
  const variables={};for(const k of Object.keys(p.variables)){if(/^g:\d+$/.test(k)&&Number.isFinite(p.variables[k]))variables[k]=p.variables[k];}
  return {version:1,variables};
}
export function progressFromState(state){const variables={};for(const k of Object.keys(state.variables)){if(/^g:\d+$/.test(k))variables[k]=state.variables[k];}return {version:1,variables};}
export function withProgress(state,progress){for(const k of Object.keys(progress.variables))state.variables[k]=progress.variables[k];return state;}
export function lightCount(progress){return progress.variables['g:0']||0;}
// Matches the bundled original _system_title condition, not an orb-count guess.
export function afterUnlocked(progress){return [1,2,3,4,5,6,9,12,13,15,30,31].every(n=>progress.variables['g:'+n]===1);}
// Original seen6803 sets g[45] only after the true ending.
export function trueEndingSeen(progress){return progress.variables['g:45']===1;}
export function titleBackground(progress){return trueEndingSeen(progress)?'/common/ui/title.jpg':'/common/ui/title-before.jpg';}
