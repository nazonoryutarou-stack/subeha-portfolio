/* GLB and VRM 1.0 export using Three.js GLTFExporter plus VRMC_vrm JSON chunk.
 * Format guide: https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_vrm-1.0
 * User-created avatar shapes; no third-party avatar bases distributed.
 */
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const GLB_MAGIC=0x46546c67,JSON_CHUNK=0x4e4f534a,BIN_CHUNK=0x004e4942;
const REQUIRED_BONES=[
 'hips','spine','head','leftUpperLeg','leftLowerLeg','leftFoot',
 'rightUpperLeg','rightLowerLeg','rightFoot',
 'leftUpperArm','leftLowerArm','leftHand',
 'rightUpperArm','rightLowerArm','rightHand'
];
export function decodeGLB(buffer){
 if(!(buffer instanceof ArrayBuffer))throw Error('GLBではありません');
 const view=new DataView(buffer);
 if(buffer.byteLength<20||view.getUint32(0,true)!==GLB_MAGIC||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)
  throw Error('glTF 2.0バイナリ形式ではありません');
 let cursor=12,json=null,bin=null;
 while(cursor+8<=buffer.byteLength){
  const size=view.getUint32(cursor,true),kind=view.getUint32(cursor+4,true);cursor+=8;
  if(size>buffer.byteLength-cursor)throw Error('GLBチャンクが壊れています');
  const part=new Uint8Array(buffer,cursor,size);
  if(kind===JSON_CHUNK)json=JSON.parse(decoder.decode(part).trim());
  if(kind===BIN_CHUNK)bin=part.slice();
  cursor+=size;
 }
 if(!json||!bin)throw Error('JSONまたはBINチャンクがありません');
 return {json,bin};
}
export function encodeGLB(doc,bin){
 const jsonBytes=encoder.encode(JSON.stringify(doc));
 const jLen=(jsonBytes.length+3)&~3,bLen=(bin.byteLength+3)&~3,size=12+8+jLen+8+bLen;
 const output=new ArrayBuffer(size),view=new DataView(output),dst=new Uint8Array(output);
 view.setUint32(0,GLB_MAGIC,true);view.setUint32(4,2,true);view.setUint32(8,size,true);
 view.setUint32(12,jLen,true);view.setUint32(16,JSON_CHUNK,true);
 dst.fill(32,20,20+jLen);dst.set(jsonBytes,20);
 const binStart=20+jLen;
 view.setUint32(binStart,bLen,true);view.setUint32(binStart+4,BIN_CHUNK,true);
 dst.set(bin,binStart+8);
 return output;
}
function requireNode(doc,name){
 const id=doc.nodes?.findIndex(node=>node.name===name);
 if(id===-1||id===undefined)throw Error('VRM必須ボーンがありません: '+name);
 return id;
}
export function addVRMExtension(glb,options={}){
 const {json:doc,bin}=decodeGLB(glb);
 const humanBones={};
 for(const name of REQUIRED_BONES)humanBones[name]={node:requireNode(doc,'Human_'+name)};
 for(const name of ['chest','upperChest','neck','leftShoulder','rightShoulder']){
  const id=doc.nodes?.findIndex(node=>node.name==='Human_'+name);if(id>=0)humanBones[name]={node:id};
 }
 const expressionNodes={};
 for(const name of ['Eyes_Left','Eyes_Right','Mouth']){
  const id=doc.nodes?.findIndex(node=>node.name===name);
  if(id<0)throw Error('表情メッシュがありません: '+name);
  const node=doc.nodes[id],mesh=doc.meshes?.[node.mesh];
  if(!mesh?.primitives?.[0]?.targets?.length)throw Error('表情モーフが書き出されていません: '+name);
  expressionNodes[name]={id,targetCount:mesh.primitives[0].targets.length};
 }
 const expressions={};
 const m={
  blink:[['Eyes_Left',0],['Eyes_Right',0]],
  happy:[['Eyes_Left',1],['Eyes_Right',1],['Mouth',5]],
  sad:[['Eyes_Left',2],['Eyes_Right',2],['Mouth',6]],
  angry:[['Mouth',7]],relaxed:[['Mouth',9]],surprised:[['Mouth',8]],
  aa:[['Mouth',0]],ih:[['Mouth',1]],ou:[['Mouth',2]],ee:[['Mouth',3]],oh:[['Mouth',4]]
 };
 for(const [key,bindings] of Object.entries(m)){
  expressions[key]={morphTargetBinds:bindings.map(([mesh,index])=>{
   const entry=expressionNodes[mesh];
   if(index>=entry.targetCount)throw Error('表情モーフの数が不足しています: '+key);
   return {node:entry.id,index,weight:1};
  })};
 }
 const text=value=>String(value||'').trim().slice(0,120);
 const meta={
  name:text(options.name)||'Avatar Atelier Character',
  authors:[text(options.author)||'Avatar Atelier Creator'],
  licenseUrl:'https://vrm.dev/licenses/1.0/',
  avatarPermission:options.publicUse?'everyone':'onlyAuthor',
  commercialUsage:options.commercial?'corporation':'personalNonProfit',
  allowPoliticalOrReligiousUsage:!!options.religious,
  allowExcessivelyViolentUsage:false,
  allowExcessivelySexualUsage:false,
  allowAntisocialOrHateUsage:false,
  allowRedistribution:!!options.redistribute,
  creditNotation:options.credit?'required':'unnecessary',
  modification:options.redistribute?'allowModificationRedistribution':'allowModification'
 };
 doc.extensionsUsed=[...new Set([...(doc.extensionsUsed||[]),'VRMC_vrm'])];
 // The VRMC_vrm extension is listed as used rather than required, so generic
 // glTF editors can still read the underlying rigged geometry.
 doc.extensions={...(doc.extensions||{}),VRMC_vrm:{specVersion:'1.0',meta,humanoid:{humanBones},expressions:{preset:expressions}}};
 return encodeGLB(doc,bin);
}
export function verifyVRM(glb){
 const {json}=decodeGLB(glb);
 const vrm=json.extensions?.VRMC_vrm;
 if(!vrm||vrm.specVersion!=='1.0')throw Error('VRM1.0メタデータがありません');
 for(const key of REQUIRED_BONES){
  const id=vrm.humanoid?.humanBones?.[key]?.node;
  if(!Number.isInteger(id)||id<0||id>=json.nodes.length)throw Error('ボーン参照が不正です: '+key);
 }
 const meta=vrm.meta;
 if(!meta?.name||!meta?.authors?.length||meta.licenseUrl!=='https://vrm.dev/licenses/1.0/')throw Error('VRMライセンス情報が不正です');
 return {nodes:json.nodes.length,meshes:json.meshes.length,skins:json.skins?.length||0,expressions:Object.keys(vrm.expressions?.preset||{}),meta};
}
export async function exportGLB(root){
 if(!root)throw Error('モデルがありません');
 const exporter=new GLTFExporter();
 const bytes=await exporter.parseAsync(root,{binary:true,trs:true,onlyVisible:true,maxTextureSize:1024});
 if(!(bytes instanceof ArrayBuffer))throw Error('GLBの書き出しに失敗しました');
 decodeGLB(bytes);return bytes;
}
