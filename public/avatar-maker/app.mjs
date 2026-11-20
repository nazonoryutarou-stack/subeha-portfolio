import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin} from '@pixiv/three-vrm';
import {PARAMS,CATEGORY_OPTIONS,COLOR_FIELDS,PRESETS,DEFAULT_AVATAR,normalizeAvatar,applyPreset,toProject,fromProject,randomAvatar} from './model.mjs';
import {buildAvatar,posePreview,disposeAvatar} from './geometry.mjs';
import {exportGLB,addVRMExtension,verifyVRM} from './export-vrm.mjs';

const $=id=>document.getElementById(id);
const STORAGE='avatar-atelier-project-v1';
const TABS={face:'顔',hair:'髪型',body:'体型',clothes:'衣装',accessory:'装飾',color:'色',presets:'プリセット'};
const selectFields={
 face:[['eyeStyle','目の形']],hair:[['hairStyle','髪型'],['hairPart','前髪の分け目']],
 clothes:[['topStyle','トップス'],['bottomStyle','ボトムス']],accessory:[['accessory','アクセサリー']]
};
let avatar=(()=>{try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');return saved?.schema==='avatar-atelier/v1'?fromProject(saved):normalizeAvatar(DEFAULT_AVATAR);}catch{return normalizeAvatar(DEFAULT_AVATAR);}})();
let tab='face',model=null,engine=null,previewExpression='neutral',animate=true,angle=0,loading=false;
let history=[],future=[],gestureSnapshot=null,buildTimer=null,savingTimer=null,randomSeed=Date.now()>>>0;
let drawingHair=false,activeHairPointer=null;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xf3eff3);
const camera=new THREE.PerspectiveCamera(35,1,.01,120);
const $status=$('status');
const status=(message,error=false)=>{$status.textContent=message;$status.classList.toggle('is-error',error);};
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;};
const download=(blob,name)=>{const uri=URL.createObjectURL(blob),link=document.createElement('a');link.href=uri;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(uri),20000);};
const nameFile=(name,ext)=>String(name||'avatar').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,55)+'.'+ext;
function init(){
 const host=$('canvas-host');let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});}
 catch(e){status('WebGLが起動できません。この端末のブラウザ設定を確認してください。',true);return;}
 renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 host.append(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xfff5ee,0x655b7d,2.5));
 const light=new THREE.DirectionalLight(0xffffff,3.1);light.position.set(3.7,6.3,4.9);scene.add(light);
 const fill=new THREE.DirectionalLight(0xd8d4ff,1.1);fill.position.set(-4,3.1,-2);scene.add(fill);
 camera.position.set(0,1.25,3.45);
 const control=new OrbitControls(camera,renderer.domElement);
 control.target.set(0,1.1,0);
 control.minDistance=.65;control.maxDistance=7.2;
 control.minPolarAngle=.2;control.maxPolarAngle=Math.PI*.79;
 control.enablePan=false;control.enableDamping=true;control.dampingFactor=.07;
 const resize=()=>{const w=Math.max(50,host.clientWidth),h=Math.max(50,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 engine={renderer,control,observer};
 installHairCanvas(renderer.domElement);
 const clock=new THREE.Clock();
 const tick=()=>{requestAnimationFrame(tick);const dt=Math.min(.05,clock.getDelta());control.update();if(model&&!loading){
  // In real avatar exports, animation is stopped and rest pose is restored.
  posePreview(model,clock.elapsedTime,previewExpression,animate?'wave':'idle');
  if(!animate){for(const bone of Object.values(model.bones))bone.rotation.set(0,0,0);}
 }
 renderer.render(scene,camera);};
 tick();rebuild();
}
function persist(){
 clearTimeout(savingTimer);
 savingTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(toProject(avatar)));}catch(e){console.warn('Save unavailable',e);}},400);
}
function pushHistory(value){
 history.push(structuredClone(value));if(history.length>60)history.shift();future=[];
 updateUndo();
}
function updateUndo(){
 $('undo').disabled=!history.length;$('redo').disabled=!future.length;
}
function updateAvatar(fn,{undo=false}={}){
 if(loading)return;
 if(undo)pushHistory(avatar);
 avatar=normalizeAvatar(fn({...avatar}));
 scheduleRebuild();persist();updateSelectionUI();
}
function resetCamera(){
 if(!engine)return;
 engine.control.target.set(0,1.1,0);
 camera.position.set(0,1.25,3.45);engine.control.update();angle=0;
}
function scheduleRebuild(immediate=false){
 if(buildTimer!==null)clearTimeout(buildTimer);
 buildTimer=setTimeout(()=>{buildTimer=null;rebuild();},immediate?0:78);
}
function rebuild(){
 if(!engine)return;
 try{
  const next=buildAvatar(avatar);
  if(model){scene.remove(model.root);disposeAvatar(model);}
  model=next;scene.add(model.root);model.root.updateMatrixWorld(true);
  status('モデルを更新しました。顔・髪・体型・衣装を調整できます。');
 }catch(e){console.error('Avatar build failure',e);status('モデル生成に失敗: '+e.message,true);}
}
function addTitle(parent,text){
 const t=node('h3','',text);parent.append(t);
}
function section(parent,title){
 const div=node('section','panel-section');addTitle(div,title);parent.append(div);return div;
}
function slider(parent,key){
 const def=PARAMS[key];if(!def)return;
 const box=node('div','property');
 const head=node('div','property-head'),label=node('span','',def.title),output=node('output','',formatValue(key,avatar[key]));head.append(label,output);
 const input=node('input');input.type='range';input.min=def.min;input.max=def.max;input.step=def.step;input.value=String(avatar[key]);input.setAttribute('aria-label',def.title);
 const start=()=>{if(gestureSnapshot===null)gestureSnapshot=structuredClone(avatar);};
 input.addEventListener('pointerdown',start);
 input.addEventListener('touchstart',start,{passive:true});
 input.addEventListener('input',()=>{if(gestureSnapshot===null)start();const n=Number(input.value);output.textContent=formatValue(key,n);updateAvatar(a=>({...a,[key]:n}));});
 input.addEventListener('change',()=>{if(gestureSnapshot!==null&&JSON.stringify(gestureSnapshot)!==JSON.stringify(avatar))pushHistory(gestureSnapshot);gestureSnapshot=null;});
 box.append(head,input);parent.append(box);
}
function formatValue(key,value){
 const v=Number(value);
 if(['eyeTilt','eyebrowTilt','mouthSmile'].includes(key))return (v>0?'+':'')+v.toFixed(2);
 if(key==='hairWaves'||key==='collarHeight'||key==='sleeveLength')return Math.round(v*100)+'%';
 return Math.round(v*100)+'%';
}
function choiceGroup(parent,key,title){
 const options=CATEGORY_OPTIONS[key];if(!options)return;
 const parentSection=section(parent,title),grid=node('div','option-grid');
 for(const [value,text] of options){
  const button=node('button','option-button'+(avatar[key]===value?' active':''),text);button.type='button';button.dataset.choiceKey=key;button.dataset.choiceValue=value;
  button.setAttribute('aria-pressed',String(avatar[key]===value));
  button.onclick=()=>{if(avatar[key]===value)return;updateAvatar(a=>({...a,[key]:value}),{undo:true});renderPanel();};
  grid.append(button);
 }
 parentSection.append(grid);
}
function note(parent,msg){parent.append(node('p','panel-note',msg));}
function parameterGroup(parent,tabName){
 const keys=Object.keys(PARAMS).filter(key=>PARAMS[key].tab===tabName);
 if(!keys.length)return;
 const panel=section(parent,'パラメータ');
 for(const key of keys)slider(panel,key);
}
function renderPanel(){
 $('panel-title').textContent=TABS[tab]||'編集';
 const root=$('panel-content');root.replaceChildren();
 if(tab==='face'){
  choiceGroup(root,'eyeStyle','目の形');
  parameterGroup(root,'face');
  note(root,'顔の輪郭、目・眉・鼻・口のサイズをスライダーで変更します。表情のプレビューは左側の「表情テスト」。');
 }else if(tab==='hair'){
  choiceGroup(root,'hairStyle','髪のスタイル');
  choiceGroup(root,'hairPart','前髪');
  parameterGroup(root,'hair');
  const hairPainter=section(root,'指で毛束を描く');
  const controls=node('div','hair-drawing-actions');
  const draw=node('button','option-button hair-draw-button'+(drawingHair?' active':''),drawingHair?'描画中 · 終了する':'✎ 髪を描く');
  draw.setAttribute('aria-pressed',String(drawingHair));
  draw.onclick=()=>setHairDrawing(!drawingHair);
  const remove=node('button','option-button','最後の毛束を削除');
  remove.disabled=!avatar.customHair.length;
  remove.onclick=()=>{
   if(!avatar.customHair.length)return;
   updateAvatar(a=>({...a,customHair:a.customHair.slice(0,-1)}),{undo:true});renderPanel();
  };
  const count=node('small','hair-strand-count',avatar.customHair.length+' 本の毛束を描画済み');
  controls.append(draw,remove);hairPainter.append(controls,count);
  note(root,'描画をONにすると正面カメラへ移動します。頭の上から下へ指を滑らせて前髪を描き足します。毛束は頭の3Dボーンに付き、エクスポートにも含まれます。');
 }else if(tab==='body'){
  parameterGroup(root,'body');
  note(root,'体型変更時もヒューマノイドボーンの階層を維持します。');
 }else if(tab==='clothes'){
  choiceGroup(root,'topStyle','トップス');
  choiceGroup(root,'bottomStyle','ボトムス');
  parameterGroup(root,'clothes');
  note(root,'衣装は独立した立体形状として生成します。VRoid StudioのテクスチャペイントやXWear互換とは異なります。');
 }else if(tab==='accessory'){
  choiceGroup(root,'accessory','アクセサリー');
  note(root,'装飾はモデルと一緒にエクスポートされます。');
 }else if(tab==='color'){
  const panel=section(root,'カラーパレット');
  for(const {key,label} of COLOR_FIELDS){
   const box=node('div','color-row'),labelEl=node('label','',label),color=node('input');color.type='color';color.value=avatar[key];color.setAttribute('aria-label',label);
   const code=node('span','color-code',avatar[key]);
   color.addEventListener('focus',()=>{if(gestureSnapshot===null)gestureSnapshot=structuredClone(avatar);});
   color.addEventListener('input',()=>{code.textContent=color.value;updateAvatar(a=>({...a,[key]:color.value}));});
   color.addEventListener('change',()=>{if(gestureSnapshot!==null)pushHistory(gestureSnapshot);gestureSnapshot=null;});
   box.append(labelEl,color,code);panel.append(box);
  }
 }else if(tab==='presets'){
  const panel=section(root,'スタイルセット'),grid=node('div','option-grid preset-grid');
  for(const preset of PRESETS){
   const button=node('button','option-button preset-tile',preset.label);button.type='button';
   button.onclick=()=>{updateAvatar(()=>applyPreset(preset.id,avatar),{undo:true});renderPanel();};
   grid.append(button);
  }
  panel.append(grid);
  note(root,'セットを選んだあとも、顔・髪・体型・衣装を自由に調整できます。');
 }
}
function updateSelectionUI(){
 for(const b of document.querySelectorAll('[data-choice-key]')){
  const value=avatar[b.dataset.choiceKey]===b.dataset.choiceValue;
  b.classList.toggle('active',value);b.setAttribute('aria-pressed',String(value));
 }
}
function setTab(next){
 if(next!=='hair'&&drawingHair)setHairDrawing(false);
 tab=next;for(const btn of $('categories').querySelectorAll('button'))btn.classList.toggle('active',btn.dataset.tab===tab);
 renderPanel();
}
function historyMove(direction){
 gestureSnapshot=null;
 const from=direction==='undo'?history:future,to=direction==='undo'?future:history;
 if(!from.length)return;to.push(structuredClone(avatar));avatar=normalizeAvatar(from.pop());
 updateUndo();renderPanel();scheduleRebuild();persist();
}
function resetTab(){
 const keys=Object.keys(PARAMS).filter(k=>PARAMS[k].tab===tab);
 const categorical=Object.keys(selectFields).includes(tab)?selectFields[tab].map(x=>x[0]):[];
 if(tab==='color'){updateAvatar(a=>{for(const {key} of COLOR_FIELDS)a[key]=DEFAULT_AVATAR[key];return a;},{undo:true});}
 else if(tab==='presets'){updateAvatar(()=>normalizeAvatar(DEFAULT_AVATAR),{undo:true});}
 else{updateAvatar(a=>{for(const k of [...keys,...categorical])a[k]=DEFAULT_AVATAR[k];if(tab==='hair')a.customHair=[];return a;},{undo:true});}
 renderPanel();
}
function saveProject(){
 const bytes=new Blob([JSON.stringify(toProject(avatar),null,2)],{type:'application/json'});
 download(bytes,nameFile(avatar.name,'avatar.json'));
 status('編集設定を保存しました。VRMファイル本体とは別です。');
}
async function loadProject(file){
 if(!file)return;
 if(file.size>512000){status('設定ファイルが大きすぎます。',true);return;}
 try{
  const input=fromProject(JSON.parse(await file.text()));
  updateAvatar(()=>input,{undo:true});
  renderPanel();status('キャラクター設定を読み込みました。');
 }catch(e){status('読み込みに失敗: '+e.message,true);}
}
async function validateOutput(buffer){
 const loader=new GLTFLoader();
 loader.register(parser=>new VRMLoaderPlugin(parser));
 const decoded=await loader.parseAsync(buffer,'');
 if(!decoded.userData.vrm)throw Error('three-vrmでVRMとして再読み込みできません');
 // Parse-only smoke test; do not publish or upload user-owned avatars.
 decoded.scene.traverse(x=>{if(x.geometry)x.geometry.dispose();});
}
function neutralPose(){
 if(!model)return;
 for(const bone of Object.values(model.bones))bone.rotation.set(0,0,0);
 for(const mesh of [...model.eyeMeshes,...model.mouthMeshes])mesh.morphTargetInfluences.fill(0);
 model.root.updateMatrixWorld(true);
}
async function exportModel(asVRM){
 if(loading||!model)return;
 loading=true;const btn=asVRM?$('export-vrm'):$('export-glb');
 btn.disabled=true;let label=btn.textContent;
 btn.textContent='処理中…';status('3Dモデルを保存用データに変換しています…');
 try{
  neutralPose();
  const glb=await exportGLB(model.root);
  if(asVRM){
   const options={
    name:$('model-name').value||avatar.name,author:$('model-author').value||avatar.author,
    publicUse:$('lic-public').checked,commercial:$('lic-commercial').checked,
    religious:$('lic-religious').checked,redistribute:$('lic-redistribute').checked,
    credit:$('lic-credit').checked
   };
   const vrm=addVRMExtension(glb,options);
   const summary=verifyVRM(vrm);
   if(!summary.skins)throw Error('書き出されたモデルにスキニング情報がありません');
   status('書き出したVRMを再読込して検査しています…');
   await validateOutput(vrm);
   download(new Blob([vrm],{type:'model/gltf-binary'}),nameFile(options.name,'vrm'));
   status('VRM 1.0を保存しました。必要ならVRM STAGEへ読み込んでください。');
  }else{
   download(new Blob([glb],{type:'model/gltf-binary'}),nameFile(avatar.name,'glb'));
   status('GLBモデルを保存しました。');
  }
 }catch(e){
  console.error('Export error',e);
  status('書き出しに失敗: '+(e?.message||e)+'。GLBでの保存も試せます。',true);
 }finally{
  loading=false;btn.disabled=false;btn.textContent=label;
 }
}
function saveImage(){
 if(!engine?.renderer||!model)return;
 const canvas=engine.renderer.domElement;
 engine.renderer.render(scene,camera);
 canvas.toBlob(blob=>{if(blob){download(blob,nameFile(avatar.name,'png'));status('現在のカメラ位置でPNG保存しました。');}else status('PNGを保存できませんでした。',true);},'image/png');
}

