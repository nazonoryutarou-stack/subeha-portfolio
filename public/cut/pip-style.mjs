/** Original, editable PIP frame styles; geometry is independent of Canvas2D. */
export const PIP_PRESETS=Object.freeze({
  upperRight:{label:'右上',x:.76,y:.29,scale:.48,radius:.065,border:.003,shadow:.028},
  lowerRight:{label:'右下',x:.76,y:.72,scale:.46,radius:.05,border:.003,shadow:.025},
  lowerLeft:{label:'左下',x:.24,y:.72,scale:.46,radius:.05,border:.003,shadow:.025},
  center:{label:'中央',x:.5,y:.5,scale:.65,radius:.03,border:.003,shadow:.02},
  wide:{label:'ワイド',x:.5,y:.34,scale:.87,radius:.025,border:.005,shadow:.03},
});
const bound=(x,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(x))?Number(x):a));
export function normalizePipStyle(value={}){
 return {radius:bound(value?.radius??.04,0,.3),border:bound(value?.border??0,0,.03),shadow:bound(value?.shadow??0,0,.08),borderColor:/^#[0-9a-f]{6}$/i.test(value?.borderColor||'')?value.borderColor:'#ffffff'};
}
export function applyPipPreset(layer,key){
 const preset=PIP_PRESETS[key];if(!preset)throw Error('不明な小窓レイアウト');
 return {...layer,x:preset.x,y:preset.y,scale:preset.scale,pipStyle:{...normalizePipStyle(layer.pipStyle),radius:preset.radius,border:preset.border,shadow:preset.shadow}};
}
export function drawPipFrame(ctx,img,w,h,frame,canvasWidth){
 const cfg=normalizePipStyle(frame),r=Math.min(w,h)*cfg.radius;
 const shape=()=>{ctx.beginPath();if(typeof ctx.roundRect==='function')ctx.roundRect(-w/2,-h/2,w,h,r);else ctx.rect(-w/2,-h/2,w,h);};
 if(cfg.shadow>0){ctx.save();ctx.shadowBlur=canvasWidth*cfg.shadow;ctx.shadowOffsetY=canvasWidth*cfg.shadow*.33;ctx.shadowColor='rgba(0,0,0,.78)';ctx.fillStyle='#141414';shape();ctx.fill();ctx.restore();}
 ctx.save();shape();ctx.clip();ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
 if(cfg.border>0){ctx.save();ctx.strokeStyle=cfg.borderColor;ctx.lineWidth=Math.max(1,canvasWidth*cfg.border);shape();ctx.stroke();ctx.restore();}
}
