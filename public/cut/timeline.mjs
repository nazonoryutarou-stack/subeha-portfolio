export function newID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i=0;i<16;i++) bytes[i] = Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const s=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
}
export const RATIOS = Object.freeze({
  '9:16': [720,1280],
  '16:9': [1280,720],
  '1:1': [960,960],
});
export function clipLength(clip) {
  const speed = Number(clip.speed) || 1;
  return Math.max(0, (Number(clip.end) - Number(clip.start)) / speed);
}
export function duration(clips) {
  return clips.reduce((sum,c)=>sum+clipLength(c),0);
}
export function locate(clips, seconds) {
  const total=duration(clips);
  if (!clips.length || !Number.isFinite(seconds) || seconds<0) return null;
  const t=Math.min(seconds,Math.max(0,total-0.000001));
  let accumulated=0;
  for(let index=0;index<clips.length;index++) {
    const clip=clips[index],len=clipLength(clip);
    if(t<accumulated+len || index===clips.length-1) {
      const local=Math.max(0,Math.min(len,t-accumulated));
      return {clip,index,offset:accumulated,local,mediaTime:Number(clip.start)+local*(Number(clip.speed)||1),length:len};
    }
    accumulated+=len;
  }
  return null;
}
export function splitAt(clips,seconds) {
  const at=locate(clips,seconds);
  if (!at || at.local<0.07 || at.length-at.local<0.07) return null;
  const first={...at.clip,id:newID(),end:at.mediaTime};
  const second={...at.clip,id:newID(),start:at.mediaTime};
  const result=[...clips]; result.splice(at.index,1,first,second);
  return {clips:result,first,second};
}
export function clampTime(t,clips){return Math.max(0,Math.min(duration(clips),Number(t)||0));}
export function formatClock(seconds){
  if(!Number.isFinite(seconds)) return '00:00';
  const n=Math.max(0,Math.floor(seconds));
  return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
}
export function safeName(s){return String(s||'untitled').replace(/[\\/:*?"<>|\u0000-\u001F]/g,'_').slice(0,70)||'untitled';}
