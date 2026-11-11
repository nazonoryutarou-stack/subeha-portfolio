/* Pure touch geometry; coordinates are in CSS pixels, not video pixels. */
export const clamp=(x,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(x))?Number(x):min));
export function widthFromDrag(width,deltaX,deltaY,rotation,viewWidth){
 const a=rotation*Math.PI/180;
 const projected=deltaX*Math.cos(a)+deltaY*Math.sin(a);
 return clamp(width+projected/Math.max(1,viewWidth),.18,.98);
}
export function nearbyGuides(x,y,tolerance=.012){return {x:Math.abs(x-.5)<tolerance,y:Math.abs(y-.5)<tolerance};}
export function titleChanges(item,patch,isCaption=false){
 const copy=structuredClone(item);
 if(isCaption)copy.style={...(copy.style||{}),...patch};
 else Object.assign(copy,patch);
 return copy;
}
