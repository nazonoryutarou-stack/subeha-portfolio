/* SUBEHA CUT v0.4 portable project ZIP. Stored (uncompressed) entries, media stays local. */
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
export const ARCHIVE_LIMIT=200*1024*1024;
const MAX_ENTRIES=210;
const table=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}
export function crc32(bytes,seed=0){let c=(seed^-1)>>>0;for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&255]^(c>>>8);return (c^-1)>>>0;}
export async function blobCRC(blob){let crc=0;for await(const chunk of blob.stream())crc=crc32(chunk,crc);return crc;}
const u16=(v)=>{const a=new Uint8Array(2);new DataView(a.buffer).setUint16(0,v,true);return a;};
const u32=(v)=>{const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,v>>>0,true);return a;};
function safeId(id){return typeof id==='string'&&/^[a-z0-9_-]{1,90}$/i.test(id);}
export function projectAssetIds(project){
  const ids=new Set();
  const collect=p=>{
    for(const c of p.clips||[])ids.add(c.assetId);
    for(const o of p.overlays||[])ids.add(o.assetId);
    for(const o of p.audioTracks||[])ids.add(o.assetId);
    for(const scene of p.cgScenes||[])ids.add(scene.modelAssetId);
    if(p.music)ids.add(p.music.assetId);
  };
  collect(project);
  // Branches hold non-recursive project snapshots; preserve their source media in backups.
  for(const branch of (Array.isArray(project.editBranches)?project.editBranches:[]).slice(0,3)){
    if(branch?.snapshot && typeof branch.snapshot==='object')collect(branch.snapshot);
  }
  return [...ids];
}
export async function createProjectArchive(project,assetMap){
  if(!Array.isArray(project.clips))throw Error('編集情報が不正です');
  const ids=projectAssetIds(project);if(ids.length>MAX_ENTRIES-1)throw Error('素材数が多すぎます');
  const assets=[],items=[];let total=0;
  for(const id of ids){
    if(!safeId(id))throw Error('不正な素材ID');
    const item=assetMap.get(id);if(!item?.blob)throw Error('欠けている素材があります: '+id);
    const blob=item.blob;
    if(!Number.isFinite(blob.size)||blob.size<0)throw Error('不正な素材サイズ');
    total+=blob.size;if(total>ARCHIVE_LIMIT)throw Error('素材の合計が200MBを超えています。容量を減らして再試行してください');
    const name=String(item.name||id).slice(0,160),type=item.type;
    if(!['video','image','audio','model'].includes(type))throw Error('未知の素材種別');
    const path=`media/${id}`;
    assets.push({id,path,name,type,mime:blob.type||({video:'video/mp4',image:'image/png',audio:'audio/mpeg',model:'text/plain'}[type]),size:blob.size});
    items.push({path,blob});
  }
  const manifest={format:'subeha.cut.project',version:1,savedAt:new Date().toISOString(),project:JSON.parse(JSON.stringify(project)),assets};
  const metadata=new Blob([JSON.stringify(manifest)],{type:'application/json'});
  total+=metadata.size;
  if(total>ARCHIVE_LIMIT)throw Error('プロジェクトが200MBを超えています');
  items.unshift({path:'project.json',blob:metadata});
  const chunks=[],central=[];let offset=0;
  for(const {path,blob} of items){
    const name=encoder.encode(path);if(name.length>65535)throw Error('パスが長すぎます');
    const crc=await blobCRC(blob);
    const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(8,0,true);
    v.setUint32(14,crc,true);v.setUint32(18,blob.size,true);v.setUint32(22,blob.size,true);v.setUint16(26,name.length,true);local.set(name,30);
    chunks.push(local,blob);
    const record=new Uint8Array(46+name.length),r=new DataView(record.buffer);
    r.setUint32(0,0x02014b50,true);r.setUint16(4,20,true);r.setUint16(6,20,true);r.setUint16(8,0x800,true);
    r.setUint32(16,crc,true);r.setUint32(20,blob.size,true);r.setUint32(24,blob.size,true);
    r.setUint16(28,name.length,true);r.setUint32(42,offset,true);record.set(name,46);
    central.push(record);offset+=local.length+blob.size;
  }
  const centralSize=central.reduce((s,x)=>s+x.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,items.length,true);e.setUint16(10,items.length,true);
  e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}
