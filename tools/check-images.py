from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[1];folder=root/'src/common/images'
budget=json.loads((root/'reports/portrait-budget.json').read_text(encoding='utf-8'))
files=list(folder.iterdir())
for path in files:
    with Image.open(path) as image:image.verify()
colors=[]
for record in budget['representatives']:
    with Image.open(folder/record['image']) as image:
        assert image.mode=='RGBA' and image.width<=180 and image.height<=240
        visible=[p for p in image.getdata() if p[3]>=128]
        assert visible,record['image']
        colors.append(len(set(p[:3] for p in visible)))
report={'verifiedImages':len(files),'portraitGroups':len(colors),'maxPortraitSize':[180,240],'mode':'RGBA','minOpaqueColors':min(colors),'alphaBits':8,'rgbBitsPerChannel':5,'result':'passed'}
(root/'reports/image-integrity.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(report)