function setHairDrawing(enabled){
 drawingHair=!!enabled;
 activeHairPointer=null;
 if(engine)engine.control.enabled=!drawingHair;
 if(drawingHair){
  animate=false;
  $('preview-animation').setAttribute('aria-pressed','false');
  $('preview-animation').textContent='動作テスト OFF';
  resetCamera();
  camera.position.set(0,1.65,1.65);
  engine?.control.target.set(0,1.64,0);
  engine?.control.update();
  status('描画モード：髪の毛を上から下へ指でなぞってください。');
 }else status('描画を終了しました。毛束はモデルの一部として残ります。');
 if(tab==='hair')renderPanel();
}
function installHairCanvas(canvas){
 const caster=new THREE.Raycaster(),mouse=new THREE.Vector2();
 const pointAt=e=>{
  if(!model)return null;
  const box=canvas.getBoundingClientRect();
  if(box.width<10||box.height<10)return null;
  mouse.set(((e.clientX-box.left)/box.width)*2-1,1-((e.clientY-box.top)/box.height)*2);
  caster.setFromCamera(mouse,camera);
  const head=model.bones.head,center=new THREE.Vector3();
  model.root.updateMatrixWorld(true);head.getWorldPosition(center);
  const scale=avatar.headSize*avatar.bodyHeight;
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,0,1),center.clone().add(new THREE.Vector3(0,0,.245*scale)));
  const hit=caster.ray.intersectPlane(plane,new THREE.Vector3());
  if(!hit)return null;
  const local=head.worldToLocal(hit.clone());
  const xyz=[local.x/scale,local.y/scale,local.z/scale];
  if(Math.abs(xyz[0])>.65||xyz[1]<-1.45||xyz[1]>.65)return null;
  return xyz.map(n=>+n.toFixed(4));
 };
 canvas.addEventListener('pointerdown',e=>{
  if(!drawingHair||!model||activeHairPointer!==null)return;
  if(avatar.customHair.length>=36){status('毛束は36本まで追加できます。');return;}
  const point=pointAt(e);if(!point)return;
  e.preventDefault();e.stopPropagation();
  canvas.setPointerCapture(e.pointerId);activeHairPointer=e.pointerId;
  pushHistory(avatar);
  const copy=structuredClone(avatar);
  copy.customHair=[...copy.customHair,[point,[point[0],point[1]-.023,point[2]]]];
  avatar=normalizeAvatar(copy);scheduleRebuild();persist();
 },true);
 canvas.addEventListener('pointermove',e=>{
  if(!drawingHair||activeHairPointer!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();
  const point=pointAt(e);if(!point)return;
  const current=avatar.customHair.at(-1);if(!current)return;
  const previous=current.at(-1);
  if(Math.hypot(point[0]-previous[0],point[1]-previous[1],point[2]-previous[2])<.018)return;
  if(current.length>=72)return;
  const copy=structuredClone(avatar);
  copy.customHair.at(-1).push(point);
  avatar=normalizeAvatar(copy);scheduleRebuild();persist();
 },true);
 const release=e=>{
  if(activeHairPointer!==e.pointerId)return;
  activeHairPointer=null;if(tab==='hair')renderPanel();
  status('毛束を追加しました。必要ならUndoで元に戻せます。');
 };
 canvas.addEventListener('pointerup',release,true);
 canvas.addEventListener('pointercancel',release,true);
}

