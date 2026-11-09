/* Time-overlap transitions. Incoming clip owns transitionIn; exact project time is shortened by overlap. */
export const TRANSITIONS = Object.freeze(['none','dissolve','fade','wipe-left','wipe-right','slide-left','zoom']);
export function clipSeconds(clip) { return Math.max(0,(Number(clip.end)-Number(clip.start))/(Number(clip.speed)||1)); }
export function transitionAt(clips,index) {
  if(index<=0 || index>=clips.length)return {type:'none',duration:0};
  const incoming=clips[index].transitionIn||{};
  const type=TRANSITIONS.includes(incoming.type)?incoming.type:'none';
  if(type==='none')return {type,duration:0};
  const max=Math.min(clipSeconds(clips[index-1])*.45,clipSeconds(clips[index])*.45,3);
  return {type,duration:Math.max(0,Math.min(Number(incoming.duration)||0,max))};
}
export function spans(clips) {
  let start=0;return clips.map((clip,i)=>{
    const transition=transitionAt(clips,i);
    if(i)start=start+clipSeconds(clips[i-1])-transition.duration;
    return {clip,index:i,start,end:start+clipSeconds(clip),length:clipSeconds(clip),transition};
  });
}
export function totalDuration(clips){const items=spans(clips);return items.length?items[items.length-1].end:0;}
export function locateSpan(clips,seconds) {
  if(!Number.isFinite(seconds)||seconds<0||!clips.length)return null;
  const all=spans(clips),time=Math.min(seconds,Math.max(0,totalDuration(clips)-.000001));
  let i=0;while(i+1<all.length && all[i+1].start<=time)i++;
  const row=all[i],local=Math.max(0,Math.min(row.length,time-row.start));
  const at={clip:row.clip,index:i,offset:row.start,local,length:row.length,mediaTime:row.clip.reverse?Number(row.clip.end)-local*(Number(row.clip.speed)||1):Number(row.clip.start)+local*(Number(row.clip.speed)||1)};
  if(i>0&&row.transition.duration>0&&local<row.transition.duration){
    const from=all[i-1],fromLocal=time-from.start;
    at.transition={type:row.transition.type,duration:row.transition.duration,progress:local/row.transition.duration,fromClip:from.clip,fromLocal,fromMediaTime:from.clip.reverse?Number(from.clip.end)-fromLocal*(Number(from.clip.speed)||1):Number(from.clip.start)+fromLocal*(Number(from.clip.speed)||1)};
  }
  return at;
}
export function transitionProgress(at){return at?.transition?Math.min(1,Math.max(0,at.transition.progress)):1;}
