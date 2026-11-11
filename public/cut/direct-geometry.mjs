import {layoutTitle} from './title-render.mjs';
/* Shared, pure geometry for direct mobile editing of title and individual subtitle cues. */
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(+v)?+v:a));
export const limitAngle=(deg)=>{const x=((Number(deg)||0)+180)%360;return (x<0?x+360:x)-180;};
export function moveBy(start,from,to){return {x:clamp((start.x??.5)+to.x-from.x,-.2,1.2),y:clamp((start.y??.5)+to.y-from.y,-.2,1.2)};}
export function scaleBy(start,baseDistance,newDistance,min=12,max=240){return clamp(start*newDistance/Math.max(baseDistance,1),min,max);}
export function rotateBy(base,initial,next){return limitAngle((base||0)+(next-initial)*180/Math.PI);}
export function containsRotated(box,point,padding=0){const dx=point.x-box.x,dy=point.y-box.y,a=-(box.rotation||0)*Math.PI/180;const x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);return Math.abs(x)<=box.w/2+padding&&Math.abs(y)<=box.h/2+padding;}
export function textBounds(ctx,canvas,text){return layoutTitle(ctx,canvas,text,false);}
export function positionFromClient(client,rect){return {x:(client.clientX-rect.left)/rect.width,y:(client.clientY-rect.top)/rect.height};}
export function pointerGap(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
export function pointerAngle(a,b){return Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX);}
