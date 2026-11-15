/* Non-destructive effect-track geometry.
 * Visual reference: user-provided Videoleap Android effect timeline screenshot.
 * No proprietary shader assets or code.
 */
const n=(x,f=0)=>Number.isFinite(Number(x))?Number(x):f;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function effectTimelineEntries(project={}){
 const clips=project?.clips||[];
 const entries=[];
 // Editing clips are sequential; transitions overlap if configured by spans(),
 // so caller may pass externally-calculated clip starts for exact composition.
 for(let i=0,start=0;i<clips.length;i++){
  const c=clips[i];
  const baseDuration=Math.max(0,(n(c.end)-n(c.start))/Math.max(.01,n(c.speed,1)));
  const duration=Math.max(.01,n(c.timelineDuration,baseDuration));
  for(const [fxIndex,fx] of (c.fxStack||[]).entries()){
   const a=clamp(n(fx.start),0,duration),finish=n(fx.end,duration);
   const b=clamp(finish>a?finish:duration,a,duration);
   if(b-a<.0001)continue;
   entries.push({id:fx.id,clipId:c.id,kind:'effect',type:fx.type,start:start+a,end:start+b,
    row:fxIndex,index:fxIndex,visible:fx.disabled!==true,amount:n(fx.amount,.5)});
  }
  start+=duration;
 }
 return entries;
}
/* Keep the effect track relative to exact spans (transitions and speed ramps). */
export function effectEntriesAtSpans(spans=[]){
 const entries=[];
 for(const row of spans){
  const clip=row.clip;if(!clip)continue;
  const start=n(row.start),duration=Math.max(0,n(row.length));
  for(const [index,fx] of (clip.fxStack||[]).entries()){
   const localStart=clamp(n(fx.start),0,duration),end=n(fx.end,duration);
   const localEnd=clamp(end>localStart?end:duration,localStart,duration);
   if(localEnd-localStart<.0001)continue;
   entries.push({id:fx.id,clipId:clip.id,kind:'effect',type:fx.type,
    start:start+localStart,end:start+localEnd,row:index,visible:fx.disabled!==true});
  }
 }
 return entries;
}
