/* SUBEHA CUT — original non-destructive title animation / keyframe math.
 * Inspired by general schema concepts (timed properties, grouped glyph motion).
 * No proprietary shaders, presets, assets, or serialization are copied.
 */
export const TEXT_MOTION_TYPES=Object.freeze(['none','fade','slide','scale','bounce','typewriter','wave','wiggle','flicker','spin','fall','blur','reveal']);
export const TEXT_MOTION_UNITS=Object.freeze(['glyph','word','line','global']);
export const TEXT_MOTION_EASINGS=Object.freeze(['linear','quadInOut','expoOut','circInOut','backIn','elasticOut','backInOut','circOut']);
export const TITLE_KEYFRAME_FIELDS=Object.freeze(['x','y','size','rotation','opacity','width','letterSpacing','lineHeight','outlineWidth','shadowBlur','shadowX','shadowY','boxOpacity','color','outlineColor','boxColor']);
const num=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
export const limit=(v,min=0,max=1)=>Math.max(min,Math.min(max,num(v,min)));
export function easing(name,t){
 const x=limit(t);
 switch(name){
 case 'quadInOut':case 'ease-in-out':return x<.5?2*x*x:1-2*(1-x)*(1-x);
 case 'expoOut':return x===1?1:1-Math.pow(2,-10*x);
 case 'circInOut':return x<.5?(1-Math.sqrt(1-4*x*x))/2:(Math.sqrt(1-Math.pow(-2*x+2,2))+1)/2;
 case 'backIn':return x*x*(2.70158*x-1.70158);
 case 'elasticOut':return x===0||x===1?x:Math.pow(2,-10*x)*Math.sin((10*x-.75)*2*Math.PI/3)+1;
 case 'backInOut':return x<.5?Math.pow(2*x,2)*((2.59491+1)*2*x-2.59491)/2:
  (Math.pow(2*x-2,2)*((2.59491+1)*(2*x-2)+2.59491)+2)/2;
 case 'circOut':return Math.sqrt(1-(x-1)**2);
 default:return x;
 }
}
function blendHex(a,b,t){
 if(!/^#[\da-f]{6}$/i.test(a)||!/^#[\da-f]{6}$/i.test(b))return t<.5?a:b;
 const pair=(v,i)=>parseInt(v.slice(i,i+2),16);
 const toHex=v=>Math.round(limit(v,0,255)).toString(16).padStart(2,'0');
 return '#'+[1,3,5].map(i=>toHex(pair(a,i)+(pair(b,i)-pair(a,i))*t)).join('');
}
export function interpolateTitle(a,b,t){
 const out={},weight=t;
 for(const key of TITLE_KEYFRAME_FIELDS){
  if(a[key]===undefined&&b[key]===undefined)continue;
  const from=a[key]??b[key],to=b[key]??a[key];
  out[key]=typeof from==='number'&&typeof to==='number'?from+(to-from)*weight:
   typeof from==='string'&&from[0]==='#'?blendHex(from,to,limit(weight)):
   weight<.5?from:to;
 }
 return out;
}
export function titleAt(item={},seconds=0){
 const rows=(Array.isArray(item.titleKeyframes)?item.titleKeyframes:[]).filter(p=>Number.isFinite(+p.time)&&p.time>=0).slice(0,160).sort((a,b)=>a.time-b.time);
 if(!rows.length)return {...item};
 const base={};for(const k of TITLE_KEYFRAME_FIELDS)if(item[k]!==undefined)base[k]=item[k];
 if(rows[0].time>0.00001)rows.unshift({time:0,...base});
 const t=Math.max(0,num(seconds,0));
 if(t<=rows[0].time)return {...item,...rows[0]};
 if(t>=rows.at(-1).time)return {...item,...rows.at(-1)};
 let index=1;while(index<rows.length&&rows[index].time<t)index++;
 const a=rows[index-1],b=rows[index],weight=easing(item.titleEasing||'linear',(t-a.time)/Math.max(0.000001,b.time-a.time));
 return {...item,...interpolateTitle({...base,...a},{...base,...b},weight)};
}
export function upsertTitleKeyframe(item={},seconds=0,changes={}){
 const time=Math.round(Math.max(0,num(seconds,0))*1000)/1000;
 const baseline=titleAt(item,time);
 const snapshot={time};
 for(const key of TITLE_KEYFRAME_FIELDS){
  if(changes[key]!==undefined)snapshot[key]=changes[key];
  else if(baseline[key]!==undefined)snapshot[key]=baseline[key];
 }
 const rows=(Array.isArray(item.titleKeyframes)?item.titleKeyframes:[]).filter(p=>Math.abs(num(p.time,-999)-time)>.001&&Number.isFinite(+p.time));
 rows.push(snapshot);rows.sort((a,b)=>a.time-b.time);
 return rows.slice(-160);
}
export function normalizedTextMotion(raw){
 const v=raw&&typeof raw==='object'?raw:{};
 const type=TEXT_MOTION_TYPES.includes(v.type)?v.type:'none';
 const unit=TEXT_MOTION_UNITS.includes(v.unit)?v.unit:'glyph';
 return {type,unit,direction:['left','right','up','down'].includes(v.direction)?v.direction:'up',
  phase:['in','out','both'].includes(v.phase)?v.phase:'in',
  duration:limit(v.duration??.8,.15,4),stagger:limit(v.stagger??.09,0,.4),
  easing:TEXT_MOTION_EASINGS.includes(v.easing)?v.easing:'quadInOut',reverse:!!v.reverse};
}
/* A time-stable, deterministic state for each glyph/word/line. */
export function motionState(raw,seconds,clipLength,index=0,count=1){
 const c=normalizedTextMotion(raw),age=Math.max(0,num(seconds,0)),total=Math.max(.01,num(clipLength,1));
 const s={alpha:1,scale:1,dx:0,dy:0,rotation:0,blur:0};
 if(c.type==='none')return s;
 const order=c.reverse?Math.max(0,count-1-index):index;
 const delaySpan=Math.min(c.duration*.65,Math.max(0,count-1)*c.stagger);
 const delay=count<=1?0:delaySpan*order/(count-1);
 const run=Math.max(.08,c.duration-delaySpan);
 const pin=limit((age-delay)/run);
 const pout=limit((total-age-delay)/run);
 let p=c.phase==='out'?pout:c.phase==='both'?Math.min(pin,pout):pin;
 p=easing(c.easing,p);
 const hidden=1-p;
 if(c.type==='wave'){s.dy=Math.sin(age*7-index*.65)*Math.max(4,12)*Math.min(1,age*4);return s;}
 if(c.type==='wiggle'){s.dx=Math.sin(age*13+index*2.3)*6;s.rotation=Math.sin(age*8+index)*.045;return s;}
 if(c.type==='typewriter'){const current=c.phase==='out'?pout:c.phase==='both'?Math.min(pin,pout):pin;s.alpha=current>=.85?1:0;return s;}
 if(c.type==='flicker'){s.alpha=limit(p*(.77+.23*Math.sin(age*37+index*11)),0,1);return s;}
 if(c.type==='fade'||c.type==='blur'||c.type==='reveal')s.alpha=limit(p);
 if(c.type==='blur')s.blur=hidden*9;
 if(c.type==='slide'||c.type==='reveal'||c.type==='fall'){
  const d=(c.type==='fall'?80:45)*hidden;
  s.dx=c.direction==='left'?-d:c.direction==='right'?d:0;
  s.dy=c.type==='fall'?d:(c.direction==='up'?-d:c.direction==='down'?d:0);
  if(c.type==='fall')s.alpha=limit(p);
 }
 if(c.type==='scale')s.scale=.3+.7*p;
 if(c.type==='bounce'){const progress=c.phase==='out'?pout:c.phase==='both'?Math.min(pin,pout):pin;s.scale=.25+.75*easing('backInOut',limit(progress));s.alpha=limit(progress*3);}
 if(c.type==='spin'){s.rotation=hidden*Math.PI*1.8;s.scale=.55+.45*p;s.alpha=limit(p);}
 return s;
}
