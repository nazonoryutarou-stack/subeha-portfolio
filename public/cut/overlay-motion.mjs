/* Non-destructive, editable keyframe animations for ordinary overlay layers. */
export const OVERLAY_MOTIONS=Object.freeze({
 none:'アニメーションを解除',fade:'フェードイン',slide:'下から登場',pop:'ポップアップ',fadeOut:'フェードアウト',drift:'ゆっくり移動'
});
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function overlayMotion(layer,preset){
 if(!Object.hasOwn(OVERLAY_MOTIONS,preset))throw Error('不明なアニメーション');
 const out={...layer};if(preset==='none'){out.keyframes=[];return out;}
 const d=Math.max(.1,Number(layer.duration)||3),t=Math.min(.5,d*.33);
 const props={x:clamp(Number(layer.x??.5),0,1),y:clamp(Number(layer.y??.5),0,1),scale:clamp(Number(layer.scale??.5),.05,3),rotation:Number(layer.rotation)||0,opacity:clamp(Number(layer.opacity??1),0,1)};
 const frame=(time,patch={})=>({time:Number(time.toFixed(4)),...props,...patch});
 switch(preset){
  case 'fade':out.keyframes=[frame(0,{opacity:0}),frame(t)];break;
  case 'slide':out.keyframes=[frame(0,{y:clamp(props.y+.16,0,1),opacity:0}),frame(t)];break;
  case 'pop':out.keyframes=[frame(0,{scale:Math.max(.05,props.scale*.65),opacity:0}),frame(t)];break;
  case 'fadeOut':out.keyframes=[frame(0),frame(Math.max(0,d-t)),frame(d,{opacity:0})];break;
  case 'drift':out.keyframes=[frame(0,{x:clamp(props.x-.06,0,1)}),frame(d,{x:clamp(props.x+.06,0,1)})];break;
 }
 return out;
}
