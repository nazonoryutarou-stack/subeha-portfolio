import {MAGIC_MODES,magicEdit} from './magic-edit.mjs';
/* SUBEHA CUT 1.0 — compact, content-first editor shell. Uses existing editor actions, no copied assets. */
const $=id=>document.getElementById(id);
const ICONS={
 cube:'<path d="M12 2 21 7v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>',
 home:'<path d="M3 11 12 3l9 8v9h-6v-6H9v6H3z"/>',
 magic:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="m4 7-1-4 4-1 2 5M12 7l-1-5 4-1 1 6M5 11h14M16 14l1.2 2.8L20 18l-2.8 1.1L16 22l-1.2-2.9L12 18l2.8-1.2z"/>' ,
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5"/><path d="M12 18h.01"/>',
 undo:'<path d="M9 7 4 12l5 5"/><path d="M5 12h9a6 6 0 0 1 6 6"/>',
 redo:'<path d="m15 7 5 5-5 5"/><path d="M19 12h-9a6 6 0 0 0-6 6"/>',
 canvas:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>',
 overlay:'<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M10 10h11v11H10z"/>',
 text:'<path d="M4 6h16M12 6v13M8 19h8"/>',
 captions:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6 10h12M6 14h8"/>',
 audio:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 filters:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16 8 8 0 0 1 0-16Z"/><path d="M12 4c-2 5-2 11 0 16"/>',
 effect:'<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 18l.7 2.3L22 21l-2.3.7L19 24l-.7-2.3L16 21l2.3-.7z"/>',
 template:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h18M10 10v11M3 6h.1M7 6h.1"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 split:'<circle cx="7" cy="18" r="3"/><circle cx="17" cy="18" r="3"/><path d="M9 15 20 4M15 15 4 4"/>',
 speed:'<path d="M5 17a9 9 0 1 1 14 0M12 13l4-5"/>',
 volume:'<path d="M4 10h4l5-4v12l-5-4H4zM16 9a5 5 0 0 1 0 6"/>',
 mute:'<path d="M4 10h4l5-4v12l-5-4H4zM16 10l5 5m0-5-5 5"/>',
 crop:'<path d="M6 2v15h15M2 6h15v15"/>',
 adjust:'<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2.5"/><circle cx="15" cy="12" r="2.5"/><circle cx="10" cy="19" r="2.5"/>',
 transitions:'<rect x="2" y="7" width="8" height="10" rx="1"/><rect x="14" y="7" width="8" height="10" rx="1"/><path d="m12 6-2 3 2 3 2-3z"/>',
 delete:'<path d="M4 7h16M10 4h4M7 7l1 14h8l1-14M10 11v7m4-7v7"/>',
 back:'<path d="m15 4-8 8 8 8"/>',
 key:'<path d="m12 2 8 10-8 10L4 12z"/>',
 save:'<path d="M12 3v13m-5-5 5 5 5-5M5 20h14"/>',
 duplicate:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 16H3V3h13v2"/>',
 freeze:'<path d="M7 4v16M17 4v16"/>',
 brush:'<path d="m19 3 2 2-9 9-3-3zM10 14c-3 0-6 2-6 6 4 0 6-3 6-6z"/>',
 track:'<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
};
const svg=(key)=>`<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]||ICONS.more}</svg>`;

