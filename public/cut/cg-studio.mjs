/** In-editor OBJ cinematography studio: local assets, WebGL, timeline and project archive. */
import {parseOBJ,defaultCGScene,MOTIONS,evaluateCG,updateSceneKey,OBJ_LIMIT_BYTES} from './obj-core.mjs';
import {parseStaticGLB,VRM_LIMIT_BYTES} from './vrm-lite.mjs';
import {createOBJRenderer} from './obj-renderer.mjs';
const $=id=>document.getElementById(id);
const isGLB=name=>/\.(vrm|glb)$/i.test(name||'');
async function parse3DAsset(blob,name){return isGLB(name)?parseStaticGLB(await blob.arrayBuffer()):parseOBJ(await blob.text());}
const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function torusOBJ(){const lines=['o SampleTorus'],vertices=[],rings=28,sides=14;for(let i=0;i<rings;i++){const a=i/rings*Math.PI*2;for(let j=0;j<sides;j++){const b=j/sides*Math.PI*2,r=1.1+Math.cos(b)*.38;vertices.push([r*Math.cos(a),Math.sin(b)*.38,r*Math.sin(a)]);}}
 for(const v of vertices)lines.push('v '+v.join(' '));for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*sides+j+1,b=((i+1)%rings)*sides+j+1,c=((i+1)%rings)*sides+(j+1)%sides+1,d=i*sides+(j+1)%sides+1;lines.push(`f ${a} ${b} ${d}`,`f ${d} ${b} ${c}`);}return lines.join('\n');}
