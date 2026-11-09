import {clipSeconds,totalDuration,locateSpan} from './transitions.mjs';
import {clipTransform} from './keyframes.mjs';
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
  '4:5': [960,1200],
  '3:4': [960,1280],
  '21:9': [1260,540],
});
export function clipLength(clip) { return clipSeconds(clip); }
export function duration(clips) { return totalDuration(clips); }
export function locate(clips, seconds) { return locateSpan(clips, seconds); }
export function splitAt(clips,seconds) {
  const at=locate(clips,seconds);
  // A transition is a two-source region; avoid ambiguous destructive splits.
  if (!at || at.transition || at.local<0.07 || at.length-at.local<0.07) return null;
  // Reverse playback walks from source end toward source start. The leading
  // segment therefore owns [cut,end], not [start,cut].
  const reverse=!!at.clip.reverse;
  const first={...structuredClone(at.clip),id:newID(),...(reverse?{start:at.mediaTime}:{end:at.mediaTime})};
  const second={...structuredClone(at.clip),id:newID(),...(reverse?{end:at.mediaTime}:{start:at.mediaTime}),transitionIn:{type:'none',duration:0}};
  if((at.clip.keyframes||[]).length){
    const boundary={...clipTransform(at.clip,at.local),time:at.local};
    first.keyframes=[...at.clip.keyframes.filter(k=>k.time<at.local).map(k=>structuredClone(k)),boundary];
    second.keyframes=[{...boundary,time:0},...at.clip.keyframes.filter(k=>k.time>at.local).map(k=>({...structuredClone(k),time:k.time-at.local}))];
  }
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