function installShell(){
 if(!window.__subehaCut || !$('cut-touch-workspace') || document.body.classList.contains('leap-layout'))return;
 document.body.classList.add('leap-layout');
 const {state,refreshAll}=window.__subehaCut;
 const navigation=document.querySelector('.bottomnav');
 const stage=$('preview-stage');
 const transport=document.querySelector('.transport');
 // Restyle without replacing the existing playback/editor controls or their event handlers.
 document.querySelector('.brand').innerHTML='SUBEHA <strong>CUT</strong>';
 $('new-project').innerHTML=svg('home');
 $('new-project').title='新規プロジェクト';
 $('export-open').innerHTML=svg('save')+'<span>書き出す</span>';
 const help=document.createElement('button');help.className='leap-head-help';help.innerHTML=svg('help');help.type='button';help.setAttribute('aria-label','操作ガイド');
 $('new-project').after(help);
 const timecode=$('timecode');transport.insertBefore(timecode,$('play'));
 transport.append($('pro-fullscreen'));
 $('pro-fullscreen').innerHTML='<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10V4h6M14 4h6v6M20 14v6h-6M10 20H4v-6"/></svg>';
 $('play').setAttribute('title','再生・一時停止');
 const workspace=$('cut-touch-workspace');
 const timeline=workspace.querySelector('.cut-timeline-frame');
 const laneContainer=$('cut-timeline-content');
 // Overlay tracks sit above the main filmstrip; unused tracks take no space.
 const videoLane=$('cut-video-lane'),overlayLane=$('cut-overlay-lane');
 videoLane.before(overlayLane);
 const plus=document.createElement('button');plus.id='leap-add-media';plus.type='button';plus.className='leap-add-media';plus.textContent='＋';plus.title='クリップを追加';plus.setAttribute('aria-label','クリップを追加');plus.onclick=()=>$('file-picker').click();
 timeline.append(plus);
 const editingBar=document.createElement('div');editingBar.className='leap-editing-bar';editingBar.innerHTML=
 `<div class="leap-history"><button id="leap-undo" aria-label="元に戻す">${svg('undo')}</button><button id="leap-redo" aria-label="やり直す">${svg('redo')}</button></div><div class="leap-midtools"><button id="leap-split" aria-label="再生ヘッドで分割">${svg('split')}</button><button id="leap-key" aria-label="キーフレームを設定">${svg('key')}</button></div><button id="leap-zoom" aria-label="タイムラインの拡大率を変更">${svg('adjust')}</button>`;
 workspace.after(editingBar);
 $('leap-undo').onclick=()=>$('pro-undo')?.click();
 $('leap-redo').onclick=()=>$('pro-redo')?.click();
 $('leap-split').onclick=()=>$('split-clip')?.click();
 $('leap-key').onclick=()=>openTool('transform');
 $('leap-zoom').onclick=()=>$('cut-zoom-in')?.click();
 const toolstrip=document.createElement('div');toolstrip.className='leap-toolstrip';toolstrip.id='leap-toolstrip';navigation.append(toolstrip);
 const mini=document.createElement('div');mini.id='leap-mini-sheet';mini.className='leap-mini-sheet';mini.hidden=true;$('app').append(mini);
 const sheet=document.createElement('div');sheet.id='leap-extras';sheet.className='leap-extras';sheet.hidden=true;
 sheet.innerHTML='<div class="leap-extras-head"><strong>すべてのツール</strong><button id="leap-extras-close" aria-label="閉じる">×</button></div><div id="leap-extras-grid"></div>';
 $('app').append(sheet);
 $('leap-extras-close').onclick=()=>{sheet.hidden=true;};
 const modeState={mode:'main',lastSelected:null};
 const clickNative=(kind,name)=>{const b=navigation.querySelector(`.nav-tab[data-${kind}="${name}"]`);if(!b)return false;b.click();return true;};
 function openTool(name){mini.hidden=true;sheet.hidden=true;const kind=['text','audio','look','export','clips'].includes(name)?'tab':'pro';if(!clickNative(kind,name)){
  if(name==='templates' || name==='retouch' || name==='videoRetouch'){
   const b=name==='templates'?navigation.querySelector('[data-retouch=template]'):name==='retouch'?navigation.querySelector('[data-retouch=image]'):[...navigation.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.includes('動画背景切り抜き'));
   if(b)b.click();else window.__subehaCut.toast('このツールは現在利用できません');
  }
 }}
 const make=(label,icon,onClick,id='')=>({label,icon,onClick,id});
 const general=[
  make('マジック編集','magic',()=>openMagicEdit()),
  make('オーバーレイ','overlay',()=>openTool('overlay')),
  make('3D CG','cube',()=>window.__subehaCGOpen?.()),
  make('テキスト','text',()=>openTool('text')),
  make('オーディオ','audio',()=>openTool('audio')),
  make('フィルタ','filters',()=>openTool('look')),
  make('調整','adjust',()=>openTool('adjust')),
  make('エフェクト','effect',()=>openTool('effects')),
  make('キャンバス','canvas',()=>openTool('canvas')),
  make('字幕','captions',()=>openTool('captions')),
  make('テンプレ','template',()=>openTool('templates')),
  make('すべて','more',()=>openExtras()),
 ];
 function openMagicEdit(){
  sheet.hidden=true;document.querySelector('.tools-shell')?.classList.remove('pro-visible');document.body.classList.remove('pro-open');
  mini.innerHTML='<header><button id="leap-magic-close" aria-label="閉じる">‹</button><strong>マジック編集</strong><span>✦</span></header><div class="leap-magic-info">映像にまとめて色彩・効果・場面転換を設定します。動画を生成するAIではありません。元の素材や音声は保持されます。</div><div id="leap-magic-row" class="leap-magic-row"></div>';
  mini.hidden=false;mini.querySelector('#leap-magic-close').onclick=()=>mini.hidden=true;
  const desc={film:'柔らかなディゾルブ、映画風の色調と周辺減光',rhythm:'短いワイプ、鮮やかな色と軽い色収差',memory:'ゆったりしたフェード、古いフィルムの質感'};
  for(const [key,mode] of Object.entries(MAGIC_MODES)){
    const b=document.createElement('button');b.innerHTML='<strong>'+mode.label+'</strong><small>'+desc[key]+'</small>';
    b.onclick=()=>{if(!state.project.clips.length){window.__subehaCut.toast('先に素材を読み込んでください');return;}
      const edited=magicEdit(state.project,key);state.project.clips=edited.clips;window.__subehaCut.save();window.__subehaCut.refreshAll();mini.hidden=true;window.__subehaCut.toast(mode.label+'の編集を適用しました。あとから個別変更・元に戻すことができます。');
    };mini.querySelector('#leap-magic-row').append(b);
  }
 }

 function openExtras(){
  mini.hidden=true;const options=[
   make('マジック編集','magic',()=>openMagicEdit()),
   make('キャンバス','canvas',()=>openTool('canvas')),
    make('クロマキー','filters',()=>openTool('chroma')),
   make('背景切抜','brush',()=>openTool('videoRetouch')),
   make('画像修復','brush',()=>openTool('retouch')),
   make('追跡','track',()=>openTool('tracking')),
   make('アニメ','key',()=>openTool('transform')),
   make('トランジション','transitions',()=>openTool('transitions')),
   make('静止','freeze',()=>openTool('freeze')),
   make('調整','adjust',()=>openTool('adjust')),
   make('テンプレ','template',()=>openTool('templates')),
   make('保存/復元','save',()=>openTool('project')),
   make('統合エンジン','cube',()=>window.__subehaHubOpen?.()),
   make('3D CG','cube',()=>window.__subehaCGOpen?.()),
   make('書き出す','save',()=>openTool('export')),
  ];
  const grid=$('leap-extras-grid');grid.replaceChildren();
  for(const item of options){const b=document.createElement('button');b.type='button';b.innerHTML=svg(item.icon)+`<span>${item.label}</span>`;b.onclick=item.onClick;grid.append(b);}sheet.hidden=false;
 }
 function openClipControl(kind){
  const clip=state.project.clips.find(c=>c.id===state.selectedClip);if(!clip){window.__subehaCut.toast('クリップを選択してください');return;}
  sheet.hidden=true;document.body.classList.remove('pro-open');document.querySelector('.tools-shell')?.classList.remove('pro-visible');
  const title=kind==='speed'?'速度':'音量';
  mini.innerHTML=`<header><button id="leap-mini-back" aria-label="閉じる">‹</button><strong>${title}</strong><button id="leap-mini-done">✓</button></header><div id="leap-mini-body"></div>`;mini.hidden=false;
  mini.querySelector('#leap-mini-back').onclick=mini.querySelector('#leap-mini-done').onclick=()=>{mini.hidden=true;};
  const body=mini.querySelector('#leap-mini-body');
  if(kind==='speed'){
   const choices=[.25,.5,.75,1,1.5,2,3,4];
   const row=document.createElement('div');row.className='leap-mini-options';
   for(const speed of choices){const b=document.createElement('button');b.textContent=speed+'×';b.className=(Number(clip.speed||1)===speed?'selected':'');b.onclick=()=>{apiUpdate(c=>c.speed=speed);row.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));};row.append(b);}body.append(row);
   const hint=document.createElement('p');hint.textContent='再生速度を選ぶとタイムラインの長さも変わります。';body.append(hint);
  }else{
   const label=document.createElement('label');label.className='leap-mini-volume';label.textContent='クリップ音量';
   const output=document.createElement('output');output.textContent=Math.round((clip.volume??1)*100)+'%';label.append(output);
   const range=document.createElement('input');range.type='range';range.min='0';range.max='200';range.step='1';range.value=Math.round((clip.volume??1)*100);range.oninput=()=>{output.textContent=range.value+'%';apiUpdate(c=>{c.volume=Number(range.value)/100;c.muted=false;});};label.append(range);body.append(label);
   const mute=document.createElement('button');mute.className='leap-mini-mute';mute.textContent=clip.muted?'ミュート解除':'ミュート';mute.onclick=()=>{apiUpdate(c=>{c.muted=!c.muted;});mute.textContent=clip.muted?'ミュート解除':'ミュート';};body.append(mute);
  }
 }
 function apiUpdate(fn){window.__subehaCut.updateClip(fn);}
 const clipTools=()=>[
  make('‹','back',()=>{modeState.mode='main';state.selectedClip=null;refreshAll();renderToolbar();}),
  make('分割','split',()=>$('split-clip')?.click()),
  make('速度','speed',()=>openClipControl('speed')),
  make('音量','volume',()=>openClipControl('volume')),
  make('フィルター','filters',()=>openTool('look')),
  make('調整','adjust',()=>openTool('adjust')),
  make('切り抜き','crop',()=>openTool('crop')),
  make('変形','canvas',()=>openTool('transform')),
  make('転換','transitions',()=>openTool('transitions')),
  make('複製','duplicate',()=>$('dup-clip')?.click()),
  make('削除','delete',()=>$('delete-clip')?.click()),
  make('すべて','more',()=>openExtras()),
 ];
 const layerTools=()=>[
  make('‹','back',()=>{modeState.mode='main';renderToolbar();}),
  make('レイヤー','overlay',()=>openTool('overlay')),
  make('キー合成','filters',()=>openTool('chroma')),
  make('追跡','track',()=>openTool('tracking')),
  make('切り抜き','brush',()=>openTool('videoRetouch')),
  make('すべて','more',()=>openExtras()),
 ];
 function renderToolbar(){
  const arr=modeState.mode==='clip'&&state.selectedClip?clipTools():modeState.mode==='layer'?layerTools():general;
  const current=toolstrip.dataset.mode;
  const key=modeState.mode==='clip'&&state.selectedClip?'clip':modeState.mode==='layer'?'layer':'main';
  if(current===key && toolstrip.childElementCount===arr.length)return;
  toolstrip.dataset.mode=key;toolstrip.replaceChildren();
  for(const item of arr){const b=document.createElement('button');b.type='button';b.className='leap-tool';b.innerHTML=svg(item.icon)+`<span>${item.label}</span>`;b.setAttribute('aria-label',item.label);if(item.label==='オーディオ')b.classList.add('has-badge');b.onclick=item.onClick;toolstrip.append(b);}
  toolstrip.scrollLeft=0;
 }
 function refreshMode(){
  if(modeState.mode==='clip'&&!state.selectedClip)modeState.mode='main';
  renderToolbar();
  const empty=!state.project.clips.length;
  $('leap-split').disabled=empty||!state.selectedClip;
  $('leap-key').disabled=empty||!state.selectedClip;
  plus.classList.toggle('leap-empty-add',empty);
 }
 timeline.addEventListener('click',e=>{
  if(e.target.closest('[data-clip-id]')){modeState.mode='clip';requestAnimationFrame(refreshMode);}
  else if(e.target.closest('[data-layer-id]')){modeState.mode='layer';requestAnimationFrame(refreshMode);}
  else if(e.target.closest('[data-audio-id]')){modeState.mode='main';requestAnimationFrame(refreshMode);}
 });
 window.addEventListener('subeha-cut-change',()=>requestAnimationFrame(refreshMode));
 help.onclick=()=>{sheet.hidden=false;const grid=$('leap-extras-grid');grid.innerHTML='<p class="leap-guide">タイムラインを左右にスワイプして再生位置を変更。クリップの端を動かしてトリム。クリップをタップすると編集メニューに切り替わります。2本指で時間軸を拡大できます。</p>';};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){mini.hidden=true;sheet.hidden=true;document.body.classList.remove('pro-open');document.querySelector('.tools-shell').classList.remove('pro-visible');}});
 renderToolbar();refreshMode();
}
if($('cut-touch-workspace'))installShell();
else window.addEventListener('subeha-cut-ready',()=>queueMicrotask(installShell),{once:true});
