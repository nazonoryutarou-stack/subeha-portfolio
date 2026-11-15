/* Pure parameters for non-destructive layered effects and time-varying strength. */
import {OPTICAL_TYPES,OPTICAL_LABELS} from './optical-fx.mjs';
export const FX_TYPES=Object.freeze(['vignette','pixelate','prism','scanlines','grain','lightleak','bloom','letterbox','duotone','ghost','shake','offset','oldfilm','mosaic','pattern','scan',...OPTICAL_TYPES]);
export const FX_LABELS=Object.freeze({vignette:'周辺減光',pixelate:'ピクセル化',prism:'簡易プリズム',scanlines:'走査線',grain:'フィルム粒子',lightleak:'光漏れ',bloom:'柔らかな発光',letterbox:'映画スコープ',duotone:'2色調',ghost:'残像',shake:'手ぶれ',offset:'画面オフセット',oldfilm:'古いフィルム',mosaic:'モザイク',pattern:'幾何学模様',scan:'走査線2',...OPTICAL_LABELS});
export const FX_LOOKS=Object.freeze({
 analog:{name:'アナログ映像',grade:{exposure:0,warmth:18,fade:20,saturation:-10},effects:[['grain',.38],['scanlines',.26],['ghost',.2]]},
 dream:{name:'夢幻',grade:{exposure:8,warmth:-16,fade:10,saturation:18},effects:[['bloom',.45],['lightleak',.25]]},
 monochrome:{name:'白黒映画',grade:{saturation:-100,contrast:16,fade:9},effects:[['grain',.23],['vignette',.25]]},
 synthetic:{name:'人工色彩',grade:{saturation:48,contrast:18,warmth:-28},effects:[['prism',.25],['duotone',.38]]},
 refracted:{name:'屈折する世界',grade:{contrast:16,saturation:38,warmth:-12},effects:[['lenswarp',.45],['chromatic',.35],['halation',.24]]},
 broadcast:{name:'異常放送',grade:{contrast:27,fade:8,saturation:-18},effects:[['rgb',.4],['displace',.28],['scanlines',.35]]},
 anamorphic:{name:'超横長レンズ',grade:{exposure:4,contrast:20,saturation:4},effects:[['anamorphic',.55],['halation',.32],['vignette',.15]]}
});
const clamp=(x,min,max)=>Math.min(max,Math.max(min,Number.isFinite(+x)?+x:0));
export function buildGradeFilter(grade={}){
 if(!grade||typeof grade!=='object')return 'none';
 const exposure=clamp(grade.exposure,-100,100),contrast=clamp(grade.contrast,-80,100),saturation=clamp(grade.saturation,-100,200),warmth=clamp(grade.warmth,-100,100),fade=clamp(grade.fade,0,100);
 const list=[];
 if(exposure)list.push(`brightness(${(1+exposure/130).toFixed(4)})`);
 if(contrast||fade)list.push(`contrast(${clamp(1+contrast/130-fade/180,.2,2.2).toFixed(4)})`);
 if(saturation)list.push(`saturate(${clamp(1+saturation/100,0,3).toFixed(4)})`);
 if(warmth){list.push(`sepia(${(Math.abs(warmth)/250).toFixed(4)})`);list.push(`hue-rotate(${(warmth<0?-42:5)}deg)`);}
 return list.length?list.join(' '):'none';
}
export function fxAmountAt(fx,time){
 if(!fx||fx.disabled)return 0;
 const t=Math.max(0,Number(time)||0),start=Math.max(0,Number(fx.start)||0),end=Number(fx.end);
 if(t<start||(Number.isFinite(end)&&end>start&&t>end))return 0;
 const keys=[...(fx.keys||[])].filter(k=>Number.isFinite(+k.time)&&Number.isFinite(+k.amount)).sort((a,b)=>a.time-b.time);
 if(!keys.length)return clamp(fx.amount??.5,0,1);
 if(t<=keys[0].time)return clamp(keys[0].amount,0,1);
 if(t>=keys.at(-1).time)return clamp(keys.at(-1).amount,0,1);
 for(let i=1;i<keys.length;i++)if(t<=keys[i].time){const a=keys[i-1],b=keys[i],p=(t-a.time)/(b.time-a.time);return clamp(a.amount+(b.amount-a.amount)*p,0,1);}
 return clamp(fx.amount??.5,0,1);
}
export function addFx(stack=[],type,amount=.5,id='fx-'+Math.random().toString(36).slice(2)){
 if(!FX_TYPES.includes(type))throw Error('Unknown FX type');
 return [...stack,{id,type,amount:clamp(amount,0,1),start:0,keys:[]}].slice(0,10);
}
export function applyLookToClip(clip,key){
 const look=FX_LOOKS[key];if(!look)return clip;
 return {...clip,grade:{...(clip.grade||{}),...look.grade},fxStack:look.effects.map(([type,amount],i)=>({id:`${key}-${Date.now()}-${i}`,type,amount,start:0,keys:[]}))};
}
