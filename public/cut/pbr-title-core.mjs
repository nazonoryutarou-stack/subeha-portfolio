/* Original SUBEHA CUT material controls; values informed by generic material
 * concepts in the user's audited template schema, not proprietary assets.
 * Intended for embossed 2.5D text, not volumetric text meshes. */
export const PBR_TITLE_PRESETS=Object.freeze({
 chrome:{label:'クローム',color:'#d7e7f4',metallic:.98,roughness:.1,bumpiness:.65,environment:.8,depth:12,bevel:4},
 gold:{label:'黄金',color:'#ffcb55',metallic:.94,roughness:.19,bumpiness:.55,environment:.72,depth:15,bevel:4},
 foil:{label:'箔',color:'#d5bbff',metallic:.83,roughness:.3,bumpiness:.35,environment:.65,depth:6,bevel:2.5},
 vinyl:{label:'ビニール',color:'#e64d89',metallic:.12,roughness:.28,bumpiness:.5,environment:.47,depth:10,bevel:4},
 hologram:{label:'ホログラム',color:'#68e7fc',metallic:.69,roughness:.18,bumpiness:.65,environment:.95,depth:9,bevel:3},
 lava:{label:'溶岩',color:'#fc603c',metallic:.25,roughness:.67,bumpiness:.85,environment:.48,depth:18,bevel:6},
 ceramic:{label:'陶器',color:'#e7e4d8',metallic:0,roughness:.3,bumpiness:.43,environment:.58,depth:9,bevel:4},
 obsidian:{label:'黒曜石',color:'#515d81',metallic:.46,roughness:.15,bumpiness:.63,environment:.82,depth:17,bevel:4}
});
export const PBR_TITLE_KEYFRAME_FIELDS=Object.freeze([
 'pbrMetallic','pbrRoughness','pbrBumpiness','pbrEnvironment','pbrDepth','pbrBevel',
 'pbrSpin','pbrLight1Angle','pbrLight1Elevation','pbrLight1Intensity',
 'pbrLight2Angle','pbrLight2Elevation','pbrLight2Intensity','pbrColor',
 'pbrLight1Color','pbrLight2Color'
]);
const number=(v,f)=>v==null?f:Number.isFinite(Number(v))?Number(v):f;
export const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
const color=(v,def)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:def;
export function normalizedPbrTitle(item={}){
 const key=Object.hasOwn(PBR_TITLE_PRESETS,item.pbrStyle)?item.pbrStyle:'chrome';
 const base=PBR_TITLE_PRESETS[key];
 const raw=(name,f,min,max)=>bound(number(item[name],f),min,max);
 return {
  enabled:item.pbrEnabled===true,style:key,
  color:color(item.pbrColor,base.color),
  metallic:raw('pbrMetallic',base.metallic,0,1),
  roughness:raw('pbrRoughness',base.roughness,.04,1),
  bumpiness:raw('pbrBumpiness',base.bumpiness,0,1),
  environment:raw('pbrEnvironment',base.environment,0,1),
  depth:raw('pbrDepth',base.depth,0,36),
  bevel:raw('pbrBevel',base.bevel,.5,12),
  spin:raw('pbrSpin',0,-1,1),
  light1:{angle:raw('pbrLight1Angle',315,0,360),elevation:raw('pbrLight1Elevation',.8,.05,1),
   intensity:raw('pbrLight1Intensity',.92,0,2),color:color(item.pbrLight1Color,'#ffffff')},
  light2:{angle:raw('pbrLight2Angle',135,0,360),elevation:raw('pbrLight2Elevation',.45,.05,1),
   intensity:raw('pbrLight2Intensity',.65,0,2),color:color(item.pbrLight2Color,'#ffbad1')}
 };
}
export function applyPbrPreset(item,key){
 if(!Object.hasOwn(PBR_TITLE_PRESETS,key))return {...item};
 const d=PBR_TITLE_PRESETS[key];
 // Explicitly reset only material fields so changing presets yields a
 // predictable appearance, without altering text, position or timing.
 return {...item,pbrEnabled:true,pbrStyle:key,pbrColor:d.color,
  pbrMetallic:d.metallic,pbrRoughness:d.roughness,pbrBumpiness:d.bumpiness,
  pbrEnvironment:d.environment,pbrDepth:d.depth,pbrBevel:d.bevel};
}
export function pbrHexRgb(hex){
 const valid=color(hex,'#ffffff');
 return [1,3,5].map(i=>parseInt(valid.slice(i,i+2),16)/255);
}
