/* SUBEHA CUT v0.8: deterministic CPU video matting and clone-patch repair.
 * Local pixel ops, not semantic AI segmentation or generative inpainting.
 * The same function is used during preview and MediaRecorder canvas export.
 */
import {cloneBrush} from './image-retouch.mjs';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(Number(v))?Number(v):a));
const hex=(color)=>/^#[0-9a-f]{6}$/i.test(String(color))?String(color).toLowerCase():'#00ff00';
const rgb=(color)=>[1,3,5].map(i=>parseInt(hex(color).slice(i,i+2),16));
const pixel=(w,x,y)=>(Math.round(y)*w+Math.round(x))*4;
function frameCopy(frame){
 const {width:w,height:h,data}=frame||{};
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>1_000_000||data?.length!==w*h*4)throw Error('不正な映像フレームです');
 return {width:w,height:h,data:new Uint8ClampedArray(data)};
}
export function sampleFrameColor(frame,x,y){
 const f=frameCopy(frame),cx=Math.round(clamp(x,0,1)*(f.width-1)),cy=Math.round(clamp(y,0,1)*(f.height-1)),p=pixel(f.width,cx,cy);
 return '#'+[f.data[p],f.data[p+1],f.data[p+2]].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function normalizedRetouch(raw){
 if(!raw||typeof raw!=='object'||!['matte','clone'].includes(raw.mode))return null;
 const source={x:clamp(raw.source?.x??.65,0,1),y:clamp(raw.source?.y??.5,0,1)};
 const keys=(Array.isArray(raw.keyframes)?raw.keyframes:[]).filter(k=>Number.isFinite(Number(k.time))&&Number.isFinite(Number(k.x))&&Number.isFinite(Number(k.y))).slice(0,200).map(k=>({time:clamp(k.time,0,7200),x:clamp(k.x,0,1),y:clamp(k.y,0,1)})).sort((a,b)=>a.time-b.time);
 return {enabled:raw.enabled!==false,mode:raw.mode,color:hex(raw.color),tolerance:clamp(raw.tolerance??42,2,120),feather:clamp(raw.feather??2,0,6),x:clamp(raw.x??.5,0,1),y:clamp(raw.y??.5,0,1),source,radius:clamp(raw.radius??.06,.003,.35),quality:([360,512,720].includes(Number(raw.quality))?Number(raw.quality):512),start:clamp(raw.start??0,0,7200),end:clamp(raw.end??7200,0,7200),keyframes:keys};
}
export function retouchPosition(config,local){
 const c=normalizedRetouch(config);if(!c)return null;
 const t=clamp(local,0,7200),points=c.keyframes;
 if(!points.length)return {x:c.x,y:c.y};
 if(t<=points[0].time)return {x:points[0].x,y:points[0].y};
 if(t>=points.at(-1).time)return {x:points.at(-1).x,y:points.at(-1).y};
 for(let i=1;i<points.length;i++)if(t<=points[i].time){
  const a=points[i-1],b=points[i],p=(t-a.time)/Math.max(.00001,b.time-a.time);
  return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p};
 }
 return {x:c.x,y:c.y};
}
function blurMatte(alpha,w,h,r){
 const rad=Math.round(clamp(r,0,6));if(rad<1)return alpha;
 const t=new Uint8ClampedArray(alpha.length),out=new Uint8ClampedArray(alpha.length),span=rad*2+1;
 // Clamp edge taps rather than letting alpha leak beyond canvas borders.
 for(let y=0;y<h;y++){
  let sum=0;for(let x=-rad;x<=rad;x++)sum+=alpha[y*w+Math.min(w-1,Math.max(0,x))];
  for(let x=0;x<w;x++){
   t[y*w+x]=Math.round(sum/span);
   sum+=alpha[y*w+Math.min(w-1,x+rad+1)]-alpha[y*w+Math.max(0,x-rad)];
  }
 }
 for(let x=0;x<w;x++){
  let sum=0;for(let y=-rad;y<=rad;y++)sum+=t[Math.min(h-1,Math.max(0,y))*w+x];
  for(let y=0;y<h;y++){
   out[y*w+x]=Math.round(sum/span);
   sum+=t[Math.min(h-1,y+rad+1)*w+x]-t[Math.max(0,y-rad)*w+x];
  }
 }
 return out;
}
export function removeBorderBackground(frame,{color='#00ff00',tolerance=42,feather=2}={}){
 const result=frameCopy(frame),{width:w,height:h,data}=result,[r,g,b]=rgb(color);
 const threshold=(clamp(tolerance,2,120)**2)*3,visited=new Uint8Array(w*h),queue=new Uint32Array(w*h);
 let head=0,tail=0;
 const matches=index=>{const p=index*4,dr=data[p]-r,dg=data[p+1]-g,db=data[p+2]-b;return dr*dr+dg*dg+db*db<=threshold;};
 const push=i=>{if(visited[i]||!matches(i))return;visited[i]=1;queue[tail++]=i;};
 for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
 for(let y=1;y<h-1;y++){push(y*w);push(y*w+w-1);}
 while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;
  if(x>0)push(p-1);if(x<w-1)push(p+1);if(y>0)push(p-w);if(y<h-1)push(p+w);
 }
 const alpha=new Uint8ClampedArray(w*h);
 for(let i=0;i<alpha.length;i++)alpha[i]=visited[i]?0:data[i*4+3];
 const blurred=blurMatte(alpha,w,h,feather);
 for(let i=0;i<alpha.length;i++){
  data[i*4+3]=blurred[i];
  // Reduce green/blue fringing on semi-transparent edges only.
  if(blurred[i]>0&&blurred[i]<255){const p=i*4,dominant=g>r*1.2&&g>b*1.2?1:b>r*1.2&&b>g*1.2?2:-1;
   if(dominant>0)data[p+dominant]=Math.min(data[p+dominant],Math.round((data[p]+data[p+((dominant===1)?2:1)])/2+35));
  }
 }
 return {image:result,removed:tail,ratio:tail/(w*h)};
}
export function retouchFrame(frame,rawConfig,local=0){
 const cfg=normalizedRetouch(rawConfig);if(!cfg||!cfg.enabled||local<cfg.start||local>cfg.end)return {image:frame,changed:false};
 if(cfg.mode==='matte'){const r=removeBorderBackground(frame,cfg);return {...r,changed:true};}
 const pos=retouchPosition(cfg,local),w=frame.width,h=frame.height;
 const sourceX=pos.x+cfg.source.x-cfg.x,sourceY=pos.y+cfg.source.y-cfg.y;
 const brush=cloneBrush(frame,{targetX:pos.x*(w-1),targetY:pos.y*(h-1),sourceX:clamp(sourceX,0,1)*(w-1),sourceY:clamp(sourceY,0,1)*(h-1),radius:cfg.radius*w,softness:.45});
 return {image:brush.image,changed:brush.changed>0,pixels:brush.changed};
}