function get16(view,off){if(off+2>view.byteLength)throw Error('ZIPヘッダーが不正です');return view.getUint16(off,true);}
function get32(view,off){if(off+4>view.byteLength)throw Error('ZIPヘッダーが不正です');return view.getUint32(off,true);}
export async function readProjectArchive(blob){
  if(blob.size>ARCHIVE_LIMIT+5_000_000)throw Error('200MBの制限を超えるアーカイブです');
  if(blob.size<22)throw Error('空または壊れたZIPです');
  const tailStart=Math.max(0,blob.size-65557),tail=new Uint8Array(await blob.slice(tailStart).arrayBuffer());
  let end=-1;for(let p=tail.length-22;p>=0;p--)if(tail[p]===0x50&&tail[p+1]===0x4b&&tail[p+2]===0x05&&tail[p+3]===0x06){end=p;break;}
  if(end<0)throw Error('ZIP終端がありません');
  const e=new DataView(tail.buffer,tail.byteOffset),count=get16(e,end+10),size=get32(e,end+12),start=get32(e,end+16);
  if(count>MAX_ENTRIES||!count||start+size>blob.size)throw Error('ZIP目次が不正です');
  const buffer=new Uint8Array(await blob.slice(start,start+size).arrayBuffer()),v=new DataView(buffer.buffer);let pos=0;
  const entries=new Map();
  for(let i=0;i<count;i++){
    if(get32(v,pos)!==0x02014b50)throw Error('ZIP目次が壊れています');
    const method=get16(v,pos+10),crc=get32(v,pos+16),raw=get32(v,pos+24),len=get16(v,pos+28),extra=get16(v,pos+30),comment=get16(v,pos+32),localOffset=get32(v,pos+42);
    if(method!==0||get32(v,pos+20)!==raw)throw Error('非圧縮のSUBEHAプロジェクトのみ復元できます');
    const name=decoder.decode(buffer.subarray(pos+46,pos+46+len));pos+=46+len+extra+comment;
    if(pos>buffer.length||entries.has(name))throw Error('ZIPエントリが不正です');
    if(name!=='project.json'&&!/^media\/[a-z0-9_-]{1,90}$/i.test(name))throw Error('許可されていないZIP内容です');
    entries.set(name,{localOffset,size:raw,crc});
  }
  async function extract(name,mime='application/octet-stream'){
    const entry=entries.get(name);if(!entry)throw Error('欠けている素材です: '+name);
    const head=new DataView(await blob.slice(entry.localOffset,entry.localOffset+30).arrayBuffer());
    if(get32(head,0)!==0x04034b50||get16(head,8)!==0)throw Error('ZIPローカルヘッダーが不正です');
    const dataStart=entry.localOffset+30+get16(head,26)+get16(head,28);
    if(dataStart+entry.size>start)throw Error('ZIP内容が範囲外です');
    const body=blob.slice(dataStart,dataStart+entry.size,mime);
    if(await blobCRC(body)!==entry.crc)throw Error('ZIPのデータ破損を検知しました: '+name);
    return body;
  }
  const manifest=JSON.parse(await (await extract('project.json','application/json')).text());
  if(manifest.format!=='subeha.cut.project'||manifest.version!==1||!Array.isArray(manifest.assets)||!Array.isArray(manifest.project?.clips))throw Error('対応していないプロジェクト形式です');
  const ids=projectAssetIds(manifest.project);
  if(ids.length!==manifest.assets.length||ids.length>MAX_ENTRIES-1)throw Error('素材一覧に不整合があります');
  const assets=[];
  for(const meta of manifest.assets){
    if(!safeId(meta.id)||meta.path!==`media/${meta.id}`||!ids.includes(meta.id)||!['image','video','audio','model'].includes(meta.type))throw Error('素材情報が不正です');
    const media=await extract(meta.path,meta.mime||'application/octet-stream');
    if(media.size!==meta.size)throw Error('素材サイズが一致しません');
    assets.push({id:meta.id,blob:media,name:String(meta.name||meta.id).slice(0,160),type:meta.type});
  }
  return {project:manifest.project,assets};
}
