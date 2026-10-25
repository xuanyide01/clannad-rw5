// STORE already-compressed PNG, PCM and fonts; keep small DEFLATE only as needed.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),{createRequire}=require('module');
module.exports=async function(file,toolkit){
 const req=createRequire(path.join(path.resolve(toolkit),'package.json')),JSZip=req('jszip'),CompressedObject=req('jszip/lib/compressedObject'),algorithm=req.resolve('@aiot-toolkit/packager/lib/signature/algorithm'),pem=path.join(path.dirname(algorithm),'../pem');
 const original=fs.readFileSync(file),zip=await JSZip.loadAsync(original,{checkCRC32:true}),cache=path.join(__dirname,'install-deflate-cache');zip.comment='';
 const files=[],rows=[];let estimate=original.length;
 for(const [name,entry] of Object.entries(zip.files)){
  if(entry.dir){entry.options.compression='STORE';continue;}
  const data=await entry.async('nodebuffer'),hash=crypto.createHash('sha256').update(data),digest=hash.digest('hex');files.push({name,hash:Buffer.from(digest,'hex')});
  const previous=entry._data.compressedSize;let compressed=previous;
  if(/\.(js|json|txt|css|ux)$/.test(name)){
   const cached=path.join(cache,digest+'.deflate');
   if(fs.existsSync(cached)){
    const raw=fs.readFileSync(cached);if(!zlib.inflateRawSync(raw).equals(data))throw Error('Invalid cached text stream');
    const old=entry._data;entry._data=new CompressedObject(raw.length,data.length,old.crc32,old.compression,raw);compressed=raw.length;
   }
  }
  estimate+=data.length-previous;entry.options.compression='STORE';
  rows.push({name,entry,bytes:data.length,compressed,saving:data.length-compressed,text:/\.(js|json|txt|css|ux)$/.test(name),jpeg:/\.jpe?g$/i.test(name)});
 }
 const retained=new Set();function deflate(row){if(retained.has(row.name)||row.saving<=0)return;retained.add(row.name);row.entry.options.compression='DEFLATE';estimate-=row.saving;}
 rows.filter(r=>r.text&&r.bytes>=65536).forEach(deflate);
 for(const r of rows.filter(r=>r.text&&!retained.has(r.name)).sort((a,b)=>b.saving-a.saving)){if(estimate<=24990000)break;deflate(r);}
 // Retain some small JPEG streams to preserve the existing 16 kHz PCM unchanged.
 // PNG, WAV and font files always remain STORE, including the former largest entry.
 for(const r of rows.filter(r=>r.jpeg&&!retained.has(r.name)).sort((a,b)=>b.saving-a.saving)){if(estimate<=24990000)break;deflate(r);}
 const unsigned=await zip.generateAsync({type:'nodebuffer',compression:'STORE',compressionOptions:{level:9}});
 const signed=require(algorithm).doSign(unsigned,files,fs.readFileSync(path.join(pem,'private.pem')),fs.readFileSync(path.join(pem,'certificate.pem')));
 if(signed.length>25000000)throw Error('Low-inflate package exceeds 25 MB');
 fs.writeFileSync(file,signed);
 const deflated=rows.filter(r=>retained.has(r.name)),protectedFiles=rows.filter(r=>/\.(png|wav|otf|ttf)$/i.test(r.name));
 if(protectedFiles.some(r=>retained.has(r.name)))throw Error('A protected binary resource still requires inflate');
 fs.writeFileSync(path.resolve(__dirname,'../reports/install-packaging-v020.json'),JSON.stringify({passed:true,sourceBytes:original.length,bytesBeforeR1:signed.length,allUncompressedPayloadBytesIdentical:true,storedFiles:rows.length-retained.size,deflatedFiles:retained.size,storedProtectedBinaryFiles:protectedFiles.length,allPngPcmAndFontsStored:true,largestDeflatedBytes:Math.max(...deflated.map(r=>r.bytes)),deflatedUncompressedBytes:deflated.reduce((n,r)=>n+r.bytes,0),deflatedEntries:deflated.map(({name,bytes,compressed})=>({name,bytes,compressed})),actualFirmwarePeakHeapNotMeasured:true},null,2));
};
