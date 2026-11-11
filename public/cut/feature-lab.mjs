/* SUBEHA CUT 1.10: research inventory and locally executable analyzers. */
import {FEATURE_LAB_CATALOG,FEATURE_STATUS_LABEL,featureSummary} from './feature-lab-catalog.mjs';
import {MAX_ANALYSIS_SECONDS,rmsWindows,detectBeats,detectSilences,detectSceneCuts,sourceToProjectTime,normalizeMarkers,splitAtMarkers,searchTranscript,parseEditCommand} from './feature-lab-core.mjs';
import {parseSubtitleFile} from './subtitles.mjs';
import {spans,totalDuration} from './transitions.mjs';
const $=id=>document.getElementById(id);
const node=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;};
let overlay=null,mode='all',query='',cues=[],currentMarkers=[],running=false,abortTask=null;
const api=()=>window.__subehaCut;
function setup(){
 if(overlay)return;
 overlay=node('div','lab-overlay');overlay.id='feature-lab';overlay.hidden=true;
 const box=node('section','lab-sheet');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','先進機能ラボ');
 box.innerHTML='<header class="lab-head"><div><h2>先進機能ラボ</h2><small>実装できている機能と開発中の機能を区別して表示</small></div><button type="button" id="lab-close" aria-label="閉じる">×</button></header><div id="lab-content"></div>';
 overlay.append(box);document.body.append(overlay);
 $('lab-close').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});
}
function open(){setup();overlay.hidden=false;document.body.classList.add('feature-lab-open');showCatalog();}
function close(){if(!overlay)return;abortTask?.abort();overlay.hidden=true;document.body.classList.remove('feature-lab-open');running=false;}
function container(){const host=$('lab-content');host.replaceChildren();return host;}
function addButton(host,label,cb,cls='lab-btn'){const b=node('button',cls,label);b.type='button';b.onclick=cb;host.append(b);return b;}
function message(host,text){const p=node('p','lab-note',text);host.append(p);return p;}
function showCatalog(){
 const host=container(),sum=featureSummary();
 const intro=node('p','lab-intro',FEATURE_LAB_CATALOG.length+'機能を登録：利用可能 '+sum.active+' ／ 一部利用可能 '+sum.partial+' ／ 接続・実装待ち '+sum.backend+' ／ 研究段階 '+sum.research);
 host.append(intro);
 const quick=node('div','lab-quick');host.append(quick);
 for(const [id,label] of [['beat','♫ ビート解析'],['silence','◌ 無音検出'],['scenes','▥ 場面検出'],['transcript','T 字幕編集'],['command','⌘ 編集コマンド']])addButton(quick,label,()=>showTool(id));
 const search=node('input','lab-search');search.type='search';search.placeholder='機能を検索';search.value=query;search.setAttribute('aria-label','機能を検索');
 search.oninput=()=>{query=search.value;renderFeatures(list);};host.append(search);
 const tabs=node('div','lab-tabs');host.append(tabs);
 for(const [id,label] of [['all','全機能'],['usable','使用可能'],['backend','接続待ち'],['research','研究']]){
  const b=addButton(tabs,label,()=>{mode=id;tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderFeatures(list);});
  b.classList.toggle('active',mode===id);
 }
 const list=node('div','lab-list');host.append(list);
 renderFeatures(list);
 const footer=node('div','lab-foot');host.append(footer);
 addButton(footer,'機能一覧JSONを保存',()=>{const b=new Blob([JSON.stringify({schema:'subeha.cut.feature-lab.v1',features:FEATURE_LAB_CATALOG},null,2)],{type:'application/json'});download(b,'subeha-feature-lab.json');});
 message(footer,'「接続・実装待ち」「研究段階」は実装済みの意味ではありません。AIモデル・有償APIの自動契約や素材の外部送信は行いません。');
}
function renderFeatures(host){
 host.replaceChildren();
 const term=query.trim().toLocaleLowerCase();
 const found=FEATURE_LAB_CATALOG.filter(f=>(mode==='all'||(mode==='usable'?['active','partial'].includes(f.status):mode===f.status))&&(!term||(f.title+f.description+f.category).toLocaleLowerCase().includes(term)));
 for(const f of found){
  const b=node('button','lab-feature');b.type='button';
  const title=node('strong','lab-feature-title',f.title);
  const badge=node('small','lab-status '+f.status,FEATURE_STATUS_LABEL[f.status]);
  const sub=node('span','lab-feature-sub',f.category+' · '+f.description);
  b.append(title,badge,sub);b.onclick=()=>showDetail(f);host.append(b);
 }
 if(!found.length)message(host,'該当する機能はありません。');
}
function showDetail(f){
 const host=container();
 addButton(host,'‹ 全機能へ',showCatalog,'lab-back');
 host.append(node('h3','lab-title',f.title));
 host.append(node('p','lab-tag '+f.status,FEATURE_STATUS_LABEL[f.status]));
 message(host,f.description);
 message(host,'方式：'+f.implementation);
 const usable=!!f.action&&['active','partial'].includes(f.status);
 if(usable)addButton(host,'この機能を開く',()=>execute(f.action),'lab-primary');
 else message(host,'この機能は未接続です。必要なモデル・ネイティブ処理・API・権利条件を満たすまでは実行できません。');
}
function execute(action){
 if(['beat','silence','scenes','transcript','command'].includes(action))return showTool(action);
 close();
 if(action==='fx'){if(window.__subehaFXOpen)window.__subehaFXOpen('effects');else api()?.toast('エフェクトを開けません');return;}
 if(action==='3d'){if(window.__subehaCGOpen)window.__subehaCGOpen();else api()?.toast('3D CGを開けません');return;}
 if(action==='stock'){if(window.__subehaStockOpen)window.__subehaStockOpen();else api()?.toast('素材ライブラリを開けません');return;}
 const target=(action==='chroma'||action==='tracking')?document.querySelector('[data-pro="'+action+'"]'):action==='caption'?document.querySelector('[data-tab="text"]'):null;
 if(target)target.click();else api()?.toast('この機能の編集パネルはまだ使用できません');
}
function showTool(name){
 const host=container();
 addButton(host,'‹ 全機能へ',showCatalog,'lab-back');
 const titles={beat:'ビート同期・自動カット',silence:'無音区間の検出',scenes:'シーン切替の検出',transcript:'字幕から映像へジャンプ',command:'日本語の編集命令'};
 host.append(node('h3','lab-title',titles[name]));
 if(name==='beat'||name==='silence')return audioTool(name,host);
 if(name==='scenes')return sceneTool(host);
 if(name==='transcript')return transcriptTool(host);
 if(name==='command')return commandTool(host);
}
function audioSources(){
 const p=api()?.state?.project,a=api()?.state?.assets;if(!p||!a)return [];
 const out=[];
 const selected=p.clips.find(c=>c.id===api().state.selectedClip);
 if(selected&&a.has(selected.assetId))out.push({kind:'clip',asset:a.get(selected.assetId),clip:selected,label:'選択クリップの音声（動画形式によっては解析不可）'});
 if(p.music&&a.has(p.music.assetId))out.push({kind:'music',asset:a.get(p.music.assetId),label:'BGM'});
 for(let i=0;i<(p.audioTracks||[]).length;i++){const t=p.audioTracks[i];if(a.has(t.assetId))out.push({kind:'track',asset:a.get(t.assetId),track:t,label:'音声トラック '+(i+1)});}
 return out;
}
async function decodeSource(source){
 const blob=source.asset?.blob;
 if(!blob)throw Error('音声ファイルがありません');
 if(blob.size>70*1024*1024)throw Error('解析するファイルは70MB以下にしてください。大きな動画は軽量な音声を別途追加できます。');
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC)throw Error('このブラウザはWeb Audioに対応していません');
 const context=new AC();
 try{return await context.decodeAudioData(await blob.arrayBuffer());}
 catch(e){throw Error('音声をデコードできません。動画の音声抽出は形式依存です。WAV・MP3などの音声ファイルをBGMに追加して試してください。');}
 finally{await context.close().catch(()=>{});}
}
function sourceTime(source,time){
 if(source.kind==='clip'){
  const clip=source.clip;const span=spans(api().state.project.clips).find(s=>s.clip.id===clip.id);
  return sourceToProjectTime(time,clip,span?.start||0);
 }
 if(source.kind==='track')return time+Number(source.track.start||0);
 return time;
}
function audioTool(name,host){
 const sources=audioSources();
 message(host,'解析は端末内で行い、素材を外部へ送信しません。検出結果は候補なので確認してから分割できます。');
 if(!sources.length){message(host,'まず動画または音声素材を読み込んでください。');return;}
 const select=node('select','lab-select');sources.forEach((s,i)=>{const o=node('option','',s.label);o.value=String(i);select.append(o);});host.append(select);
 const controls=node('div','lab-controls');host.append(controls);
 const label=node('label','lab-field',name==='beat'?'検出感度':'無音しきい値（dB）');
 const range=node('input');range.type='range';range.min=name==='beat'?'.5':'-55';range.max=name==='beat'?'1.9':'-20';range.step=name==='beat'?'.1':'1';range.value=name==='beat'?'1.2':'-37';
 const output=node('output','',range.value);range.oninput=()=>output.textContent=range.value;label.append(range,output);controls.append(label);
 const status=node('p','lab-note','素材を選択し、解析を実行してください。');host.append(status);
 addButton(host,'解析する',async()=>{
  if(running)return;running=true;status.textContent='音声を読み込み、解析しています…';
  try{
   const source=sources[Number(select.value)],buffer=await decodeSource(source);
   const begin=source.clip?source.clip.start:0;
   const max=source.clip?Math.max(1,Math.min(MAX_ANALYSIS_SECONDS,source.clip.end-begin)):MAX_ANALYSIS_SECONDS;
   const windows=rmsWindows(buffer,{startSeconds:begin,maxSeconds:max});
   let points;
   if(name==='beat')points=detectBeats(windows,{sensitivity:Number(range.value)}).map(time=>({time:sourceTime(source,time),kind:'beat',label:'拍候補'}));
   else{
    const spans=detectSilences(windows,{thresholdDb:Number(range.value)});
    points=spans.flatMap(r=>[{time:sourceTime(source,r.start),kind:'silence',label:'無音開始'},{time:sourceTime(source,r.end),kind:'silence',label:'無音終了'}]);
   }
   const maxTime=totalDuration(api().state.project.clips);
   currentMarkers=normalizeMarkers(points.filter(x=>x.time!==null&&x.time>=0&&x.time<=maxTime));
   status.textContent=currentMarkers.length+'件の候補を検出しました。先頭'+MAX_ANALYSIS_SECONDS+'秒以内を解析します。';
   renderMarkers(host,{splittable:true});
  }catch(e){status.textContent=e.message||String(e);}finally{running=false;}
 },'lab-primary');
}
async function sampleVideoScenes(asset,clip,{signal,onProgress,threshold=.19}={}){
 if(!asset||asset.type!=='video')throw Error('動画クリップを選択してください');
 const video=document.createElement('video');video.src=asset.url;video.muted=true;video.playsInline=true;video.preload='auto';
 const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('動画の読み込みに失敗しました')),12000);video.onloadedmetadata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(Error('動画を開けません'));};});
 try{
  video.load();await loaded;
  const c=document.createElement('canvas');c.width=48;c.height=27;
  const cx=c.getContext('2d',{willReadFrequently:true});
  const from=Math.max(0,clip.start||0),to=Math.min(video.duration,clip.end,from+48);
  const frames=[];
  for(let i=0,t=from+.2;t<to&&i<60;i++,t+=.8){
   if(signal?.aborted)throw Error('解析が中断されました');
   const target=Math.min(to-.01,t);
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{video.removeEventListener('seeked',done);reject(Error('シークに失敗しました'));},3500);const done=()=>{clearTimeout(timer);resolve();};video.addEventListener('seeked',done,{once:true});video.currentTime=target;});
   if(video.readyState>=2){cx.drawImage(video,0,0,48,27);frames.push({time:target,pixels:cx.getImageData(0,0,48,27).data.slice()});}
   onProgress?.(i+1);
  }
  return detectSceneCuts(frames,{threshold});
 }finally{video.pause();video.removeAttribute('src');video.load();}
}
function sceneTool(host){
 message(host,'選択した動画を低解像度で最大48秒解析します。画像差分方式のため、激しいカメラ移動も切替として検出する場合があります。');
 const status=node('p','lab-note','編集画面で動画クリップを選んでください。');host.append(status);
 const field=node('label','lab-field','場面差分のしきい値');
 const slider=node('input');slider.type='range';slider.min='.09';slider.max='.42';slider.step='.01';slider.value='.19';
 const output=node('output','',slider.value);slider.oninput=()=>output.textContent=slider.value;field.append(slider,output);host.append(field);
 addButton(host,'場面を解析',async()=>{
  if(running)return;
  const state=api()?.state,clip=state?.project?.clips?.find(c=>c.id===state.selectedClip),asset=clip&&state.assets.get(clip.assetId);
  if(!clip||!asset||asset.type!=='video'){status.textContent='先に動画クリップを選択してください。';return;}
  running=true;abortTask=new AbortController();status.textContent='解析中…';
  try{
   const cuts=await sampleVideoScenes(asset,clip,{signal:abortTask.signal,threshold:Number(slider.value),onProgress:n=>status.textContent=n+'フレーム解析済み…'});
   const span=spans(state.project.clips).find(s=>s.clip.id===clip.id);
   currentMarkers=normalizeMarkers(cuts.filter(x=>x.score>=Number(slider.value)).map(c=>({time:sourceToProjectTime(c.time,clip,span?.start||0),kind:'scene',label:'場面切替候補（差分 '+c.score+'）'})).filter(x=>x.time!==null));
   status.textContent=currentMarkers.length+'件の場面境界候補が見つかりました。';
   renderMarkers(host,{splittable:true});
  }catch(e){status.textContent=e.message||String(e);}finally{running=false;abortTask=null;}
 },'lab-primary');
}
function renderMarkers(host,{splittable=false}={}){
 const old=host.querySelector('.lab-markers');old?.remove();
 const wrap=node('section','lab-markers');host.append(wrap);
 const total=currentMarkers.length;
 const controls=node('div','lab-marker-buttons');wrap.append(controls);
 addButton(controls,'マーカーとして保存',()=>{
  const p=api().state.project;p.analysisMarkers=normalizeMarkers([...(p.analysisMarkers||[]),...currentMarkers]);api().save();api().toast('解析マーカー '+total+'件を保存しました');
 });
 if(splittable&&currentMarkers.length)addButton(controls,'候補位置でクリップを分割',()=>{
  const a=api();if(a.state.recording)return a.toast('書き出し中は分割できません');
  const count=Math.min(currentMarkers.length,48);
  if(!confirm('候補位置 '+count+'件までで動画を分割します。元の素材は変更しません。実行しますか？'))return;
  const result=splitAtMarkers(a.state.project.clips,currentMarkers,{limit:48});
  a.state.project.clips=result.clips;a.state.selectedClip=result.clips[0]?.id||null;
  a.save();a.refreshAll();a.seek(Math.min(a.state.current,totalDuration(result.clips)));
  a.toast(result.count+'か所を分割しました。元に戻すこともできます。');
 });
 const list=node('div','lab-marker-list');wrap.append(list);
 currentMarkers.slice(0,90).forEach(m=>addButton(list,m.time.toFixed(2)+'秒 · '+m.label,()=>{api().seek(m.time);close();},'lab-marker'));
 if(total>90)message(wrap,'90件を表示しています。残りはマーカー保存に含まれます。');
}
function transcriptTool(host){
 message(host,'SRT、VTT、Whisper JSONからタイムコード付きの字幕を読み込みます。自動文字起こしそのものは実行しません。');
 const file=node('input','lab-file');file.type='file';file.accept='.srt,.vtt,.json,text/plain,application/json';file.setAttribute('aria-label','字幕ファイル');
 host.append(file);
 const status=node('p','lab-note','字幕ファイルを選択してください。');host.append(status);
 const queryInput=node('input','lab-search');queryInput.type='search';queryInput.placeholder='字幕の語句を検索';host.append(queryInput);
 const actions=node('div','lab-controls');host.append(actions);
 const results=node('div','lab-transcript');host.append(results);
 const render=()=>{
  results.replaceChildren();for(const cue of searchTranscript(cues,queryInput.value,{limit:100})){
   addButton(results,cue.start.toFixed(2)+'秒　'+cue.text.replace(/\n/g,' '),()=>{api().seek(cue.start);close();},'lab-transcript-row');
  }
 };
 queryInput.oninput=render;
 file.onchange=async()=>{
  const selected=file.files?.[0];if(!selected)return;
  if(selected.size>6*1024*1024){status.textContent='字幕ファイルは6MB以下にしてください。';return;}
  try{cues=parseSubtitleFile(await selected.text(),selected.name);status.textContent=cues.length+'件の字幕を読み込みました。';render();
   actions.replaceChildren();addButton(actions,'字幕としてプロジェクトに配置',()=>{
    if(!api()?.state?.project?.clips?.length)return api().toast('先に動画を読み込んでください');
    if(!confirm('現在の字幕をこのファイルの内容に置き換えます。よろしいですか？'))return;
    api().state.project.captions=cues;api().state.project.captionEnabled=true;api().save();api().refreshAll();api().toast('字幕を配置しました');
   },'lab-primary');
  }catch(e){status.textContent='読み込み失敗: '+(e.message||e);}
 };
}
function commandTool(host){
 message(host,'対応例：「3秒に分割」「速度を2倍」「9:16に」「5秒に移動」「テキスト「こんにちは」を追加」「ミュート」。実行前に変更内容を表示します。');
 const field=node('textarea','lab-command');field.rows=3;field.placeholder='編集指示を日本語で入力';host.append(field);
 const preview=node('p','lab-note','指示を入力してください。');host.append(preview);
 const actions=node('div','lab-controls');host.append(actions);
 let parsed=null;
 field.oninput=()=>{parsed=parseEditCommand(field.value);preview.textContent=parsed?'変更内容：'+parsed.description:'未対応の指示です。例文に近い形で指定してください。';apply.disabled=!parsed;};
 const apply=addButton(actions,'確認した内容を適用',()=>{
  if(!parsed)return;
  const a=api();if(!a||a.state.recording)return;
  try{
   const op=parsed;
   if(op.type==='seek')a.seek(op.seconds);
   else if(op.type==='split'){const result=splitAtMarkers(a.state.project.clips,[{time:op.seconds}],{limit:1});if(!result.count)throw Error('分割位置が無効か、トランジション内です');a.state.project.clips=result.clips;a.state.selectedClip=result.clips[0]?.id||null;a.save();a.refreshAll();a.seek(op.seconds);}
   else if(op.type==='speed'||op.type==='mute'){if(!a.selectedClip())throw Error('クリップを選んでください');a.updateClip(c=>{if(op.type==='speed')c.speed=op.speed;else{c.volume=0;c.muted=true;}});}
   else if(op.type==='ratio'){const button=$('ratio-button');if(!button)throw Error('比率ボタンがありません');for(let i=0;i<9&&a.state.project.ratio!==op.ratio;i++)button.click();if(a.state.project.ratio!==op.ratio)throw Error('この比率には未対応です');}
   else if(op.type==='text'){if(!a.state.project.clips.length)throw Error('素材を読み込んでください');const t={id:a.newID(),text:op.text,start:a.state.current,duration:3,size:62,x:.5,y:.76,color:'#ffffff'};a.state.project.texts.push(t);a.state.selectedText=t.id;a.save();a.refreshAll();}
   preview.textContent='適用しました：'+op.description;
  }catch(e){preview.textContent='適用不可：'+e.message;}
 },'lab-primary');apply.disabled=true;
}
function download(blob,name){
 const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
window.__subehaLabOpen=open;
window.__subehaLabClose=close;
