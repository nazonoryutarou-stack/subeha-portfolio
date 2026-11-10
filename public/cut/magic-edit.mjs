/** Editable, local-only one-tap montage recipes. No ML or copyrighted templates. */
export const MAGIC_MODES = Object.freeze({
  film: {label:'映画風', filter:'cinema', effect:'vignette', amount:.38, transition:'dissolve', overlap:.55},
  rhythm: {label:'テンポ重視', filter:'punch', effect:'prism', amount:.22, transition:'wipe-left', overlap:.2},
  memory: {label:'記録映画風', filter:'vintage', effect:'grain', amount:.3, transition:'fade', overlap:.6},
});
export function magicEdit(project, mode){
 const recipe=MAGIC_MODES[mode];
 if(!recipe)throw Error('不明な自動編集モード');
 if(!project||!Array.isArray(project.clips)||!project.clips.length)throw Error('先に素材を追加してください');
 const out=structuredClone(project);
 for(let i=0;i<out.clips.length;i++){
   const clip=out.clips[i];
   clip.filter=recipe.filter; clip.effect=recipe.effect;clip.effectAmount=recipe.amount;
   if(!i)continue;
   const prev=out.clips[i-1];
   const a=Math.max(0,((prev.end??0)-(prev.start??0))/(prev.speed||1));
   const b=Math.max(0,((clip.end??0)-(clip.start??0))/(clip.speed||1));
   const overlap=Math.min(recipe.overlap,a*.4,b*.4);
   clip.transitionIn=overlap>=.08?{type:recipe.transition,duration:Number(overlap.toFixed(3))}:{type:'none',duration:0};
 }
 return out;
}
