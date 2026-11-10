/** Repository capability hub (research/interop, not bundled third-party app code). */
import {exportPlan} from './integrations/engine-plan.mjs';
const ENGINES=[
 ['ClearCut','MIT','ネイティブAndroid / Media3','candidate','https://github.com/SysAdminDoc/ClearCut'],
 ['ActionCut','許諾未確認','ネイティブAndroid','reference','https://github.com/naveenneog/ActionCut'],
 ['Open Video Editor','GPL-3.0','ネイティブAndroid / Media3','reference','https://github.com/devhyper/open-video-editor'],
 ['LTX Desktop','Apache-2.0・モデル別規約','デスクトップAI映像生成','external','https://github.com/Lightricks/LTX-Desktop'],
 ['Videoleap Flow Rebuild','許諾未確認','画面研究（動画エンジンではない）','reference','https://github.com/eddieatadapty/videoleap-flow-rebuild']
];
export function mountEngineHub(api,{panel}){
 function open(){
  panel('エンジン統合 / 利用可能性',`<p class="pro-tip">現在動作しているのはSUBEHA CUTのWeb編集処理と3D CG。下記GitHubアプリをそのまま同時実行する仕組みではありません。</p><div class="hub-grid">${ENGINES.map(([name,license,kind,state,url])=>`<div class="hub-entry"><strong>${name}</strong><small>${license} · ${kind}</small><span>${state==='candidate'?'統合候補':state==='external'?'外部アプリ': '実装参考のみ'}</span><a href="${url}" target="_blank" rel="noopener noreferrer">ソースを見る</a></div>`).join('')}</div><p class="pro-tip">ネイティブ書き出し変換やLTXのAI生成はまだ連携していません。プロジェクト変換計画は現状と未対応機能を明記したJSONです。</p><button id="hub-plan-save">互換性レポート(JSON)を保存</button>`);
  document.getElementById('hub-plan-save').onclick=()=>{
   const info=exportPlan(api.state.project),blob=new Blob([JSON.stringify(info,null,2)],{type:'application/json'}),href=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=href;link.download='subeha-render-capability-plan.json';link.click();setTimeout(()=>URL.revokeObjectURL(href),10000);
  };
 }
 window.__subehaHubOpen=open;return {open};
}
