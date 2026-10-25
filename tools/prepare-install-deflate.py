"""Optional: refresh the lossless text cache after changing converted story data."""
from pathlib import Path
import concurrent.futures,hashlib,json,zlib
import zopfli.zlib
root=Path(__file__).resolve().parents[1];cache=root/'tools/install-deflate-cache';cache.mkdir(exist_ok=True)
files=list((root/'src/common').rglob('*.txt'))
def encode(p):
    raw=p.read_bytes();data=zopfli.zlib.compress(raw,numiterations=3)[2:-4]
    assert zlib.decompress(data,-15)==raw
    (cache/(hashlib.sha256(raw).hexdigest()+'.deflate')).write_bytes(data)
    return len(raw),len(data)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(encode,files))
print(json.dumps({'files':len(rows),'uncompressedBytes':sum(a for a,b in rows),'compressedBytes':sum(b for a,b in rows),'allBytesExact':True}))
