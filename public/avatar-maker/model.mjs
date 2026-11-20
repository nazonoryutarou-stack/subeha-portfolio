/** AVATAR ATELIER: serializable parametric humanoid authoring model.
 * Does not embed copyrighted preset characters or proprietary assets. */
export const CATEGORY_OPTIONS=Object.freeze({
 hairStyle:[['short','ショート'],['bob','ボブ'],['long','ロング'],['ponytail','ポニーテール'],['twintails','ツインテール']],
 hairPart:[['center','センター'],['side','サイド'],['straight','ぱっつん']],
 topStyle:[['shirt','シャツ'],['hoodie','パーカー'],['jacket','ジャケット'],['dress','ワンピース']],
 bottomStyle:[['pants','パンツ'],['skirt','スカート'],['shorts','ショートパンツ']],
 accessory:[['none','なし'],['glasses','眼鏡'],['catEars','猫耳'],['headphones','ヘッドホン']],
 eyeStyle:[['round','丸目'],['sharp','切れ長'],['sleepy','たれ目']]
});
export const PARAMS=Object.freeze({
 headSize:{title:'頭の大きさ',min:.76,max:1.3,step:.01,base:1,tab:'face'},
 faceWidth:{title:'顔の横幅',min:.75,max:1.28,step:.01,base:1,tab:'face'},
 faceLength:{title:'顎の長さ',min:.78,max:1.25,step:.01,base:1,tab:'face'},
 eyeSize:{title:'目の大きさ',min:.65,max:1.52,step:.01,base:1,tab:'face'},
 eyeSpacing:{title:'目の間隔',min:.75,max:1.35,step:.01,base:1,tab:'face'},
 eyeTilt:{title:'目尻の傾き',min:-.45,max:.45,step:.01,base:0,tab:'face'},
 eyebrowTilt:{title:'眉の角度',min:-.55,max:.55,step:.01,base:0,tab:'face'},
 noseSize:{title:'鼻の大きさ',min:.5,max:1.7,step:.01,base:1,tab:'face'},
 mouthWidth:{title:'口の幅',min:.65,max:1.42,step:.01,base:1,tab:'face'},
 mouthSmile:{title:'口角',min:-.4,max:.55,step:.01,base:.08,tab:'face'},
 earSize:{title:'耳の大きさ',min:.6,max:1.55,step:.01,base:1,tab:'face'},
 hairVolume:{title:'髪のボリューム',min:.62,max:1.55,step:.01,base:1,tab:'hair'},
 hairLength:{title:'髪の長さ',min:.2,max:1.9,step:.01,base:.9,tab:'hair'},
 bangLength:{title:'前髪の長さ',min:.25,max:1.9,step:.01,base:1,tab:'hair'},
 hairWaves:{title:'ウェーブ',min:0,max:1,step:.01,base:.08,tab:'hair'},
 bodyHeight:{title:'身長',min:.79,max:1.23,step:.01,base:1,tab:'body'},
 shoulderWidth:{title:'肩幅',min:.78,max:1.28,step:.01,base:1,tab:'body'},
 torsoWidth:{title:'胴の厚み',min:.75,max:1.25,step:.01,base:1,tab:'body'},
 waistWidth:{title:'腰回り',min:.72,max:1.35,step:.01,base:1,tab:'body'},
 legLength:{title:'脚の長さ',min:.82,max:1.25,step:.01,base:1,tab:'body'},
 armLength:{title:'腕の長さ',min:.82,max:1.18,step:.01,base:1,tab:'body'},
 sleeveLength:{title:'袖の長さ',min:.15,max:1,step:.01,base:.9,tab:'clothes'},
 hemLength:{title:'裾の長さ',min:.6,max:1.38,step:.01,base:1,tab:'clothes'},
 collarHeight:{title:'襟の高さ',min:0,max:1.5,step:.01,base:.5,tab:'clothes'}
});
export const COLOR_FIELDS=Object.freeze([
 {key:'skinColor',label:'肌'}, {key:'hairColor',label:'髪'}, {key:'eyeColor',label:'瞳'},
 {key:'topColor',label:'上着'}, {key:'bottomColor',label:'下衣'},
 {key:'shoeColor',label:'靴'}, {key:'accentColor',label:'装飾'}
]);
export const DEFAULT_AVATAR=Object.freeze({
 format:'avatar-atelier/v1',name:'New Avatar',author:'Avatar creator',
 skinColor:'#f6c8b3',hairColor:'#49312d',eyeColor:'#5585a9',topColor:'#eae9e7',
 bottomColor:'#424c65',shoeColor:'#393b41',accentColor:'#d17d90',
 hairStyle:'bob',hairPart:'side',topStyle:'hoodie',bottomStyle:'skirt',
 accessory:'none',eyeStyle:'round',
 ...Object.fromEntries(Object.entries(PARAMS).map(([k,v])=>[k,v.base]))
});
export const PRESETS=Object.freeze([
 {id:'classic',label:'クラシック',overrides:{}},
 {id:'city',label:'シティ',overrides:{hairStyle:'short',hairColor:'#222b36',eyeColor:'#8d7499',topColor:'#292f3c',bottomColor:'#c7c9d0',topStyle:'jacket',bottomStyle:'pants',mouthSmile:.02}},
 {id:'pastel',label:'パステル',overrides:{hairStyle:'twintails',hairColor:'#e1a2be',eyeColor:'#6c87ca',topColor:'#e5d8ef',bottomColor:'#a49cce',accessory:'catEars',eyeSize:1.25,headSize:1.08}},
 {id:'winter',label:'冬服',overrides:{hairStyle:'long',hairColor:'#ccbca1',eyeColor:'#749873',topStyle:'hoodie',bottomStyle:'pants',topColor:'#a4b5b7',bottomColor:'#443c4d',hairLength:1.3}},
 {id:'school',label:'制服風',overrides:{hairStyle:'ponytail',hairColor:'#332b33',eyeColor:'#9c6a57',topStyle:'jacket',bottomStyle:'skirt',topColor:'#cbd1e0',bottomColor:'#273345',accentColor:'#bc7d81'}}
]);
export const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):min));
const allowedColor=value=>/^#[a-f0-9]{6}$/i.test(String(value||''))?String(value).toLowerCase():null;
export function normalizeAvatar(value={}){
 const out={...DEFAULT_AVATAR};
 for(const [key,def] of Object.entries(PARAMS))out[key]=clamp(value[key]??def.base,def.min,def.max);
 for(const entry of COLOR_FIELDS)out[entry.key]=allowedColor(value[entry.key])||DEFAULT_AVATAR[entry.key];
 for(const [key,options] of Object.entries(CATEGORY_OPTIONS))out[key]=options.some(option=>option[0]===value[key])?value[key]:DEFAULT_AVATAR[key];
 out.name=String(value.name||DEFAULT_AVATAR.name).replace(/[\u0000-\u001f<>]/g,'').slice(0,64)||DEFAULT_AVATAR.name;
 out.author=String(value.author||DEFAULT_AVATAR.author).replace(/[\u0000-\u001f<>]/g,'').slice(0,64)||DEFAULT_AVATAR.author;
 return out;
}
export function applyPreset(presetId,previous={}){
 const p=PRESETS.find(x=>x.id===presetId)||PRESETS[0];
 return normalizeAvatar({...DEFAULT_AVATAR,...p.overrides,name:previous.name||DEFAULT_AVATAR.name,author:previous.author||DEFAULT_AVATAR.author});
}
export function toProject(value){
 const avatar=normalizeAvatar(value);
 return {schema:'avatar-atelier/v1',avatar,generated:new Date().toISOString()};
}
export function fromProject(document){
 if(!document||document.schema!=='avatar-atelier/v1'||!document.avatar)throw Error('このアプリのキャラクター設定ではありません');
 return normalizeAvatar(document.avatar);
}
export function randomAvatar(seed=Math.random()){
 const r=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};
 const randomColor=()=>{const x=Math.floor(70+r()*150),y=Math.floor(45+r()*150),z=Math.floor(60+r()*140);return '#'+[x,y,z].map(t=>t.toString(16).padStart(2,'0')).join('');};
 const base=applyPreset(PRESETS[Math.floor(r()*PRESETS.length)].id);
 const a={...base,hairColor:randomColor(),eyeColor:randomColor(),topColor:randomColor(),bottomColor:randomColor()};
 for(const [key,def] of Object.entries(PARAMS))a[key]=+(def.base+(r()-.5)*(def.max-def.min)*.46).toFixed(2);
 for(const [key,options] of Object.entries(CATEGORY_OPTIONS))a[key]=options[Math.floor(r()*options.length)][0];
 return normalizeAvatar(a);
}
