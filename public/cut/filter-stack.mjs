/* Non-destructive, ordered CSS/Canvas filter pipeline. Self-contained and local. */
export const FILTER_TYPES=Object.freeze({
  monochrome:{label:'白黒',description:'彩度をなくす'},
  sepia:{label:'古い写真',description:'褐色の色調にする'},
  warm:{label:'暖かい色',description:'夕暮れのような色合い'},
  cool:{label:'冷たい色',description:'青みを加える'},
  brightness:{label:'明るく',description:'光を強くする'},
  contrast:{label:'くっきり',description:'明暗差を強める'},
  saturation:{label:'鮮やか',description:'色を濃くする'},
  desaturate:{label:'淡い色',description:'色を薄くする'},
  fade:{label:'色あせ',description:'柔らかな古い質感'},
  blur:{label:'ぼかし',description:'全体を柔らかくする'},
  hue:{label:'色をずらす',description:'色の組み合わせを変える'},
  invert:{label:'ネガ反転',description:'明暗を反転させる'},
});
export const MAX_FILTERS=16;
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(Number(v))?Number(v):lo));
const fmt=n=>String(Math.round(n*1000)/1000);
export function filterStyle(type,amount=1){
 const a=clamp(amount,0,1);
 if(a===0)return '';
 switch(type){
 case 'monochrome':return `grayscale(${fmt(a)})`;
 case 'sepia':return `sepia(${fmt(a)})`;
 case 'warm':return `sepia(${fmt(a*.48)}) saturate(${fmt(1+a*.35)}) hue-rotate(${fmt(-a*13)}deg)`;
 case 'cool':return `sepia(${fmt(a*.12)}) hue-rotate(${fmt(a*160)}deg) saturate(${fmt(1+a*.2)})`;
 case 'brightness':return `brightness(${fmt(1+a*.6)})`;
 case 'contrast':return `contrast(${fmt(1+a*1.0)})`;
 case 'saturation':return `saturate(${fmt(1+a*2.3)})`;
 case 'desaturate':return `saturate(${fmt(1-a)})`;
 case 'fade':return `contrast(${fmt(1-a*.55)}) brightness(${fmt(1+a*.1)})`;
 case 'blur':return `blur(${fmt(a*8)}px)`;
 case 'hue':return `hue-rotate(${fmt(a*180)}deg)`;
 case 'invert':return `invert(${fmt(a)})`;
 default:return '';
 }
}
export function composedFilterStack(stack){
 if(!Array.isArray(stack))return '';
 return stack.slice(0,MAX_FILTERS).filter(x=>x && x.enabled!==false).map(x=>filterStyle(x.type,x.amount??1)).filter(Boolean).join(' ');
}
export function filterCount(stack){return Array.isArray(stack)?stack.filter(x=>x&&x.enabled!==false&&filterStyle(x.type,x.amount??1)).length:0;}
export function addFilter(stack=[],type,amount=.7,id='filter-'+Math.random().toString(36).slice(2)){
 if(!Object.hasOwn(FILTER_TYPES,type))throw Error('不明なフィルターです');
 const rows=Array.isArray(stack)?stack:[];
 if(rows.length>=MAX_FILTERS)throw Error('フィルターは16個まで重ねられます');
 return [...rows,{id,type,amount:clamp(amount,0,1),enabled:true}];
}
export function moveFilter(stack,id,targetIndex){
 const rows=Array.isArray(stack)?stack.slice():[],from=rows.findIndex(x=>x.id===id);
 if(from<0)return rows;
 const to=Math.round(clamp(targetIndex,0,rows.length-1));
 const [item]=rows.splice(from,1);rows.splice(to,0,item);return rows;
}
export function cloneFilterStack(stack){return JSON.parse(JSON.stringify(Array.isArray(stack)?stack:[]));}
