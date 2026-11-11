/** Lightweight local GLB/VRM static mesh preview. No skinning, materials, animation or redistribution. */
import {OBJ_MAX_TRIANGLES} from './obj-core.mjs';
export const VRM_LIMIT_BYTES=48*1024*1024;
const decoder=new TextDecoder('utf-8',{fatal:true});
const finite=n=>Number.isFinite(n);
const COMPONENTS={5120:{size:1,get:'getInt8'},5121:{size:1,get:'getUint8'},5122:{size:2,get:'getInt16'},5123:{size:2,get:'getUint16'},5125:{size:4,get:'getUint32'},5126:{size:4,get:'getFloat32'}};
const LENGTHS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function readGLB(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<20||buffer.byteLength>VRM_LIMIT_BYTES)throw Error('VRM/GLBは48MB以内のファイルを選んでください');
 const view=new DataView(buffer);if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw Error('glTF 2.0のVRM/GLBではありません');
 let cursor=12,json=null,bin=null;
 while(cursor+8<=buffer.byteLength){const len=view.getUint32(cursor,true),type=view.getUint32(cursor+4,true);cursor+=8;
  if(len>buffer.byteLength-cursor)throw Error('GLBのデータが壊れています');const chunk=new Uint8Array(buffer,cursor,len);
  if(type===0x4e4f534a&&!json){try{json=JSON.parse(decoder.decode(chunk).replace(/\0+$/,''));}catch{throw Error('3Dモデルの説明データが壊れています');}}
  if(type===0x004e4942&&!bin)bin=chunk;
  cursor+=len;
 }
 if(!json||!bin)throw Error('モデルの形状データが見つかりません');return {json,bin};
}
export function describeVRMRights(json){const ext=json?.extensions||{},m=ext.VRMC_vrm?.meta||ext.VRM?.meta||null;
 if(!m)return {format:'GLB（利用条件はファイル外で確認）',name:'',authors:[],commercial:'不明',religious:'不明',credit:'要確認',licenseUrl:null};
 const modern=!!ext.VRMC_vrm;
 const rawCommercial=modern?(m.commercialUsage||'personalNonProfit'):(m.commercialUssageName||'未確認');
 const commercial=({personalNonProfit:'個人の非営利利用のみ',personalProfit:'個人の商用利用まで（法人不可）',corporation:'法人の商用利用も許可'})[rawCommercial]||'不明（元の利用規約を確認）';
 // VRM 0.x does not contain the 1.0 political/religious permission flag.
 const religious=modern?(m.allowPoliticalOrReligiousUsage===true?'許可':'不可'):'不明（別途許諾を確認）';
 return {format:modern?'VRM 1.0':'VRM 0.x',name:String(m.name||m.title||''),authors:Array.isArray(m.authors)?m.authors.map(String):[String(m.author||'')].filter(Boolean),commercial, religious,credit:modern?(m.creditNotation||'required'):'要確認',licenseUrl:typeof(m.otherLicenseUrl||m.licenseUrl)==='string'?(m.otherLicenseUrl||m.licenseUrl):null};
}
function readAccessor(doc,bin,index){const access=doc.accessors?.[index],bufferView=doc.bufferViews?.[access?.bufferView];if(!access||!bufferView||bufferView.buffer!==0)throw Error('GLBが外部バッファを参照しています');
 const comp=COMPONENTS[access.componentType],arity=LENGTHS[access.type];if(!comp||!arity||!Number.isInteger(access.count)||access.count<0||access.count>1000000||access.sparse)throw Error('未対応の頂点データ形式です');
 const stride=bufferView.byteStride||comp.size*arity,base=(bufferView.byteOffset||0)+(access.byteOffset||0),end=base+(access.count?access.count-1:0)*stride+arity*comp.size;
 if(stride<arity*comp.size||end>bin.byteLength||base<0)throw Error('頂点データが範囲外です');
 const view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength),out=[];
 for(let i=0;i<access.count;i++){const tuple=[];for(let j=0;j<arity;j++){const v=view[comp.get](base+i*stride+j*comp.size,comp.size>1);if(!finite(v))throw Error('不正な頂点座標です');tuple.push(v);}out.push(tuple);}
 return out;
}
function identity(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
function mul(a,b){const o=new Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)o[col*4+row]+=a[k*4+row]*b[col*4+k];return o;}
function nodeMatrix(n){if(Array.isArray(n.matrix)&&n.matrix.length===16)return n.matrix;
 const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,(2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,(2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,tx,ty,tz,1];
}
function transform(v,m){return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];}
function faceNormal(a,b,c){const ab=b.map((n,i)=>n-a[i]),ac=c.map((n,i)=>n-a[i]);const x=ab[1]*ac[2]-ab[2]*ac[1],y=ab[2]*ac[0]-ab[0]*ac[2],z=ab[0]*ac[1]-ab[1]*ac[0],l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];}
export function parseStaticGLB(buffer,{maxTriangles=OBJ_MAX_TRIANGLES}={}){
 const {json:doc,bin}=readGLB(buffer),meshes=doc.meshes||[];if(!meshes.length)throw Error('メッシュが含まれていません');
 const positions=[],normals=[],mouthDeltas=[];let hasMouth=false;let triangles=0;let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const emit=(a,b,c,deltas=null)=>{if(++triangles>maxTriangles)throw Error(`表示できる面の上限は${maxTriangles.toLocaleString()}です`);const n=faceNormal(a,b,c);for(const [j,v] of [a,b,c].entries()){positions.push(...v);normals.push(...n);mouthDeltas.push(...(deltas?.[j]||[0,0,0]));if(deltas)hasMouth=true;for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}};
 function meshDraw(index,m,nodeIndex){const mesh=meshes[index];if(!mesh)return;for(const p of mesh.primitives||[]){if(p.mode!==undefined&&p.mode!==4)continue;if(p.extensions?.KHR_draco_mesh_compression||p.extensions?.EXT_meshopt_compression)throw Error('圧縮メッシュは未対応です');
 const vertices=readAccessor(doc,bin,p.attributes?.POSITION);if(!vertices.length||vertices[0].length!==3)continue;
 // VRM 1.0 uses node+target-index expression bindings; VRM 0.x uses mesh+target-index.
 const vrm1=doc.extensions?.VRMC_vrm?.expressions?.preset?.aa?.morphTargetBinds||[];
 const vrm0=doc.extensions?.VRM?.blendShapeMaster?.blendShapeGroups||[];
 const group0=vrm0.find(g=>String(g.presetName||'').toLowerCase()==='a');
 const binds=[...vrm1.filter(b=>b.node===nodeIndex),...(group0?.binds||[]).filter(b=>b.mesh===index).map(b=>({...b,weight:Number(b.weight??100)/100}))];
 const mouth=vertices.map(()=>[0,0,0]);let hasPrimitiveMouth=false;
 for(const binding of binds){const target=p.targets?.[binding.index];if(target?.POSITION===undefined)continue;
   const shape=readAccessor(doc,bin,target.POSITION);if(shape.length!==vertices.length)continue;
   const weight=Math.max(0,Math.min(1,Number(binding.weight??1)));
   for(let i=0;i<vertices.length;i++)for(let k=0;k<3;k++)mouth[i][k]+=shape[i][k]*weight;
   hasPrimitiveMouth=true;
 }
 const indices=p.indices!==undefined?readAccessor(doc,bin,p.indices).map(x=>x[0]):vertices.map((_,i)=>i);
 for(let t=0;t+2<indices.length;t+=3){const ids=indices.slice(t,t+3);if(ids.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length))throw Error('三角形の頂点が不正です');emit(...ids.map(i=>transform(vertices[i],m)),hasPrimitiveMouth?ids.map(i=>{
   const v=mouth[i];return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2],m[1]*v[0]+m[5]*v[1]+m[9]*v[2],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]];
 }):null);}
 }}
 const nodes=doc.nodes||[],roots=doc.scenes?.[doc.scene||0]?.nodes||nodes.map((_,i)=>i),visited=new Set();
 function visit(index,parent,depth=0){if(depth>64||visited.has(index))return;const node=nodes[index];if(!node)return;visited.add(index);const m=mul(parent,nodeMatrix(node));if(node.mesh!==undefined)meshDraw(node.mesh,m,index);for(const k of node.children||[])visit(k,m,depth+1);}
 if(nodes.length)roots.forEach(i=>visit(i,identity()));else meshes.forEach((_,i)=>meshDraw(i,identity(),null));
 if(!triangles)throw Error('表示できる三角形がありません');const center=min.map((v,k)=>(v+max[k])/2),diameter=Math.max(...max.map((v,k)=>v-min[k]))||1;
 for(let i=0;i<positions.length;i++){positions[i]=(positions[i]-center[i%3])*2/diameter;mouthDeltas[i]=mouthDeltas[i]*2/diameter;}
 return {mouthDeltas:hasMouth?new Float32Array(mouthDeltas):null,positions:new Float32Array(positions),normals:new Float32Array(normals),triangleCount:triangles,center,originalDiameter:diameter,rights:describeVRMRights(doc)};
}
