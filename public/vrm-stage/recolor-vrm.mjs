/** Non-destructive material-only patch for an existing VRM/glTF 2.0 GLB.
 * Retains original binary geometry, textures, bone weights and VRM metadata.
 * Does not bake an animated pose or modify the original file on GitHub.
 */
const MAGIC=0x46546c67,JSON_TYPE=0x4e4f534a,BIN_TYPE=0x004e4942;
const te=new TextEncoder(),td=new TextDecoder();
const aligned=n=>(n+3)&~3;
const linear=x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);
function checkBuffer(buffer){
 if(!(buffer instanceof ArrayBuffer))throw Error('VRMのバイナリデータがありません');
 const v=new DataView(buffer);
 if(buffer.byteLength<20||v.getUint32(0,true)!==MAGIC||v.getUint32(4,true)!==2||v.getUint32(8,true)!==buffer.byteLength)
  throw Error('glTF 2.0 GLBファイルではありません');
 return v;
}
export function parseSourceGLB(buffer){
 const v=checkBuffer(buffer),chunks=[];let position=12,doc=null;
 while(position+8<=buffer.byteLength){
  const length=v.getUint32(position,true),type=v.getUint32(position+4,true);position+=8;
  if(length>buffer.byteLength-position||length%4)throw Error('GLBチャンク長が不正です');
  const bytes=new Uint8Array(buffer,position,length).slice();
  chunks.push({type,bytes});
  if(type===JSON_TYPE){
   if(doc)throw Error('JSONチャンクが複数あります');
   doc=JSON.parse(td.decode(bytes).replace(/\u0000+$/g,'').trim());
  }
  position+=length;
 }
 if(position!==buffer.byteLength||!doc||!chunks.some(c=>c.type===BIN_TYPE))throw Error('GLBファイルに必要なデータがありません');
 if(!doc.extensions?.VRMC_vrm&&!doc.extensions?.VRM)throw Error('VRM拡張データが見つかりません');
 return {doc,chunks};
}
export function recolorVRM(original,patches){
 const {doc,chunks}=parseSourceGLB(original);
 const materials=doc.materials||[];
 if(!patches||typeof patches!=='object'||Array.isArray(patches))throw Error('変更する材質がありません');
 let count=0;
 for(const [indexText,color] of Object.entries(patches)){
  if(!/^\d{1,4}$/.test(indexText)||!/^#[0-9a-f]{6}$/i.test(color))throw Error('材質の指定が不正です');
  const i=Number(indexText),m=materials[i];
  if(!m)throw Error('元VRMに存在しない材質です: '+i);
  const components=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16)/255).map(linear);
  const previous=m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
  m.pbrMetallicRoughness={...(m.pbrMetallicRoughness||{}),baseColorFactor:[...components,previous[3]??1]};
  count++;
 }
 if(!count)throw Error('色を変更した材質がありません');
 const jsonBytes=te.encode(JSON.stringify(doc)),jsonSize=aligned(jsonBytes.length);
 const updated=chunks.map(c=>{
  if(c.type!==JSON_TYPE)return c;
  const bytes=new Uint8Array(jsonSize);bytes.fill(32);bytes.set(jsonBytes);
  return{type:JSON_TYPE,bytes};
 });
 const size=12+updated.reduce((n,c)=>n+8+c.bytes.length,0),dest=new ArrayBuffer(size),
   view=new DataView(dest),out=new Uint8Array(dest);
 view.setUint32(0,MAGIC,true);view.setUint32(4,2,true);view.setUint32(8,size,true);
 let cursor=12;
 for(const c of updated){
  view.setUint32(cursor,c.bytes.length,true);
  view.setUint32(cursor+4,c.type,true);
  out.set(c.bytes,cursor+8);cursor+=8+c.bytes.length;
 }
 const verified=parseSourceGLB(dest);
 if(JSON.stringify(verified.doc.extensions)!==JSON.stringify(doc.extensions))throw Error('元VRMの拡張情報が保持されませんでした');
 return {bytes:dest,changed:count};
}
