/* Safelisted fonts and editable original title styles. */
export const TEXT_FONTS=Object.freeze({
 sans:'system-ui, sans-serif',serif:'Georgia, "Noto Serif JP", serif',
 mono:'ui-monospace, monospace',round:'"Trebuchet MS", system-ui, sans-serif',
 brush:'"Comic Sans MS", cursive'
});
export const TEXT_PRESETS=Object.freeze({
 cinematic:{name:'CINEMA',fontFamily:'serif',weight:800,color:'#ffffff',outlineColor:'#000000',outlineWidth:.14,box:false,motion:'fade'},
 neon:{name:'NEON',fontFamily:'sans',weight:900,color:'#ff54ae',outlineColor:'#601351',outlineWidth:.2,box:false,motion:'pop'},
 news:{name:'NEWS',fontFamily:'sans',weight:800,color:'#ffffff',outlineColor:'#101219',outlineWidth:.08,box:true,motion:'slide'},
 minimal:{name:'MINIMAL',fontFamily:'mono',weight:500,color:'#ffffff',outlineColor:'#000000',outlineWidth:0,box:false,motion:'fade'},
 vintage:{name:'VINTAGE',fontFamily:'serif',weight:700,color:'#f8d5a0',outlineColor:'#2b201b',outlineWidth:.16,box:false,motion:'fade'}
});
export function styleForText(text={}){
 return {font:TEXT_FONTS[text.fontFamily]||TEXT_FONTS.sans,
  weight:[500,600,700,800,900].includes(Number(text.weight))?Number(text.weight):800,
  color:/^#[0-9a-fA-F]{6}$/.test(text.color)?text.color:'#ffffff',
  outlineColor:/^#[0-9a-fA-F]{6}$/.test(text.outlineColor)?text.outlineColor:'#000000',
  outlineWidth:Math.max(0,Math.min(.35,Number(text.outlineWidth)||0)),
  box:!!text.box};
}
export function applyTextPreset(text,key){
 const p=TEXT_PRESETS[key];return p?{...text,...p,id:text.id,text:text.text,start:text.start,duration:text.duration,x:text.x,y:text.y,size:text.size}:text;
}
