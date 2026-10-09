const missing="♪䲠呣呯嗙嗞嶋斉柊栃榎況祐篠簑苅辻阇鮟鰤鰶鱇鵺";
export function textFont(text){
  const value=String(text||'');for(let i=0;i<missing.length;i++)if(value.indexOf(missing[i])>=0)return 'clannadextra';return 'sans-serif';
}
