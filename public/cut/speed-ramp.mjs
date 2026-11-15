/* SUBEHA CUT original piecewise-linear speed ramp. Curve positions are fractions
 * of played source distance (0=start in playback direction; 1=end).
 * Time = exact integral of source distance / speed. No frame-count approximation.
 * Inspired by the concept of speed control points, not vendor algorithms. */
export const RAMP_PRESETS=Object.freeze({
 flat:{label:'一定',values:[1,1,1,1,1]},
 montage:{label:'モンタージュ',values:[2.7,.7,2.9,.75,2.6]},
 hero:{label:'ヒーロー',values:[1.4,.3,.3,.75,1.6]},
 bullet:{label:'弾丸',values:[3.2,2,.35,2.2,3.4]},
 jump:{label:'ジャンプ',values:[1,1,3.8,1,1]},
 flashIn:{label:'急加速',values:[4,2.7,1.2,1,1]},
 flashOut:{label:'急減速',values:[1,1,1.2,2.7,4]},
 whirlwind:{label:'旋回',values:[1,2.4,.7,2.8,1]},
 swing:{label:'スイング',values:[1.8,.45,2.1,.45,1.8]},
 drift:{label:'ドリフト',values:[.7,.45,.85,1.4,1.7]},
 sprint:{label:'スプリント',values:[1.2,2,3.2,3.6,3.6]},
 rampUp:{label:'徐々に加速',values:[.45,.7,1,1.65,3]},
 rampDown:{label:'徐々に減速',values:[3,1.65,1,.7,.45]},
 windDown:{label:'クールダウン',values:[2.7,1.9,1.15,.65,.5]},
 windUp:{label:'ビルドアップ',values:[.5,.65,1.15,1.9,2.7]}
});
const finite=(x,f)=>Number.isFinite(Number(x))?Number(x):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
export function makeSpeedRamp(preset='hero'){
 const data=RAMP_PRESETS[preset]||RAMP_PRESETS.hero;
 return {preset,points:data.values.map((speed,i)=>({at:i/(data.values.length-1),speed}))};
}
export function rampPoints(ramp){
 if(!ramp||!Array.isArray(ramp.points))return [{at:0,speed:1},{at:1,speed:1}];
 const arr=ramp.points.slice(0,24).filter(p=>p&&Number.isFinite(+p.at)&&Number.isFinite(+p.speed))
  .map(p=>({at:clamp(p.at,0,1),speed:clamp(p.speed,.25,4)}))
  .sort((a,b)=>a.at-b.at);
 const uniq=[];
 for(const p of arr)if(uniq.length&&Math.abs(uniq.at(-1).at-p.at)<1e-7)uniq[uniq.length-1]=p;else uniq.push(p);
 if(!uniq.length)return [{at:0,speed:1},{at:1,speed:1}];
 if(uniq[0].at>0)uniq.unshift({at:0,speed:uniq[0].speed});
 if(uniq.at(-1).at<1)uniq.push({at:1,speed:uniq.at(-1).speed});
 return uniq.length===1?[{at:0,speed:uniq[0].speed},{at:1,speed:uniq[0].speed}]:uniq;
}
export function speedAtPosition(ramp,u){
 const p=rampPoints(ramp),x=clamp(u,0,1);
 for(let i=1;i<p.length;i++)if(x<=p[i].at){
  const a=p[i-1],b=p[i],w=(x-a.at)/Math.max(1e-9,b.at-a.at);
  return a.speed+(b.speed-a.speed)*w;
 }
 return p.at(-1).speed;
}
function integratedFraction(a,b,weight=1){
 const d=b.at-a.at,s0=a.speed,s1=b.speed,delta=s1-s0;
 if(d<=0)return 0;
 if(Math.abs(delta)<1e-8)return d*weight/s0;
 return d*Math.log((s0+delta*weight)/s0)/delta;
}
function inverseFraction(a,b,area){
 const d=b.at-a.at,delta=b.speed-a.speed;
 if(d<=0)return 0;
 if(Math.abs(delta)<1e-8)return clamp(area*a.speed/d,0,1);
 return clamp(a.speed*Math.expm1(delta*area/d)/delta,0,1);
}
function norm(clip){
 const source=Math.max(0,finite(clip.end,0)-finite(clip.start,0));
 const base=clamp(clip.speed??1,.25,4);
 return {source,base,points:rampPoints(clip.speedRamp)};
}
export function rampDuration(clip){
 const {source,base,points}=norm(clip);
 if(!source)return 0;
 let integral=0;for(let i=1;i<points.length;i++)integral+=integratedFraction(points[i-1],points[i]);
 return source*integral/base;
}
export function rampPositionAtLocal(clip,local){
 const {source,base,points}=norm(clip);
 if(!source)return 0;
 let elapsed=clamp(local,0,rampDuration(clip))*base/source;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],area=integratedFraction(a,b);
  if(elapsed<=area+1e-10)return clamp(a.at+(b.at-a.at)*inverseFraction(a,b,Math.max(0,elapsed)),0,1);
  elapsed-=area;
 }
 return 1;
}
export function rampMediaTime(clip,local){
 const pos=rampPositionAtLocal(clip,local);
 const {source}=norm(clip);
 return clip.reverse?Number(clip.end)-source*pos:Number(clip.start)+source*pos;
}
export function rampPlaybackRate(clip,local){
 const pos=rampPositionAtLocal(clip,local);
 return norm(clip).base*speedAtPosition(clip.speedRamp,pos);
}
export function cutSpeedRamp(ramp,sourceProgress){
 if(!ramp)return [null,null];
 const x=clamp(sourceProgress,0,1),points=rampPoints(ramp);
 if(x<=1e-8||x>=1-1e-8)return [null,null];
 const speed=speedAtPosition(ramp,x),left=[{at:0,speed:points[0].speed}],right=[{at:0,speed}];
 for(const p of points){if(p.at>0&&p.at<x)left.push({at:p.at/x,speed:p.speed});
  if(p.at>x&&p.at<1)right.push({at:(p.at-x)/(1-x),speed:p.speed});}
 left.push({at:1,speed});right.push({at:1,speed:points.at(-1).speed});
 return [{preset:ramp.preset||'custom',points:left},{preset:ramp.preset||'custom',points:right}];
}
