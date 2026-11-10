/* Portable render plan: manifests capability boundaries; does not claim native export is available. */
export const ENGINE_ROUTE=Object.freeze({
  'obj-webgl':'subeha-web','video-overlay':'subeha-web','captions':'subeha-web',
  'native-mp4':'clearcut','native-multi-track':'clearcut',
  'ai-video':'ltx-desktop','ai-retake':'ltx-desktop'
});
export function exportPlan(project={}){
 const clips=Array.isArray(project.clips)?project.clips:[];
 const segments=clips.map((clip,index)=>({
  index,assetId:clip.assetId,mediaStart:Number(clip.start)||0,mediaEnd:Number(clip.end)||0,
  speed:Number(clip.speed)||1,reversed:!!clip.reverse,transition:clip.transitionIn||null
 }));
 const warnings=[];
 if((project.cgScenes||[]).length)warnings.push('CGレイヤーはWebGLレンダー済み映像に変換してからネイティブのMedia3へ渡す必要があります');
 if((project.overlays||[]).length)warnings.push('動画オーバーレイ、クロマキー、マスクをネイティブへ変換するアダプタは未実装です');
 if(clips.some(c=>c.reverse))warnings.push('逆再生のネイティブ変換は未実装です');
 if((project.captions||[]).length)warnings.push('字幕はCanvas焼き込みかネイティブ文字効果への変換が必要です');
 return {schema:'subeha.native.export-plan.v1',backend:'media3-proposed-not-connected',segments,modelAssets:(project.cgScenes||[]).map(s=>s.modelAssetId),audioTracks:project.audioTracks||[],warnings};
}
