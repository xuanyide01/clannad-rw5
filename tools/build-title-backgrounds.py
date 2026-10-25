"""Render both original title variants with exactly the same crop and scale."""
from pathlib import Path
import hashlib,io,json
from PIL import Image,ImageChops
root=Path(__file__).resolve().parents[1];source=root.parent/'clannad-probe/ui-decoded';out=root/'src/common/ui'
crop=(0,0,807,960);size=(432,514)
def render(name):
    original=Image.open(source/(name+'.png')).convert('RGB')
    bg=original.crop(crop).resize(size,Image.Resampling.LANCZOS).convert('RGBA')
    veil=Image.new('RGBA',size);pix=veil.load()
    for y in range(150):
        alpha=round(238*max(0,1-y/150)**0.65)
        for x in range(432):pix[x,y]=(249,255,253,alpha)
    bg=Image.alpha_composite(bg,veil).convert('RGB');buf=io.BytesIO();bg.save(buf,'JPEG',quality=90,optimize=True,progressive=False)
    return original,buf.getvalue()
a,before=render('STT_BG00');b,after=render('STT_BG10')
assert a.size==b.size==(1280,960)
assert after==(out/'title.jpg').read_bytes(),'Keep the already delivered post-clear view unchanged'
assert a.crop((0,0,1280,450)).tobytes()==b.crop((0,0,1280,450)).tobytes()
x=Image.open(io.BytesIO(before));y=Image.open(io.BytesIO(after))
for rect in [(0,0,432,280),(320,0,432,514)]:assert x.crop(rect).tobytes()==y.crop(rect).tobytes(),'Static forest moves'
(out/'title-before.jpg').write_bytes(before)
data=json.loads((root.parent/'clannad-probe/scripts/seen6803.json').read_text('utf-8'))
flag=next(o for o in data['ops'] if o.get('expr')=='global.g[45] = 1')
report={'passed':True,'originalCanvas':[1280,960],'identicalCrop':list(crop),'identicalOutputSize':list(size),'originalDifferenceBounds':list(ImageChops.difference(a,b).getbbox()),'staticTopAndRightPixelsIdentical':True,'postClearImageBytesUnchanged':True,
        'before':{'source':'STT_BG00','file':'common/ui/title-before.jpg','sha256':hashlib.sha256(before).hexdigest(),'bytes':len(before)},
        'after':{'source':'STT_BG10','file':'common/ui/title.jpg','sha256':hashlib.sha256(after).hexdigest(),'bytes':len(after)},
        'unlock':{'flag':'g:45','value':1,'originalScene':6803,'originalSourceLine':flag['line'],'originalOffset':flag['ofs'],'originalAssignment':flag['expr']}}
(root/'reports/title-backgrounds-v020.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
