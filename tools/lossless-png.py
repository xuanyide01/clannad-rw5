"""Lossless PNG recompression; retain dimensions, RGBA samples and PNG color type."""
import concurrent.futures,hashlib,io,json,sys,time
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];work=root.parent/'clannad-ui-v015'
sys.path.insert(0,str(root.parent/'clannad-tools/compression-deps'))
import zopfli.png
backup=work/'png-before';optimized=work/'png-optimized'
backup.mkdir(parents=True,exist_ok=True);optimized.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
def optimize(path):
    rel=path.relative_to(root/'src/common');old=path.read_bytes();dest=backup/rel
    dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists():assert dest.read_bytes()==old,'Baseline changed: '+str(rel)
    else:dest.write_bytes(old)
    target=optimized/rel;target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists():new=target.read_bytes()
    else:
        new=zopfli.png.optimize(old,lossy_transparent=False,lossy_8bit=False,num_iterations=1,num_iterations_large=1,filter_strategies='0mepb')
        # Keep the format used by the working watch decoder, including the launcher icon.
        if len(new)>=len(old) or new[25]!=old[25]:new=old
        target.write_bytes(new)
    a=Image.open(io.BytesIO(old)).convert('RGBA');b=Image.open(io.BytesIO(new)).convert('RGBA')
    assert a.size==b.size and a.tobytes()==b.tobytes() and new[25]==old[25]
    return {'file':str(rel).replace('\\','/'),'before':len(old),'after':len(new),'beforeSha256':sha(old),'afterSha256':sha(new),'pixelsIdentical':True,'colorTypeUnchanged':True}
def main():
    files=list((root/'src/common').rglob('*.png'));rows=[];start=time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(optimize,p) for p in files]
        for f in concurrent.futures.as_completed(futures):
            rows.append(f.result())
            if len(rows)%25==0:print(json.dumps({'done':len(rows),'total':len(files),'savedBytes':sum(r['before']-r['after'] for r in rows),'seconds':round(time.time()-start)}),flush=True)
    report={'passed':True,'files':len(rows),'beforeBytes':sum(r['before'] for r in rows),'afterBytes':sum(r['after'] for r in rows),'savedBytes':sum(r['before']-r['after'] for r in rows),'allPixelsIdentical':True,'allDimensionsAndColorTypesUnchanged':True,'codec':'zopfli 0.4.3 lossless PNG','rows':sorted(rows,key=lambda r:r['file'])}
    (root/'reports/lossless-png-v015.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'}),flush=True)
if __name__=='__main__':main()
