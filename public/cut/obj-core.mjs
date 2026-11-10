/** Local-only OBJ parser and deterministic animation math. No third-party source code. */
export const OBJ_LIMIT_BYTES=12*1024*1024;
export const OBJ_MAX_TRIANGLES=45000;
const finite=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,finite(n,a)));
function resolveIndex(token,size){const i=Number.parseInt(token,10);if(!Number.isInteger(i)||i===0)return -1;const x=i>0?i-1:size+i;return x>=0&&x<size?x:-1;}
function normal(a,b,c){const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const l=Math.hypot(...n)||1;return n.map(v=>v/l);}
export function parseOBJ(text,{maxTriangles=OBJ_MAX_TRIANGLES}={}){
 if(typeof text!=='string'||text.length>OBJ_LIMIT_BYTES)throw Error('OBJは12MB以内にしてください');
 const vs=[],ns=[],vertices=[],normals=[];let tris=0;const boundMin=[Infinity,Infinity,Infinity],boundMax=[-Infinity,-Infinity,-Infinity];
 for(const row of text.split(/\r?\n/)){
   const line=row.trim();if(!line||line[0]==='#')continue;
   const t=line.split(/\s+/);
   if(t[0]==='v'&&t.length>=4){const v=t.slice(1,4).map(Number);if(v.every(Number.isFinite)){vs.push(v);for(let k=0;k<3;k++){boundMin[k]=Math.min(boundMin[k],v[k]);boundMax[k]=Math.max(boundMax[k],v[k]);}}}
   if(t[0]==='vn'&&t.length>=4){const v=t.slice(1,4).map(Number);if(v.every(Number.isFinite)){const len=Math.hypot(...v)||1;ns.push(v.map(n=>n/len));}}
   if(t[0]!=='f'||t.length<4)continue;
   const face=t.slice(1).map(str=>{const parts=str.split('/');return {vi:resolveIndex(parts[0],vs.length),ni:parts.length>=3&&parts[2]?resolveIndex(parts[2],ns.length):-1};});
   if(face.length>256||face.some(v=>v.vi<0))continue;
   for(let i=1;i<face.length-1;i++){
     if(++tris>maxTriangles)throw Error(`OBJは${maxTriangles.toLocaleString()}三角形以内にしてください`);
     const tri=[face[0],face[i],face[i+1]],a=vs[tri[0].vi],b=vs[tri[1].vi],c=vs[tri[2].vi],flat=normal(a,b,c);
     for(const p of tri){vertices.push(...vs[p.vi]);normals.push(...(ns[p.ni]||flat));}
   }
 }
 if(!tris)throw Error('OBJに表示可能な面(f)がありません');
 const center=boundMin.map((v,k)=>(v+boundMax[k])/2),diameter=Math.max(...boundMin.map((v,k)=>boundMax[k]-v))||1,scale=2/diameter;
 for(let i=0;i<vertices.length;i+=3)for(let k=0;k<3;k++)vertices[i+k]=(vertices[i+k]-center[k])*scale;
 return {positions:new Float32Array(vertices),normals:new Float32Array(normals),triangleCount:tris,center,originalDiameter:diameter};
}
export const MOTIONS=Object.freeze({turn:'ゆっくり回転',orbit:'カメラ周回',float:'浮遊',static:'静止'});
export function defaultCGScene(modelAssetId,name,start=0,duration=8,id='cg-scene'){
 return {id,modelAssetId,name,start,duration,visible:true,color:'#b4bbc6',background:'transparent',motion:'turn',turns:1,
         yaw:0,pitch:0,x:0,y:0,scale:1,camera:4.5,light:45,keys:[]};
}
export function interpolateKeys(keys,seconds){
 if(!Array.isArray(keys)||!keys.length)return null;
 const ks=keys.filter(k=>Number.isFinite(k.t)).sort((a,b)=>a.t-b.t);
 if(!ks.length)return null;
 if(seconds<=ks[0].t)return {...ks[0]};if(seconds>=ks.at(-1).t)return {...ks.at(-1)};
 for(let i=1;i<ks.length;i++)if(seconds<=ks[i].t){const a=ks[i-1],b=ks[i],w=clamp((seconds-a.t)/(b.t-a.t),0,1),out={};for(const field of ['yaw','pitch','x','y','scale','camera','light'])out[field]=finite(a[field])+(finite(b[field],a[field])-finite(a[field]))*w;return out;}
 return null;
}
export function evaluateCG(scene,globalTime){
 const elapsed=clamp(globalTime-finite(scene.start),0,Math.max(.01,finite(scene.duration,8))),progress=elapsed/Math.max(.01,finite(scene.duration,8));
 const base={yaw:finite(scene.yaw),pitch:finite(scene.pitch),x:finite(scene.x),y:finite(scene.y),scale:clamp(scene.scale??1,.05,8),camera:clamp(scene.camera??4.5,2,20),light:finite(scene.light,45)};
 const keyed=interpolateKeys(scene.keys,elapsed);if(keyed)return {...base,...keyed,t:elapsed};
 if(scene.motion==='turn')base.yaw+=progress*360*finite(scene.turns,1);
 if(scene.motion==='orbit')base.yaw+=progress*360*finite(scene.turns,1);
 if(scene.motion==='float')base.y+=Math.sin(progress*Math.PI*4)*.3;
 return {...base,t:elapsed};
}
export function updateSceneKey(scene,globalTime,props){const t=clamp(globalTime-scene.start,0,scene.duration);scene.keys=Array.isArray(scene.keys)?scene.keys:[];scene.keys=scene.keys.filter(k=>Math.abs(k.t-t)>.03);scene.keys.push({t,...props});scene.keys.sort((a,b)=>a.t-b.t);return scene.keys.length;}
