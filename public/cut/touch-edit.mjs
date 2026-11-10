/* Editing geometry independent of DOM; all source ranges are in source seconds. */
export const clamp = (value,low,high)=>Math.max(low,Math.min(high,Number(value)||0));
export const timelineScroll = (seconds,pixelsPerSecond)=>Math.max(0,Number(seconds)||0)*pixelsPerSecond;
export const timelineTime = (scrollLeft,pixelsPerSecond,total)=>clamp(scrollLeft/Math.max(1,pixelsPerSecond),0,total);
export function rulerStep(pps){return pps>=100?.5:([1,2,5,10,15,30,60,120,300].find(step=>step*pps>=54)||300);}
export function clipTrim(clip,edge,deltaPx,pps,assetSeconds=Infinity,{minimum=.12}={}){
  const rate=Math.max(.01,Number(clip.speed)||1);
  const delta=deltaPx/Math.max(1,pps)*rate;
  const sourceMin=Math.max(0,Number(clip.start)||0), sourceMax=Number(clip.end)||0;
  const minSource=Math.max(.02,minimum*rate);
  const limit=Number.isFinite(assetSeconds)?Math.max(sourceMax,assetSeconds):Infinity;
  const reverse=!!clip.reverse;
  const output={...clip};
  // Left edge is the first *displayed* frame, even during reverse playback.
  if(edge==='left'){
    if(reverse)output.end=clamp(sourceMax-delta,sourceMin+minSource,limit);
    else output.start=clamp(sourceMin+delta,0,sourceMax-minSource);
  }else if(edge==='right'){
    if(reverse)output.start=clamp(sourceMin-delta,0,sourceMax-minSource);
    else output.end=clamp(sourceMax+delta,sourceMin+minSource,limit);
  }
  return output;
}
export function moveClip(clips,id,targetIndex){
  const oldIndex=clips.findIndex(c=>c.id===id);
  if(oldIndex<0||targetIndex<0||targetIndex>=clips.length||oldIndex===targetIndex)return [...clips];
  const result=[...clips];const [item]=result.splice(oldIndex,1);result.splice(targetIndex,0,item);
  // A transition belongs to a particular pair, not the moved clip alone.
  // Reset transitions at changed pair boundaries, preserving unaffected pairs.
  for(let i=1;i<result.length;i++){
    const prev=result[i-1],next=result[i];
    const originallyAdjacent=clips.some((c,j)=>c.id===prev.id&&clips[j+1]?.id===next.id);
    if(!originallyAdjacent)result[i]={...next,transitionIn:{type:'none',duration:0}};
  }
  return result;
}
export function applyOverlayTransform(layer,second,patch){
  const changed={...layer};
  const local=clamp(second-(Number(layer.start)||0),0,Number(layer.duration)||0);
  const keys=Array.isArray(layer.keyframes)?layer.keyframes:[];
  if(!keys.length){Object.assign(changed,patch);return changed;}
  const copy=keys.map(k=>({...k}));const existing=copy.find(k=>Math.abs(k.time-local)<.04);
  if(existing){Object.assign(existing,patch,{time:local});}
  else copy.push({time:local,x:layer.x??.5,y:layer.y??.5,scale:layer.scale??.5,rotation:layer.rotation??0,opacity:layer.opacity??1,...patch});
  changed.keyframes=copy.sort((a,b)=>a.time-b.time);return changed;
}
