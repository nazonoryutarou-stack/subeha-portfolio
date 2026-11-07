/* Pure, browser-independent pixel operations. No cloud or third-party assets. */
export const bound=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
export function hexRGB(hex){
  const v=/^#?([0-9a-f]{6})$/i.exec(String(hex||''));
  const h=v?v[1]:'00ff00';
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}
export function smoothstep(edge0,edge1,x){
  if(edge0===edge1)return x>=edge1?1:0;
  const t=bound((x-edge0)/(edge1-edge0),0,1);
  return t*t*(3-2*t);
}
export function chromaPixels(imageData, settings={}){
  const data=imageData.data, [kr,kg,kb]=hexRGB(settings.color||'#00ff00');
  const similarity=bound(settings.similarity??0.23,0,1), softness=bound(settings.softness??0.12,.001,1);
  const spill=bound(settings.spill??0.4,0,1);
  const edge0=similarity-softness*.5,edge1=similarity+softness*.5;
  const greenDominant=kg>kr*1.15&&kg>kb*1.15;
  const blueDominant=kb>kr*1.15&&kb>kg*1.15;
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2];
    const distance=Math.hypot(r-kr,g-kg,b-kb)/(255*Math.sqrt(3));
    const alpha=smoothstep(edge0,edge1,distance);
    data[i+3]=Math.round(data[i+3]*alpha);
    // Spill suppression is restricted to edge pixels, not the subject interior.
    if(alpha>.02&&alpha<.98){
      if(greenDominant)data[i+1]=Math.round(g-spill*(1-alpha)*Math.max(0,g-(r+b)/2));
      if(blueDominant)data[i+2]=Math.round(b-spill*(1-alpha)*Math.max(0,b-(r+g)/2));
    }
  }
  return imageData;
}
export function pointInPolygon(x,y,points){
  if(!Array.isArray(points)||points.length<3)return false;
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function trackingPosition(tracking,time){
  const points=tracking?.points;if(!Array.isArray(points)||!points.length)return null;
  const sorted=[...points].sort((a,b)=>a.time-b.time);
  if(time<=sorted[0].time)return {x:sorted[0].x,y:sorted[0].y};
  if(time>=sorted[sorted.length-1].time)return {x:sorted.at(-1).x,y:sorted.at(-1).y};
  for(let i=1;i<sorted.length;i++){const a=sorted[i-1],b=sorted[i];if(time<=b.time){const v=bound((time-a.time)/(b.time-a.time),0,1);return {x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v};}}
  return null;
}
