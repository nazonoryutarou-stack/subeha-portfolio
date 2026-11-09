/* Non-AI local image retouch. All operations run on ImageData-like RGBA arrays. */
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number(n)||0));
function ensureFrame(frame){
 if(!frame||!Number.isSafeInteger(frame.width)||!Number.isSafeInteger(frame.height)||frame.width<1||frame.height<1||frame.width*frame.height>4_000_000||frame.data?.length!==frame.width*frame.height*4)throw Error('画像のサイズまたはピクセルが不正です');
}
function copyFrame(frame){ensureFrame(frame);return {width:frame.width,height:frame.height,data:new Uint8ClampedArray(frame.data)};}
const pix=(x,y,w)=>4*(y*w+x);
const at=(n,max)=>Math.round(clamp(n,0,max-1));
function blurAlpha(image,radius){
 const {width:w,height:h,data:d}=image,r=Math.min(12,Math.max(0,Math.round(radius)));if(!r)return;
 const tmp=new Uint8ClampedArray(w*h),src=new Uint8ClampedArray(w*h);
 for(let p=0;p<src.length;p++)src[p]=d[p*4+3];
 for(let y=0;y<h;y++){
  let sum=0;for(let x=-r;x<=r;x++)sum+=src[y*w+Math.max(0,Math.min(w-1,x))];
  for(let x=0;x<w;x++){
   tmp[y*w+x]=Math.round(sum/(r*2+1));
   sum+=src[y*w+Math.min(w-1,x+r+1)]-src[y*w+Math.max(0,x-r)];
  }
 }
 for(let x=0;x<w;x++){
  let sum=0;for(let y=-r;y<=r;y++)sum+=tmp[Math.max(0,Math.min(h-1,y))*w+x];
  for(let y=0;y<h;y++){
   d[(y*w+x)*4+3]=Math.round(sum/(r*2+1));
   sum+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x];
  }
 }
}
/** Remove a contiguous region similar in RGB to the tapped seed; returns a new image. */
export function removeConnectedBackground(frame,{x,y,tolerance=52,feather=2}={}){
 const result=copyFrame(frame),{width:w,height:h,data}=result;
 x=at(x,w);y=at(y,h);
 const seed=pix(x,y,w),sr=data[seed],sg=data[seed+1],sb=data[seed+2];
 const limit=clamp(tolerance,0,255)**2*3;
 const selected=new Uint8Array(w*h),queue=new Uint32Array(w*h);let head=0,tail=0;
 const push=(p)=>{if(selected[p])return;selected[p]=1;queue[tail++]=p;};
 push(y*w+x);
 while(head<tail){
  const p=queue[head++],cx=p%w,cy=(p/w)|0;
  const check=(q)=>{if(selected[q])return;const k=q*4,dr=data[k]-sr,dg=data[k+1]-sg,db=data[k+2]-sb;if(dr*dr+dg*dg+db*db<=limit)push(q);};
  if(cx>0)check(p-1);if(cx<w-1)check(p+1);if(cy>0)check(p-w);if(cy<h-1)check(p+w);
 }
 for(let p=0;p<selected.length;p++)if(selected[p])data[p*4+3]=0;
 blurAlpha(result,clamp(feather,0,12));
 return {image:result,removed:tail,ratio:tail/(w*h)};
}
/** Retouch by cloning a clean part of the same image with soft feather edges. */
export function cloneBrush(frame,{targetX,targetY,sourceX,sourceY,radius=24,softness=.35}={}){
 const image=copyFrame(frame),{width:w,height:h,data:d}=image,original=frame.data;
 const tx=at(targetX,w),ty=at(targetY,h),sx=at(sourceX,w),sy=at(sourceY,h);
 const r=Math.max(1,Math.min(500,Math.round(clamp(radius,1,500)))),soft=clamp(softness,0,1);
 let changed=0;
 for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){
  const dist=Math.hypot(ox,oy);if(dist>r)continue;
  const dx=tx+ox,dy=ty+oy,px=sx+ox,py=sy+oy;
  if(dx<0||dx>=w||dy<0||dy>=h||px<0||px>=w||py<0||py>=h)continue;
  const inner=r*(1-soft),alpha=dist<=inner?1:Math.max(0,(r-dist)/Math.max(.001,r-inner));
  const dest=pix(dx,dy,w),from=pix(px,py,w);
  for(let channel=0;channel<4;channel++)d[dest+channel]=Math.round(original[dest+channel]*(1-alpha)+original[from+channel]*alpha);
  changed++;
 }
 return {image,changed};
}
