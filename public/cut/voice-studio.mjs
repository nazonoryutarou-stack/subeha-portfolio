/** Browser UI for a separately running VOICEVOX-compatible engine. Nothing uploaded to SUBEHA servers. */
import {VOICEVOX_DEFAULT,VOICE_LICENSE_URL,AQUESTALK_LICENSE_URL,voiceTermsFor,getVoiceSpeakers,synthesizeVoice,validateEngineURL} from './voice-api.mjs';
const $=id=>document.getElementById(id);
let voices=[],clip=null,previewUrl=null,opened=false;
const e=(tag,cls,t)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(t!==undefined)el.textContent=t;return el;};
const status=s=>{const output=$('voice-status');if(output)output.textContent=s;};
function downloadWav(blob,name){const url=URL.createObjectURL(blob),a=e('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
function cleanup(){if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}}
function selected(){return voices.find(v=>String(v.id)===$('voice-style').value)||null;}
function showCredit(){const v=selected(),purpose=$('voice-purpose').value,term=v?voiceTermsFor(v.name,purpose):null;
 $('voice-license').textContent=term?term.reason:'声の利用条件は各音声の配布元で確認してください。';
 $('voice-license').classList.toggle('denied',!!term&&!term.allowed);
 $('voice-credit').textContent=v?`必要なクレジット例：${term.credit}`:'エンジンに接続すると声の一覧が表示されます。';
}
function init(){if($('voice-studio'))return;
 const modal=e('div','voice-overlay');modal.id='voice-studio';modal.hidden=true;
 const sheet=e('section','voice-sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','声を作る');
 sheet.innerHTML=`<header class="voice-head"><h2>声を作る</h2><button type="button" id="voice-close" aria-label="閉じる">×</button></header>
 <p class="voice-intro">台本を入力し、音声エンジンで生成したWAVを編集の音声トラックへ追加します。<strong>VOICEVOX本体は別途起動が必要です。</strong></p>
 <label>用途 <select id="voice-purpose"><option value="general">通常の作品・紹介動画</option><option value="religious">宗教団体の宣伝・宗教活動</option></select></label>
 <label>音声エンジンの接続先 <input id="voice-endpoint" value="${VOICEVOX_DEFAULT}" spellcheck="false" autocomplete="off"></label><button id="voice-connect" type="button">声の一覧を取得</button>
 <label>声の種類 <select id="voice-style"><option value="">先に接続してください</option></select></label>
 <label>話す文章 <textarea id="voice-script" rows="5" maxlength="1000" placeholder="ここに台本を入力"></textarea></label>
 <div class="voice-tuning"><label>話す速さ <input id="voice-speed" type="range" min="0.5" max="2" step="0.05" value="1"><output id="voice-speed-val">1.00倍</output></label>
 <label>声の高さ <input id="voice-pitch" type="range" min="-0.15" max="0.15" step="0.01" value="0"><output id="voice-pitch-val">0.00</output></label>
 <label>抑揚 <input id="voice-intonation" type="range" min="0.1" max="2" step="0.05" value="1"><output id="voice-intonation-val">1.00</output></label></div>
 <div id="voice-license" class="voice-license"></div><small id="voice-credit"></small>
 <div class="voice-actions"><button id="voice-generate" type="button" class="voice-primary">🎙 声を生成する</button><button id="voice-append" type="button" disabled>＋ 音声を時間軸に追加</button><button id="voice-save-wav" type="button" disabled>WAVを保存</button><button id="voice-save-credits" type="button">声のクレジット一覧</button></div><audio id="voice-preview" controls hidden></audio>
 <p role="status" id="voice-status" aria-live="polite">音声エンジンへ接続してください。</p>
 <div class="voice-import"><h3>ゆっくり音声（AquesTalk）</h3><p>ゆっくり音声は公式ツール等で作成したWAVを読み込めます。団体利用・広告・収益化用途では所定の使用ライセンスが必要です。東方Project等のキャラクター画像を添える場合はその権利も別途確認してください。</p><a href="${AQUESTALK_LICENSE_URL}" target="_blank" rel="noopener noreferrer">AquesTalk公式の使い方とライセンス</a><button id="voice-add-local" type="button">＋ 作成済みの音声を取り込む</button></div>
 <p class="voice-caution">⚠️ <strong>ずんだもん等の音源は宗教・政治活動への使用が禁止されています。</strong> キャラクター画像の利用条件は別です。ほかの声・ゆっくり音声も用途ごとの許諾を確認してください。エンジンへの接続はブラウザのCORS設定が必要な場合があります。</p>
 <a href="${VOICE_LICENSE_URL}" target="_blank" rel="noopener noreferrer">ずんだもん等の公式音源規約</a>`;
 modal.append(sheet);document.body.append(modal);
 const close=()=>{opened=false;modal.hidden=true;cleanup();$('voice-preview').pause();$('voice-preview').removeAttribute('src');};
 $('voice-close').onclick=close;modal.addEventListener('click',ev=>{if(ev.target===modal)close();});
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&opened)close();});
 $('voice-purpose').onchange=showCredit;$('voice-style').onchange=showCredit;
 for(const [id,out,fmt]of [['voice-speed','voice-speed-val',n=>n.toFixed(2)+'倍'],['voice-pitch','voice-pitch-val',n=>n.toFixed(2)],['voice-intonation','voice-intonation-val',n=>n.toFixed(2)]])$(id).oninput=ev=>{$(out).textContent=fmt(Number(ev.target.value));};
 $('voice-connect').onclick=async()=>{
  const button=$('voice-connect');button.disabled=true;status('音声エンジンに接続中…');
  try{const base=validateEngineURL($('voice-endpoint').value);const controller=new AbortController(),id=setTimeout(()=>controller.abort(),12000);
    try{voices=await getVoiceSpeakers(base,{signal:controller.signal});}finally{clearTimeout(id);}
    const select=$('voice-style');select.replaceChildren();for(const voice of voices){const option=e('option',null,`${voice.name} ／ ${voice.style}`);option.value=String(voice.id);select.append(option);}
    status(voices.length?`声を${voices.length}種類読み込みました。台本を入力してください。`:'声の種類が見つかりません');showCredit();
  }catch(err){status('接続失敗：'+err.message+'。別端末のエンジンにはHTTPS/CORS等の設定が必要です。');}
  finally{button.disabled=false;}
 };
 $('voice-generate').onclick=async()=>{
  const v=selected();if(!v){status('先に声の一覧を取得し、声を選んでください');return;}
  const term=voiceTermsFor(v.name,$('voice-purpose').value);if(!term.allowed){status(term.reason);return;}
  const button=$('voice-generate');button.disabled=true;status('音声を生成しています…');
  try{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),35000);
   let result;try{result=await synthesizeVoice({base:$('voice-endpoint').value,text:$('voice-script').value,speakerId:v.id,speakerName:v.name,purpose:$('voice-purpose').value,speed:Number($('voice-speed').value),pitch:Number($('voice-pitch').value),intonation:Number($('voice-intonation').value),signal:controller.signal});}
   finally{clearTimeout(timeout);}
   clip={...result,text:$('voice-script').value,style:v.style,at:Date.now(),filename:`${v.name}-${new Date().toISOString().slice(0,10)}.wav`};
   cleanup();previewUrl=URL.createObjectURL(result.blob);$('voice-preview').src=previewUrl;$('voice-preview').hidden=false;
   $('voice-append').disabled=false;$('voice-save-wav').disabled=false;status('生成しました。再生して確認した後、音声を追加してください。');
  }catch(err){status('生成失敗：'+err.message);}finally{button.disabled=false;}
 };
 $('voice-append').onclick=async()=>{if(!clip)return;if(!window.__subehaImportVoiceFile){status('映像編集画面を読み込み直してください');return;}
  const button=$('voice-append');button.disabled=true;
  try{const file=new File([clip.blob],clip.filename,{type:'audio/wav'});
   await window.__subehaImportVoiceFile(file,{provider:'VOICEVOX',voice:clip.speakerName,style:clip.style,credit:clip.credit,licenseUrl:clip.licenseUrl,text:clip.text});
   status('音声トラックへ追加しました。音量や開始位置を編集できます。');window.__subehaCut.toast('合成した音声を追加しました');
  }catch(err){status('音声の追加に失敗：'+err.message);}finally{button.disabled=false;}
 };
 $('voice-save-wav').onclick=()=>{if(clip)downloadWav(clip.blob,clip.filename);};
 $('voice-save-credits').onclick=()=>{
  const rows=window.__subehaCut?.state?.project?.voiceCredits||[];
  if(!rows.length){status('この作品に追加した合成音声はまだありません');return;}
  const lines=[...new Set(rows.map(x=>x.credit).filter(Boolean))];
  downloadWav(new Blob([`この作品で使用した合成音声の出典\n\n${lines.join('\n')}\n\n各声の利用条件を配布元で確認してください。`],{type:'text/plain;charset=utf-8'}),'音声クレジット.txt');
  status('音声のクレジット一覧を保存しました');
 };
 $('voice-add-local').onclick=()=>{close();$('pro-audio-picker')?.click();};
 window.__subehaVoiceClose=close;
}
function open(){init();opened=true;$('voice-studio').hidden=false;clip=null;$('voice-append').disabled=true;$('voice-save-wav').disabled=true;showCredit();}
window.__subehaVoiceOpen=open;
