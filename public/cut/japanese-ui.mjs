/* Friendly Japanese labels and on-device glossary. Stored project values are never translated. */
const WORDS={
 'オーバーレイ':'素材を重ねる','フィルタ':'色フィルター','フィルター':'色フィルター',
 'クロマキー':'背景色を消す','キー合成':'背景色を消す','トランジション':'場面のつなぎ',
 'エフェクト':'映像効果','レイヤー':'重ねた素材','ミュート':'音を消す',
 'キャンバス':'画面の大きさ','ルック':'色の雰囲気','IN':'ここから','OUT':'ここまで',
 'キー削除':'動きの記録を消す','◆ 現在位置にキー':'◆ 今の位置で強さを記録',
 '非破壊・クリップ単位':'元の動画はそのまま', 'READY':'準備できました',
 'ORIGINAL':'元の色','MONO':'白黒','CINEMA':'映画風','VINTAGE':'古い映像風',
 'DREAM':'夢のように','GLITCH':'映像の乱れ','SCREEN':'明るく重ねる'
};
export function readableLabel(value){return WORDS[value]||value;}
function mount(){
 const root=document.getElementById('app');if(!root||document.getElementById('cut-jp-guide'))return;
 const guide=document.createElement('section');guide.id='cut-jp-guide';guide.hidden=true;
 guide.setAttribute('role','dialog');guide.setAttribute('aria-modal','true');guide.setAttribute('aria-label','操作と用語の説明');
 guide.innerHTML=`<header><strong>操作と用語の説明</strong><button id="cut-jp-close" aria-label="閉じる">×</button></header>
 <div class="cut-jp-guide-body"><h3>🗑 ゴミ箱へ入れて削除</h3>
 <p>時間軸の動画・写真・文字・字幕・3D映像は、<b>長押ししてから指を動かす</b>とゴミ箱が現れます。そのままゴミ箱まで運び、指を離すと削除できます。</p>
 <p>音声や重ねた素材は、そのままドラッグしてゴミ箱へ。映像の上にある文字や字幕も、つかんで下へ運べます。誤って消したら「元に戻す」を押してください。</p>
 <h3>🎞 編集の言葉</h3><dl>
 <dt>素材を重ねる</dt><dd>写真や別の動画を、映像の上に置くこと。</dd>
 <dt>場面のつなぎ</dt><dd>次のカットへ切り替えるときの演出。フェードなど。</dd>
 <dt>背景色を消す</dt><dd>緑色など特定の色を透明にし、別の映像と合成すること。</dd>
 <dt>動きの記録点</dt><dd>「この時刻ではこの場所・大きさ」と記録する点。点と点の間は自動で動く。</dd>
 <dt>表示する範囲</dt><dd>素材の一部分だけを見せる形。円や自由な輪郭を選べる。</dd>
 <dt>重なり方</dt><dd>2つの映像の色をどのように混ぜるか。</dd>
 <dt>色フィルター</dt><dd>映像全体の雰囲気を一度に変えること。</dd>
 <dt>映像効果</dt><dd>発光・粒子・ぶれなどを加えること。</dd>
 <dt>書き出す</dt><dd>編集した作品を動画ファイルとして保存すること。</dd>
 </dl><h3>✋ 基本操作</h3><p>動画の端をドラッグすると長さを変更。文字をドラッグすると移動。2本指を広げると拡大、ひねると回転。時間軸を左右になぞると再生位置が動きます。</p></div>`;
 root.append(guide);
 const css=document.createElement('style');css.textContent=`
 #cut-jp-guide{position:fixed;inset:12vh 4vw calc(85px + env(safe-area-inset-bottom));z-index:1220;background:#23242b;color:#f6f6f7;border:1px solid #777;border-radius:18px;box-shadow:0 20px 70px #000c;overflow:auto;max-width:620px;margin:auto}
 #cut-jp-guide[hidden]{display:none!important}
 #cut-jp-guide header{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;background:#30313a;padding:14px 18px;font-size:16px;border-bottom:1px solid #565761;z-index:1}
 #cut-jp-close{background:#41424b;color:white;border-radius:50%;font-size:22px;width:36px;height:36px}
 .cut-jp-guide-body{padding:12px 19px 30px;font-size:13px;line-height:1.8}
 .cut-jp-guide-body h3{font-size:15px;color:#ffdce3;margin:15px 0 5px}
 .cut-jp-guide-body dt{font-weight:700;margin-top:8px}.cut-jp-guide-body dd{color:#cfd0d9;margin-left:14px}`;
 document.head.append(css);
 guide.querySelector('#cut-jp-close').onclick=()=>guide.hidden=true;
 function useSimpleJapanese(){
  const selectors=['#leap-toolstrip .leap-tool > span','.bottomnav .nav-tab','#leap-extras-grid button','#cut-fx-content [data-start]','#cut-fx-content [data-end]','#cut-fx-content [data-key]','#cut-fx-content [data-clear]','.cut-fx-tabs button'];
  for(const node of document.querySelectorAll(selectors.join(','))){
   if(!node.children.length){const next=readableLabel(node.textContent.trim());if(next!==node.textContent.trim())node.textContent=next;}
   else if(node.matches('.bottomnav .nav-tab')){const text=[...node.childNodes].find(n=>n.nodeType===3&&n.nodeValue.trim());if(text){const old=text.nodeValue.trim();if(WORDS[old])text.nodeValue=text.nodeValue.replace(old,WORDS[old]);}}
  }
  const title=document.querySelector('#pro-title');if(title?.textContent){let s=title.textContent;for(const [old,newVal]of Object.entries(WORDS)){if(s===old||s.startsWith(old+' · '))s=s.replace(old,newVal);}if(s!==title.textContent)title.textContent=s;}
 }
 let scheduled=false;const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;useSimpleJapanese();installHelp();});}});
 observer.observe(root,{childList:true,subtree:true});
 function installHelp(){const help=document.querySelector('.leap-head-help');if(!help||help.dataset.jpHelp)return;help.dataset.jpHelp='1';help.setAttribute('aria-label','操作と用語の説明');help.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();document.getElementById('leap-extras')?.setAttribute('hidden','');guide.hidden=false;},{capture:true});}
 window.addEventListener('keydown',e=>{if(e.key==='Escape')guide.hidden=true;});
 useSimpleJapanese();installHelp();requestAnimationFrame(installHelp);
}
if(typeof window!=='undefined'&&window.__subehaCut){if(document.readyState==='complete')mount();else window.addEventListener('subeha-cut-ready',()=>requestAnimationFrame(mount),{once:true});}
