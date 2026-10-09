"""Compute native image boxes which keep the visible sprite bottom at y=286."""
import json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];dims={}
for p in (root/'src/common/images').glob('*.png'):
    im=Image.open(p)
    if p.name.startswith('cg'):
        assert im.mode=='RGBA';bbox=im.getchannel('A').getbbox();assert bbox and bbox[3]==im.height,(p.name,bbox,im.size)
        dims[p.name]=list(im.size)
out="const dimensions="+json.dumps(dims,separators=(',',':'))+";\n"
out+="export function portraitBox(path,count,index){\n  const name=String(path||'').split('/').pop(),size=dimensions[name]||[180,240],cell=count>=3?144:count===2?216:432,maxWidth=count===1?280:cell;\n  const scale=Math.min(maxWidth/size[0],286/size[1]),width=Math.round(size[0]*scale),height=Math.round(size[1]*scale);\n  return {width,height,left:Math.round(index*cell+(cell-width)/2),top:286-height};\n}\n"
(root/'src/common/portrait-layout.js').write_text(out,encoding='utf8')
(root/'reports/portrait-layout.json').write_text(json.dumps({'anchoredBottom':286,'singleMaxWidth':280,'dimensions':dims},indent=2),encoding='utf8')
print('PORTRAIT_LAYOUT',len(dims))
