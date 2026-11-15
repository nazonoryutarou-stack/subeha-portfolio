/* Non-destructive effect-track geometry.
 * Visual reference: user-provided Videoleap Android effect timeline screenshot.
 * No proprietary shader assets or code.
 */
const n=(x,f=0)=>Number.isFinite(Number(x))?Number(x):f;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
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
