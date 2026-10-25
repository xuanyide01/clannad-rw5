// PCM includes a two-second silent tail. Stop before EOF, then create a new stream.
export const TITLE_CONTENT_MS=72927;
export const TITLE_RESTART_GAP_MS=1200;
export function makeTitleMusic(audio,changed){
  let owned=false,wanted=false,failed=false,destroyed=false,timer=null,generation=0,announced=false;
  function cancel(){if(timer!==null)clearTimeout(timer);timer=null;}
  function close(){if(!owned)return;owned=false;console.log('CLANNAD_RW5 audio stopped');try{audio.stop();}catch(e){}}
  function stop(){wanted=false;generation++;cancel();close();}
  function failure(data,code){failed=true;console.error('CLANNAD_RW5 audio error',String(data),code);stop();if(changed)changed(false);}
  function later(fn,ms,token){cancel();const id=setTimeout(()=>{if(token!==generation||destroyed||timer!==id)return;timer=null;fn();},ms);timer=id;}
  function arm(token){later(()=>{if(!wanted||!owned)return;close();console.log('CLANNAD_RW5 title guarded stop');later(()=>{if(wanted&&!failed)play();},TITLE_RESTART_GAP_MS,token);},TITLE_CONTENT_MS,token);}
  function play(){
    if(!wanted||failed||destroyed||!audio)return;const token=++generation;announced=false;
    try{audio.autoplay=false;audio.loop=false;audio.src='/common/title-ushio.wav';owned=true;console.log('CLANNAD_RW5 audio track title');audio.play();if(!announced)arm(token);if(changed)changed(true);}catch(e){failure(e);}
  }
  if(audio){
    audio.onplay=()=>{if(!owned||!wanted||destroyed||failed||announced)return;announced=true;console.log('CLANNAD_RW5 audio playing',JSON.stringify({track:'title',loop:false,currentTime:0,duration:74.9267,positionIsEventEstimate:true}));arm(generation);};
    audio.onstop=()=>console.log('CLANNAD_RW5 audio stop callback');
    audio.onpause=()=>{console.log('CLANNAD_RW5 audio paused');stop();};
    audio.onended=()=>{console.log('CLANNAD_RW5 audio ended');if(owned&&wanted)failure('Unexpected EOF; replay disabled');};
    audio.onerror=failure;
  }
  return {update(value){if(!value){stop();return;}wanted=true;if(!owned&&timer===null&&!failed&&!destroyed)play();},stop,
    retry(){failed=false;if(changed)changed(true);},
    destroy(){stop();destroyed=true;if(audio){audio.onplay=null;audio.onstop=null;audio.onpause=null;audio.onended=null;audio.onerror=null;}}};
}