function initUI(){
 for(const b of $('categories').querySelectorAll('button'))b.onclick=()=>setTab(b.dataset.tab);
 $('reset-category').onclick=resetTab;
 $('undo').onclick=()=>historyMove('undo');$('redo').onclick=()=>historyMove('redo');
 $('random').onclick=()=>{updateAvatar(()=>randomAvatar(randomSeed++),{undo:true});renderPanel();};
 $('reset-camera').onclick=resetCamera;
 $('turn-camera').onclick=()=>{if(!engine)return;angle=(angle+1)%4;const a=angle*Math.PI/2;camera.position.set(Math.sin(a)*3.45,1.25,Math.cos(a)*3.45);engine.control.update();};
 $('preview-expression').onchange=e=>{previewExpression=e.target.value;};
 $('preview-animation').onclick=()=>{animate=!animate;$('preview-animation').setAttribute('aria-pressed',String(animate));$('preview-animation').textContent=animate?'動作テスト ON':'動作テスト OFF';};
 $('image-save').onclick=saveImage;
 const dialog=$('export-dialog');
 $('open-export').onclick=()=>{$('model-name').value=avatar.name;$('model-author').value=avatar.author;dialog.showModal();};
 $('export-vrm').onclick=()=>exportModel(true);$('export-glb').onclick=()=>exportModel(false);
 $('project-save').onclick=saveProject;$('project-save-dialog').onclick=saveProject;
 $('project-load').onclick=()=>$('project-file').click();
 $('project-file').onchange=e=>{loadProject(e.target.files?.[0]);e.target.value='';};
 $('model-name').addEventListener('change',e=>updateAvatar(a=>({...a,name:e.target.value}),{undo:true}));
 $('model-author').addEventListener('change',e=>updateAvatar(a=>({...a,author:e.target.value}),{undo:true}));
 updateUndo();renderPanel();
}
initUI();init();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline shell disabled',e));
