/* Original editable video looks. No bundled proprietary templates or source assets. */
export const EDIT_TEMPLATES=Object.freeze({
 cinema:{name:'CINEMA',subtitle:'映画風のタイトル',ratio:'16:9',filter:'cinema',effect:'vignette',effectAmount:.38,textPreset:'cinematic',size:66,y:.76,backgroundColor:'#05080d'},
 vlog:{name:'VLOG',subtitle:'縦型の日常動画',ratio:'9:16',filter:'punch',effect:'none',textPreset:'minimal',size:62,y:.14,backgroundColor:'#13161d'},
 news:{name:'BREAKING NEWS',subtitle:'速報・解説',ratio:'16:9',filter:'none',effect:'none',textPreset:'news',size:58,y:.84,backgroundColor:'#111926'},
 noir:{name:'NOIR',subtitle:'白黒サスペンス',ratio:'21:9',filter:'mono',effect:'vignette',effectAmount:.7,textPreset:'cinematic',size:58,y:.78,backgroundColor:'#000000'},
 neon:{name:'NEON NIGHT',subtitle:'蛍光色の短編',ratio:'9:16',filter:'cold',effect:'prism',effectAmount:.38,textPreset:'neon',size:66,y:.75,backgroundColor:'#10061b'},
 archive:{name:'FOUND FOOTAGE',subtitle:'古い記録映像風',ratio:'4:5',filter:'vintage',effect:'grain',effectAmount:.55,textPreset:'vintage',size:49,y:.83,backgroundColor:'#15110d'}
});
export function applyEditTemplate(project,key,{id,title,start=0,clipId}={}){
 const template=EDIT_TEMPLATES[key];if(!template)throw Error('不明なテンプレート');
 if(!project||!Array.isArray(project.clips)||!project.clips.length)throw Error('先に素材を読み込んでください');
 if(!id||typeof id!=='string')throw Error('テキストIDが必要です');
 const out=JSON.parse(JSON.stringify(project));
 const clip=out.clips.find(c=>c.id===clipId)||out.clips[0];
 clip.filter=template.filter;clip.effect=template.effect;clip.effectAmount=template.effectAmount??0;
 out.ratio=template.ratio;out.fit='contain';out.backgroundColor=template.backgroundColor;
 out.texts ||= [];
 const name=String(title??'YOUR TITLE').slice(0,160)||'YOUR TITLE';
 // 3s editable overlay, no automatic replacement of user's existing titles or audio.
 out.texts.push({id,text:name,start:Math.max(0,Number(start)||0),duration:3,x:.5,y:template.y,size:template.size,
  color:key==='neon'?'#ff54ae':key==='archive'?'#f8d5a0':'#ffffff',
  outlineColor:key==='neon'?'#601351':'#000000',outlineWidth:key==='news'?.08:.14,
  fontFamily:key==='news'||key==='neon'?'sans':key==='vlog'?'mono':'serif',
  weight:800,box:key==='news',motion:key==='news'?'slide':'fade'});
 return out;
}