function bar(label,id,lo,hi,step,value){return `<label class="cg-slider">${label}<output id="${id}-val">${Number(value).toFixed(step<1?2:0)}</output><input id="${id}" type="range" min="${lo}" max="${hi}" step="${step}" value="${value}"></label>`;}
function makeBGImage(){return new Promise(resolve=>{const c=document.createElement('canvas');c.width=720;c.height=1280;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,720,1280);gr.addColorStop(0,'#111724');gr.addColorStop(.52,'#22283b');gr.addColorStop(1,'#090c14');g.fillStyle=gr;g.fillRect(0,0,720,1280);c.toBlob(b=>resolve(b),'image/png');});}
export function mountCGStudio(api,{panel,closeDrawer}={}){
 const {state,canvas,ctx,draw,renderHooks,save,refreshAll,buildAsset,newID,toast,seek}=api;
 state.project.cgScenes ||= [];
 let selected=null,renderer=null;const ready=new Set(),pending=new Map();let lastErr='';
 try{renderer=createOBJRenderer();}catch(e){lastErr=e.message;console.warn('CG WebGL',e);}
 const input=document.createElement('input');input.type='file';input.accept='.obj,.vrm,.glb,text/plain,model/obj,model/gltf-binary';input.hidden=true;input.id='cg-obj-picker';$('app').append(input);
 async function ensure(scene){const id=scene.modelAssetId;if(ready.has(id)||pending.has(id))return;
   const asset=state.assets.get(id);if(!asset?.blob||!renderer)return;
   const job=(async()=>{try{const geo=await parse3DAsset(asset.blob,asset.name);renderer.register(id,geo);ready.add(id);draw();}catch(e){console.warn('CG OBJ',e);lastErr=e.message;toast('3Dモデルを読み込めません: '+e.message);}finally{pending.delete(id);}})();pending.set(id,job);
 }
 function renderFrame(){if(!renderer||!state.project.cgScenes?.length)return;
   for(const scene of state.project.cgScenes){if(scene.visible===false||state.current<scene.start||state.current>scene.start+scene.duration)continue;
     if(!ready.has(scene.modelAssetId)){ensure(scene);continue;}
     try{const image=renderer.render(scene,scene.modelAssetId,state.current,canvas.width,canvas.height);if(image){ctx.save();ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.restore();}}catch(e){lastErr=e.message;console.warn('CG render',e);}
   }
 }
 async function createBaseIfNeeded(){if(state.project.clips.length)return;
   const blob=await makeBGImage();if(!blob)throw Error('背景画像を作れません');const id=newID();const a=await buildAsset(id,blob,'image','CG STAGE.png');a.duration=8;
   await window.__subehaSaveAsset?.(id,blob,'image','CG STAGE.png');const c={id:newID(),assetId:id,name:'CG STAGE',type:'image',start:0,end:8,speed:1,filter:'none'};state.project.clips.push(c);state.selectedClip=c.id;seek(0);
 }
 async function addOBJ(file){if(state.recording)return toast('書き出し中は追加できません');if(!file)return;
  if(file.size>(isGLB(file.name)?VRM_LIMIT_BYTES:OBJ_LIMIT_BYTES))return toast('OBJは12MB、VRM/GLBは48MB以内にしてください');
  try{const geometry=await parse3DAsset(file,file.name);if(!renderer)throw Error('端末がWebGLに対応していません');
      await createBaseIfNeeded();const id=newID();await buildAsset(id,file,'model',file.name);await window.__subehaSaveAsset?.(id,file,'model',file.name);
      renderer.register(id,geometry);ready.add(id);const time=Math.min(state.current,Math.max(0,api.duration(state.project.clips)-.2));
      const scene=defaultCGScene(id,file.name,time,Math.min(8,Math.max(.2,api.duration(state.project.clips)-time)),newID());
      if(geometry.rights)scene.modelRights=geometry.rights;
      if(file.name==='ring-demo.obj')scene.pitch=62;state.project.cgScenes.push(scene);selected=scene.id;save();refreshAll();open();toast(`3Dモデルを読み込みました: ${geometry.triangleCount.toLocaleString()}面`);
  }catch(e){console.error(e);toast('OBJエラー: '+e.message);}
 }
 input.addEventListener('change',async()=>{const f=input.files?.[0];input.value='';await addOBJ(f);});
 function active(){return state.project.cgScenes.find(s=>s.id===selected)||state.project.cgScenes.at(-1)||null;}
 function open(){const scenes=state.project.cgScenes,scene=active();selected=scene?.id||null;
  const list=scenes.map(s=>`<button type="button" class="cg-scene-button ${s.id===selected?'is-selected':''}" data-cg-scene="${safe(s.id)}">${safe(s.name)} <small>${s.start.toFixed(1)}s - ${(s.start+s.duration).toFixed(1)}s</small></button>`).join('');
  const fields=scene?[
    ['start','開始(秒)',0,180,.1],['duration','表示時間(秒)',.2,180,.1],['yaw','Y回転(°)',-360,360,1],['pitch','X回転(°)',-180,180,1],
    ['x','水平位置',-3,3,.02],['y','高さ',-3,3,.02],['scale','モデルサイズ',.1,5,.05],['camera','カメラ距離',2,12,.1],
    ['light','光の角度(°)',-180,180,1],['turns','回転周回数',0,5,.25]
  ]:[];
  panel('3D CG Studio',`<p class="pro-tip">OBJ / GLB / VRMの3D形状を読み込んで回転・移動・撮影できます。VRMは静止メッシュ表示のみで、骨格・表情・テクスチャは未対応です。</p><div class="pro-inline"><button class="pro-primary" id="cg-import">＋ 3Dモデルを読み込む</button><button id="cg-sample">◇ サンプルの3Dリング</button></div><div class="cg-scene-list">${list||'<p class="pro-tip">まだ3Dシーンがありません。</p>'}</div>${lastErr?`<p class="cg-warning">${safe(lastErr)}</p>`:''}${scene?`<div class="cg-edit">${scene.modelRights?`<div class="cg-warning"><strong>VRM素材の利用条件</strong><p>モデル名：${safe(scene.modelRights.name||scene.name)}／作者：${safe((scene.modelRights.authors||[]).join(', ')||'不明')}</p><p>商用利用条件：${safe(scene.modelRights.commercial)} ／ 宗教・政治用途：${safe(scene.modelRights.religious)}</p><p>用途と原典の条件を必ず確認してください。利用不可のモデルを宣伝に使わないでください。</p></div>`:''}<label class="pro-select">動き <select id="cg-motion">${Object.entries(MOTIONS).map(([k,v])=>`<option value="${k}" ${scene.motion===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="pro-select">材質色 <input type="color" id="cg-color" value="${safe(scene.color)}"></label><div class="cg-controls">${fields.map(([k,label,a,b,s])=>bar(label,'cg-'+k,a,b,s,scene[k])).join('')}</div><div class="pro-inline"><button id="cg-key">◆ 再生位置をキーに登録</button><button id="cg-clear-keys">キーを削除</button><button id="cg-visibility">${scene.visible===false?'表示':'非表示'}</button><button class="pro-danger" id="cg-delete">CGシーンを削除</button></div><p class="pro-tip">キーフレーム ${scene.keys?.length||0}件。追加後も通常の映像・音声編集が可能。3D素材のテクスチャ・骨格・表情アニメーションは未対応。WebGL非対応時は簡易2Dレンダラーへ切替。</p></div>`:''}`);
  $('cg-import').onclick=()=>input.click();$('cg-sample').onclick=async()=>{const src=torusOBJ(),file=new File([src],'ring-demo.obj',{type:'text/plain'});await addOBJ(file);};
  for(const b of $('pro-content').querySelectorAll('[data-cg-scene]'))b.onclick=()=>{selected=b.dataset.cgScene;open();};
  if(!scene)return;
  $('cg-motion').onchange=e=>{scene.motion=e.target.value;scene.keys=[];save();draw();};
  $('cg-color').oninput=e=>{scene.color=e.target.value;save();draw();};
  for(const [k]of fields){const el=$('cg-'+k);el.oninput=e=>{scene[k]=Number(e.target.value);$(el.id+'-val').textContent=Number(scene[k]).toFixed(Number(el.step)<1?2:0);save();draw();};}
  $('cg-key').onclick=()=>{const props={yaw:scene.yaw,pitch:scene.pitch,x:scene.x,y:scene.y,scale:scene.scale,camera:scene.camera,light:scene.light};updateSceneKey(scene,state.current,props);save();open();toast('現在の位置をキーフレームに登録');};
  $('cg-clear-keys').onclick=()=>{scene.keys=[];save();open();draw();};
  $('cg-visibility').onclick=()=>{scene.visible=!(scene.visible!==false);save();open();draw();};
  $('cg-delete').onclick=()=>{state.project.cgScenes=state.project.cgScenes.filter(s=>s.id!==scene.id);selected=state.project.cgScenes.at(-1)?.id||null;save();draw();open();};
 }
 // Register the render hook below the existing video overlays and titles.
 renderHooks.unshift(renderFrame);
 window.__subehaCGSelect=id=>{selected=id;open();};
 window.__subehaCGOpen=open;
 window.__subehaCGAPI={open,addOBJ,getRenderer:()=>renderer};
 window.addEventListener('subeha-cut-change',()=>{for(const s of state.project.cgScenes||[])if(!ready.has(s.modelAssetId))ensure(s);});
 for(const s of state.project.cgScenes||[])ensure(s);
 return {open,addOBJ,renderFrame};
}
