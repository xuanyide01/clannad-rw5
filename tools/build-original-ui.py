"""Scale the original G00 title buttons and UI frames for the 432x514 watch."""
import hashlib,json,sys
from pathlib import Path
from PIL import Image, ImageDraw

project=Path(__file__).resolve().parents[1]
probe=project.parent/'clannad-probe'
sys.path.insert(0,str(project.parent/'clannad-tools/pydeps'))
from siglus_ssu.g00 import _decode_g00_main_layer
source=Path(sys.argv[1]) if len(sys.argv)>1 else probe/'ui-original'
out=project/'src/common/ui';out.mkdir(exist_ok=True)
records=[]
def original(name,cut=0):
    p=source/(name+'.g00');im,_=_decode_g00_main_layer(p,cut)
    records.append({'source':p.name,'cut':cut,'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    return im
def save(im,name):
    im.save(out/name,optimize=True,compress_level=9)
def fit(im,size):return im.resize(size,Image.Resampling.LANCZOS)

# Preserve the original proportions. The left crop includes all of Ushio.
bg=fit(original('STT_BG10').crop((0,0,807,960)),(432,514)).convert('RGB')
# A quiet area behind the logo, retaining the original forest below it.
veil=Image.new('RGBA',(432,514));pix=veil.load()
for y in range(150):
    alpha=round(238*max(0,1-y/150)**0.65)
    for x in range(432):pix[x,y]=(249,255,253,alpha)
bg=Image.alpha_composite(bg.convert('RGBA'),veil)
bg.convert('RGB').save(out/'title.jpg',quality=90,optimize=True,progressive=False)
save(fit(original('STT_LB00'),(288,66)),'logo.png')
save(fit(original('STT_LB10'),(184,36)),'subtitle.png')
save(fit(original('STT_LB30'),(154,19)),'copyright.png')
for n,index in [('new-game',0),('load',10),('after-story',20),('cg-mode',30),('config',50)]:
    save(fit(original('STT_MI'+str(index).zfill(2),0),(188,25)),n+'.png')

# The title menu uses the original pale additive panel as a translucent layer.
panel=fit(original('STT_MB20'),(216,300)).convert('RGBA')
old_alpha=panel.getchannel('A')
panel.putalpha(Image.frombytes('L',panel.size,bytes(
    round(min(220,old_alpha.getpixel((x,y))*8)*max(0,min(1,x/20,(215-x)/20,y/18,(299-y)/18)))
    for y in range(300) for x in range(216))))
save(panel,'title-panel.png')
# Runtime controls now use the uniform green style; keep only title artwork.
for unused in ['dialogue-frame.png','name-frame.png','button.png']:
    p=out/unused
    if p.is_file():p.unlink()
dark=Image.new('RGB',(432,228))
d=ImageDraw.Draw(dark)
for y in range(228):
    d.line((0,y,432,y),fill=(9+round(y/228*4),22+round(y/228*5),30+round(y/228*6)))
dark.save(out/'dialogue.jpg',quality=95,optimize=True)
# Subordinate screens echo the forest's muted green instead of the old generic blue.
paper=bg.convert('RGB').resize((432,514))
paper=Image.blend(paper,Image.new('RGB',paper.size,'#f1f8f4'),0.94)
paper.save(out/'paper.jpg',quality=82,optimize=True)
report={'designWidth':432,'designHeight':514,'titleBackground':'STT_BG10 (original Ushio-clear variant)','backgroundCrop':[0,0,807,960],
        'titleButtonCuts':'original cut 0, aspect ratio preserved','assets':records,
        'generated':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(out.iterdir()) if p.is_file()}}
(project/'reports/original-ui.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('UI_ASSETS',sum(p.stat().st_size for p in out.iterdir() if p.is_file()))
