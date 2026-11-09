import {removeConnectedBackground,cloneBrush} from './image-retouch.mjs';
import {EDIT_TEMPLATES,applyEditTemplate} from './edit-templates.mjs';

/* Progressive image-only editor. Uses existing PWA project, asset and history services. */
const $=id=>document.getElementById(id);
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number(n)||0));
const clean=(value)=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const imageLimits={maxDimension:1500};
function blobFromCanvas(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('画像の保存に失敗しました')),'image/png'));}
function imageCanvas(image){
 const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
 const scale=Math.min(1,imageLimits.maxDimension/Math.max(w,h));
 const result=document.createElement('canvas');result.width=Math.max(1,Math.round(w*scale));result.height=Math.max(1,Math.round(h*scale));
 const context=result.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,result.width,result.height);
 return result;
}
export function mountRetouchStudio(api,{panel,closeDrawer}={}){
 const {state,canvas,buildAsset,save,refreshAll,draw,selectedClip,updateClip,newID,toast}=api;
 const nav=document.querySelector('.bottomnav');
 const addButton=(key,icon,title)=>{const b=document.createElement('button');b.type='button';b.className='nav-tab pro-nav';b.innerHTML='<span>'+icon+'</span>'+title;b.dataset.retouch=key;nav.append(b);return b;};
 const retouchButton=addButton('image','✥','写真修復');
 const templateButton=addButton('template','▦','テンプレ');
 const open=(title,body,button)=>{
  document.querySelector('.tools-shell')?.classList.remove('pro-visible');
  nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));
  panel(title,body);
 };
 function currentImage(){
  const clip=selectedClip(),asset=clip&&state.assets.get(clip.assetId);
  if(!clip||asset?.type!=='image'||!asset.image)throw Error('タイムラインから静止画像クリップを選択してください（動画は未対応）');
  return {clip,asset};
 }
 async function saveProcessedImage(image,source,{layer=false}={}){
  const out=document.createElement('canvas');out.width=image.width;out.height=image.height;
  out.getContext('2d').putImageData(new ImageData(image.data,image.width,image.height),0,0);
  const blob=await blobFromCanvas(out),id=newID(),name='retouched-'+String(source.asset.name||'picture').replace(/[^a-zA-Z0-9._-]/g,'_')+'.png';
  // Persist the asset first: failure to store must not mutate the project.
  if(!window.__subehaSaveAsset)throw Error('端末保存が利用できません');
  await window.__subehaSaveAsset(id,blob,'image',name);
  await buildAsset(id,blob,'image',name);
  if(layer){
   state.project.overlays ||= [];
   state.project.overlays.push({id:newID(),assetId:id,start:state.current,duration:Math.min(5,Math.max(1,api.duration(state.project.clips)-state.current)),x:.5,y:.5,scale:.9,rotation:0,opacity:1,blend:'normal',mask:'rect',keyframes:[]});
   save();refreshAll();draw();
  }else updateClip(c=>{if(c.id===source.clip.id){c.assetId=id;c.name=name;}});
  toast(layer?'切り抜き画像を新規レイヤーとして追加しました':'修復した写真を新しい素材として保存しました');
 }
 function openRetouch(){
  let source;
  try{source=currentImage();}catch(e){open('写真修復','<p>'+clean(e.message)+'</p><p class="pro-tip">静止画だけを対象にしたローカル処理です。人物AI切り抜き・動画の不要物除去ではありません。</p>',retouchButton);return;}
  const original=imageCanvas(source.asset.image),w=original.width,h=original.height;
  const preview=document.createElement('canvas');preview.id='retouch-preview';
  const scale=Math.min(1,420/Math.max(w,h));preview.width=Math.max(1,Math.round(w*scale));preview.height=Math.max(1,Math.round(h*scale));
  const controls='<p class="pro-tip">色領域切り抜きは背景を1回タップ。クローン修復は「消す場所→コピー元」の順にタップしてください。**静止画像のみ**。出力は最大1500pxに縮小します。</p>'+ 
   '<div class="pro-inline"><button id="retouch-mode-cut" class="pro-primary">背景を透明化</button><button id="retouch-mode-clone">クローン修復</button></div>'+ 
   '<div id="retouch-preview-holder"></div>'+ 
   '<p id="retouch-point-status" class="pro-tip">背景をタップして削除する範囲を指定</p>'+ 
   '<label class="retouch-slider">色の許容差 <output id="retouch-tolerance-value">52</output><input id="retouch-tolerance" type="range" min="4" max="150" step="2" value="52"></label>'+ 
   '<label class="retouch-slider">境界ぼかし <output id="retouch-feather-value">2</output><input id="retouch-feather" type="range" min="0" max="10" step="1" value="2"></label>'+ 
   '<label class="retouch-slider" id="retouch-radius-group" hidden>修復ブラシ半径 <output id="retouch-radius-value">32</output><input id="retouch-radius" type="range" min="5" max="160" step="1" value="32"></label>'+ 
   '<div class="pro-inline"><button id="retouch-apply" class="pro-primary">✓ 加工して写真を置換</button><button id="retouch-layer">＋ 切り抜きを新レイヤーへ</button></div>'+
   '<p class="pro-tip">元の写真は端末内に残り、取り消しから編集を戻せます。単色背景は取りやすい一方、髪・複雑な背景・物体の裏側は精密には処理できません。</p>';
  open('静止画修復 / 切り抜き',controls,retouchButton);
  $('retouch-preview-holder').append(preview);
  let mode='cut',seed=null,target=null,cloneSource=null;
  const drawing=preview.getContext('2d',{willReadFrequently:true});
  const scratch=document.createElement('canvas');scratch.width=preview.width;scratch.height=preview.height;
  const sc=scratch.getContext('2d',{willReadFrequently:true});
  const spot=(p,color)=>{if(!p)return;drawing.strokeStyle=color;drawing.lineWidth=2;drawing.beginPath();drawing.arc(p.x/w*preview.width,p.y/h*preview.height,7,0,Math.PI*2);drawing.stroke();};
  function refresh(){
   const pw=preview.width,ph=preview.height;
   sc.clearRect(0,0,pw,ph);sc.drawImage(original,0,0,pw,ph);
   const point=p=>({x:Math.round(p.x/w*pw),y:Math.round(p.y/h*ph)});
   if(mode==='cut'&&seed){
    const edited=removeConnectedBackground(sc.getImageData(0,0,pw,ph),{...point(seed),tolerance:Number($('retouch-tolerance').value),feather:Number($('retouch-feather').value)*pw/w});
    sc.putImageData(new ImageData(edited.image.data,pw,ph),0,0);
   }else if(mode==='clone'&&target&&cloneSource){
    const edited=cloneBrush(sc.getImageData(0,0,pw,ph),{targetX:point(target).x,targetY:point(target).y,sourceX:point(cloneSource).x,sourceY:point(cloneSource).y,radius:Math.max(1,Number($('retouch-radius').value)*pw/w),softness:.45});
    sc.putImageData(new ImageData(edited.image.data,pw,ph),0,0);
   }
   // Checkerboard makes transparent regions immediately visible before committing the edit.
   drawing.clearRect(0,0,pw,ph);
   for(let y=0;y<ph;y+=12)for(let x=0;x<pw;x+=12){drawing.fillStyle=(Math.floor(x/12)+Math.floor(y/12))%2?'#50525c':'#30323c';drawing.fillRect(x,y,12,12);}
   drawing.drawImage(scratch,0,0);spot(seed,'#ff4f6a');spot(target,'#ff4f6a');spot(cloneSource,'#70f6b2');
  }
  function setMode(next){mode=next;seed=target=cloneSource=null;$('retouch-mode-cut').classList.toggle('pro-primary',mode==='cut');$('retouch-mode-clone').classList.toggle('pro-primary',mode==='clone');$('retouch-radius-group').hidden=mode!=='clone';$('retouch-layer').hidden=mode!=='cut';$('retouch-point-status').textContent=mode==='cut'?'背景をタップして色を選択':'除去対象の中心をタップし、次にコピー元をタップ';refresh();}
  preview.addEventListener('pointerdown',e=>{
   const r=preview.getBoundingClientRect();const p={x:Math.round(clamp((e.clientX-r.left)/r.width,0,1)*(w-1)),y:Math.round(clamp((e.clientY-r.top)/r.height,0,1)*(h-1))};
   if(mode==='cut'){seed=p;$('retouch-point-status').textContent='選択: '+p.x+', '+p.y;}else if(!target||cloneSource){target=p;cloneSource=null;$('retouch-point-status').textContent='コピー元を指定してください';}else{cloneSource=p;$('retouch-point-status').textContent='修復範囲を確定しました';}
   refresh();
  });
  for(const name of ['tolerance','feather','radius'])$("retouch-"+name).addEventListener('input',e=>{$('retouch-'+name+'-value').textContent=e.target.value;refresh();});
  $('retouch-mode-cut').onclick=()=>setMode('cut');$('retouch-mode-clone').onclick=()=>setMode('clone');
  async function perform(asLayer){
   if(state.recording)return toast('書き出し中は加工できません');
   const selected=selectedClip();if(selected?.id!==source.clip.id)return toast('編集中のクリップが切り替わりました。修復画面を開き直してください');
   if(mode==='cut'&&!seed)return toast('削除する背景の位置をタップしてください');
   if(mode==='clone'&&(!target||!cloneSource))return toast('除去対象とコピー元を2か所タップしてください');
   const button=$('retouch-apply');button.disabled=true;
   try{
    const c=original.getContext('2d',{willReadFrequently:true}),data=c.getImageData(0,0,w,h);
    const result=mode==='cut'?removeConnectedBackground(data,{...seed,tolerance:Number($('retouch-tolerance').value),feather:Number($('retouch-feather').value)}):cloneBrush(data,{targetX:target.x,targetY:target.y,sourceX:cloneSource.x,sourceY:cloneSource.y,radius:Number($('retouch-radius').value),softness:.45});
    if(mode==='cut'&&result.ratio>.97)throw Error('画像のほぼ全体が選択されました。許容差を小さくしてください');
    await saveProcessedImage(result.image,source,{layer:asLayer});closeDrawer?.();
   }catch(e){console.error(e);toast('加工失敗: '+e.message);}finally{button.disabled=false;}
  }
  $('retouch-apply').onclick=()=>perform(false);$('retouch-layer').onclick=()=>perform(true);
  setMode('cut');
 }
 function openTemplates(){
  const content='<p class="pro-tip">独自の編集可能なデザイン。既存の動画・音声や字幕を保持し、選択中のクリップに色味とエフェクトを適用、新しいタイトルを追加します。</p><label class="pro-select">タイトル文字 <input id="cut-template-text" maxlength="160" value="YOUR TITLE" type="text"></label>'+ 
   '<div class="retouch-template-grid">'+Object.entries(EDIT_TEMPLATES).map(([key,t])=>'<button type="button" data-cut-template="'+key+'"><strong>'+clean(t.name)+'</strong><small>'+clean(t.subtitle)+'</small></button>').join('')+'</div>'+
   '<p class="pro-tip">素材の差し替えや既存トラックの削除は行いません。アスペクト比・文字・色調は適用後に通常の編集ツールで調整できます。</p>';
  open('編集テンプレート',content,templateButton);
  $('pro-content').querySelectorAll('[data-cut-template]').forEach(button=>button.onclick=()=>{
   try{if(state.recording)throw Error('書き出し中はテンプレートを変更できません');
    const id=newID(),next=applyEditTemplate(state.project,button.dataset.cutTemplate,{id,clipId:state.selectedClip,start:Math.min(state.current,Math.max(0,api.duration(state.project.clips)-.2)),title:$('cut-template-text').value});
    api.loadProjectSnapshot(next);toast('テンプレートを適用しました。文字と効果は自由に編集できます');closeDrawer?.();
   }catch(e){toast(e.message);}
  });
 }
 retouchButton.onclick=openRetouch;templateButton.onclick=openTemplates;
 return {openRetouch,openTemplates};
}
