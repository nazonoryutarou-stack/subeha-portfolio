/* Non-AI narration-aware volume automation. Same gain calculation for live preview and export. */
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number.isFinite(Number(n))?Number(n):a));
export function normalizeDucking(cfg={}){
 return {enabled:!!cfg?.enabled,level:clamp(cfg?.level??.28,.05,1),attack:clamp(cfg?.attack??.18,.05,2),release:clamp(cfg?.release??.45,.05,5)};
}
export function duckingFactor(time,tracks=[],raw={}){
 const cfg=normalizeDucking(raw);if(!cfg.enabled)return 1;
 let factor=1;
 for(const t of tracks){
  if(t.role!=='voice'||t.muted||Number(t.volume)===0)continue;
  const start=Number(t.start)||0,end=start+Math.max(0,Number(t.duration)||0);
  if(end<=start)continue;
  if(time>=start&&time<end){
   const mix=clamp((time-start)/cfg.attack,0,1);
   factor=Math.min(factor,1-(1-cfg.level)*mix);
  }else if(time>=end&&time<end+cfg.release){
   const mix=clamp((time-end)/cfg.release,0,1);
   factor=Math.min(factor,cfg.level+(1-cfg.level)*mix);
  }
 }
 return factor;
}
export function trackDuckingFactor(track,time,tracks,cfg){
 if(track.role==='voice'||track.role==='effect'||track.duckExempt)return 1;
 return duckingFactor(time,tracks,cfg);
}
