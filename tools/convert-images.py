"""Decode official G00 data and scale watch assets; never execute the game."""
import concurrent.futures,hashlib,json,os,re,sys,time,threading
from pathlib import Path
PROJECT=Path(__file__).resolve().parents[1];PROBE=PROJECT.parent/'clannad-probe'
sys.path.insert(0,str(PROJECT.parent/'clannad-tools/pydeps'))
from siglus_ssu.g00 import _decode_g00_main_layer
from PIL import Image,ImageChops
SOURCE=Path(os.environ.get('CLANNAD_GAME_ROOT',r'G:\SteamLibrary\steamapps\common\CLANNAD'))
jobs=json.loads((PROBE/'image-jobs.json').read_text('utf8'))
OUT=PROJECT/'src/common/images';OUT.mkdir(exist_ok=True)
DETAIL=PROJECT/'reports';DETAIL.mkdir(exist_ok=True)
start=time.time();lock=threading.Lock();finished=0
size=int(os.environ.get('CLANNAD_PORTRAIT_SIZE','256'))
def job(row):
    global finished
    name=row['name'].lower().removesuffix('.g00');p=SOURCE/'g00'/row['name']
    im,center=_decode_g00_main_layer(p)
    original_size=im.size
    sprite=name.startswith('cg') and not name.startswith('cgsi')
    if sprite:
        box=im.getchannel('A').getbbox()
        if not box:raise ValueError('empty portrait '+name)
        im=im.crop(box);im.thumbnail((200,size),Image.Resampling.LANCZOS)
        rgba=im.split();rgb=[ch.point(lambda x:min(255,(x//4)*4+2)) for ch in rgba[:3]]
        im=Image.merge('RGBA',rgb+[rgba[3]])
        ext='png';dest=OUT/(name+'.png');im.save(dest,optimize=True,compress_level=9)
    else:
        if name=='stt_logo00':
            box=im.getchannel('A').getbbox()
            if box:im=im.crop(box)
            im.thumbnail((300,190),Image.Resampling.LANCZOS);ext='png';dest=OUT/(name+'.png');im.save(dest,optimize=True)
        else:
            im=im.convert('RGB');im.thumbnail((320,240),Image.Resampling.LANCZOS)
            ext='jpg';dest=OUT/(name+'.jpg');im.save(dest,quality=61,optimize=True,progressive=False,subsampling=2)
    rec={'name':name,'image':dest.name,'kind':'portrait' if sprite else 'illustration','sourceSize':original_size,'size':im.size,'bytes':dest.stat().st_size,'hash':hashlib.sha256(im.tobytes()).hexdigest(),'cuts':row['cuts'],'center':center}
    with lock:
        finished+=1
        if finished%100==0:print('images',finished,'/',len(jobs),round(time.time()-start,1),'sec',flush=True)
    return rec
records=[];errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    pending={pool.submit(job,r):r for r in jobs}
    for f in concurrent.futures.as_completed(pending):
        try:records.append(f.result())
        except Exception as e:errors.append({'name':pending[f]['name'],'error':str(e)})
records.sort(key=lambda x:x['name']);aliases={};byhash={}
for r in records:
    key=(r['kind'],r['hash']);chosen=byhash.setdefault(key,r['image']);aliases[r['name']]=chosen
kept=set(aliases.values())
for r in records:
    if r['image'] not in kept:
        # Every deletion is a single generated asset inside this project's images directory.
        p=OUT/r['image']
        if p.exists():p.unlink()
(PROJECT/'src/common/assets.js').write_text('const assets='+json.dumps(aliases,separators=(',',':'))+';\nexport function imagePath(name){const f=assets[String(name||\'kuro\').toLowerCase()];return f?\'/common/images/\'+f:\'/common/images/kuro.jpg\';}\n',encoding='utf8')
(DETAIL/'image-conversion.json').write_text(json.dumps({'source':'Steam official','records':records,'errors':errors,'uniqueFiles':len(kept),'bytes':sum((OUT/n).stat().st_size for n in kept),'seconds':time.time()-start},ensure_ascii=False,indent=2),encoding='utf8')
print('DONE',len(records),'unique',len(kept),'bytes',sum((OUT/n).stat().st_size for n in kept),'errors',errors[:5],flush=True)
if errors:raise SystemExit(1)
