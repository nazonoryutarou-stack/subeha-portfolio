const $ = id=>document.getElementById(id);
const BUILD='2026-08-18 v3';
const canvas=$('stage'),ctx=canvas.getContext('2d',{willReadFrequently:true});
let original=null,current=null,history=[],abort=false,model=null,featureModel=null,sequenceFrames=[],compareMode=false,loadedProfile=null,busy=false;
const controls=['strength','steps','octaves','zoom','detail','color','tile'];
for(const id of controls){const el=$(id),out=$(id+'Out');const sync=()=>out.textContent=el.value;el.addEventListener('input',sync);sync();}
const presets={classic:{strength:1.1,steps:20,octaves:3,zoom:1.028,detail:.72,color:.28,tile:192},eyes:{strength:1.55,steps:26,octaves:3,zoom:1.032,detail:.92,color:.32,tile:192},fur:{strength:1.3,steps:22,octaves:3,zoom:1.02,detail:.98,color:.16,tile:192},architecture:{strength:1.35,steps:22,octaves:3,zoom:1.018,detail:.55,color:.12,tile:256},acid:{strength:2.1,steps:32,octaves:4,zoom:1.05,detail:.88,color:.72,tile:192},mild:{strength:.5,steps:10,octaves:2,zoom:1.012,detail:.45,color:.08,tile:192}};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const p=presets[b.dataset.preset];for(const[k,v]of Object.entries(p)){$(k).value=v;$(k).dispatchEvent(new Event('input'));}});
function status(s){$('status').textContent=`${s} ｜ ${BUILD}`}
function cloneImageData(x){return new ImageData(new Uint8ClampedArray(x.data),x.width,x.height)}
function drawData(data){canvas.width=data.width;canvas.height=data.height;ctx.putImageData(data,0,0);current=cloneImageData(data);$('drop').classList.add('hidden')}
function pushHistory(){if(current){history.push(cloneImageData(current));if(history.length>12)history.shift()}}
function withTimeout(p,ms,label){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(label)),ms))])}
function profileConfig(){const p=$('modelProfile').value;return p==='light'?{version:1,alpha:.25,name:'軽量 MobileNetV1 0.25'}:p==='balanced'?{version:1,alpha:.5,name:'標準 MobileNetV1 0.50'}:{version:2,alpha:.5,name:'高品質 MobileNetV2 0.50'}}
function disposeModel(){try{featureModel?.dispose()}catch{}try{model?.model?.dispose()}catch{}featureModel=null;model=null;loadedProfile=null}
$('modelProfile').addEventListener('change',()=>{disposeModel();status('モデル変更。次回Dream時に読み込みます')});
async function ensureModel(){
 const key=$('modelProfile').value;if(featureModel&&loadedProfile===key)return;
 disposeModel();const cfg=profileConfig();
 if(typeof tf==='undefined')throw new Error('TensorFlow.js本体が読み込めていません');
 if(typeof mobilenet==='undefined')throw new Error('MobileNetライブラリが読み込めていません');
 status(`TensorFlow初期化中 (${cfg.name})`);
 try{
  await withTimeout(tf.ready(),12000,'TensorFlow初期化が12秒を超えました');
  status(`バックエンド確認中 (${tf.getBackend()||'未確定'})`);
  if(tf.getBackend()!=='webgl'){
   try{await withTimeout(tf.setBackend('webgl'),8000,'WebGL初期化失敗');await tf.ready()}catch(e){console.warn(e);status('WebGL不可。CPUへ切替中');await withTimeout(tf.setBackend('cpu'),5000,'CPUバックエンド初期化失敗');await tf.ready()}
  }
  status(`モデル取得中 (${cfg.name})`);
  model=await withTimeout(mobilenet.load({version:cfg.version,alpha:cfg.alpha}),30000,'MobileNet取得が30秒を超えました');
  status('中間層の抽出中');
  const m=model.model;
  const candidates=m.layers.filter(l=>/conv|expanded_conv|relu/i.test(l.name)&&l.outputShape&&l.outputShape.length===4);
  if(candidates.length<2)throw new Error('DeepDream用の中間層が見つかりません');
  const picks=[candidates[Math.floor(candidates.length*.30)],candidates[Math.floor(candidates.length*.58)],candidates[Math.floor(candidates.length*.80)]].filter(Boolean);
  featureModel=tf.model({inputs:m.inputs,outputs:picks.map(x=>x.output)});loadedProfile=key;
  status(`準備完了 / ${cfg.name} / ${tf.getBackend()}`);
 }catch(e){disposeModel();status(`準備失敗: ${e.message}`);throw e}
}
function imageDataToTensor(data){return tf.tidy(()=>tf.browser.fromPixels(data).toFloat().div(127.5).sub(1))}
function tensorToImageData(t){return tf.tidy(()=>t.add(1).mul(127.5).clipByValue(0,255).cast('int32'))}
async function tensorToData(t){const[h,w]=t.shape,vals=await t.data(),out=new Uint8ClampedArray(w*h*4);for(let i=0,j=0;i<vals.length;i+=3,j+=4){out[j]=vals[i];out[j+1]=vals[i+1];out[j+2]=vals[i+2];out[j+3]=255}return new ImageData(out,w,h)}
function dreamLoss(x,detail){const outs=featureModel.apply(x.expandDims(0)),arr=Array.isArray(outs)?outs:[outs],n=Math.max(1,arr.length);let loss=tf.scalar(0);arr.forEach((o,i)=>{const weight=i===0?(1-detail)*.8+.2:i===arr.length-1?detail+.2:.55;loss=loss.add(o.square().mean().mul(weight/n))});return loss}
async function dreamStep(img,stepSize,detail){const sx=Math.floor((Math.random()-.5)*16),sy=Math.floor((Math.random()-.5)*16),rolled=tf.roll(img,[sy,sx],[0,1]);const grad=tf.tidy(()=>{const g=tf.grad(x=>dreamLoss(x,detail))(rolled);return g.div(g.square().mean().sqrt().add(1e-8))});const next=tf.tidy(()=>rolled.add(grad.mul(stepSize)).clipByValue(-1,1));grad.dispose();rolled.dispose();return tf.roll(next,[-sy,-sx],[0,1])}
function colorBoost(t,a){return tf.tidy(()=>{const mean=t.mean(2,true);return mean.add(t.sub(mean).mul(1+a*1.7)).clipByValue(-1,1)})}
function zoomTensor(t,z){if(z<=1.0001)return t.clone();return tf.tidy(()=>{const[h,w]=t.shape,nh=Math.max(2,Math.floor(h/z)),nw=Math.max(2,Math.floor(w/z)),y=Math.floor((h-nh)/2),x=Math.floor((w-nw)/2);return tf.image.resizeBilinear(t.slice([y,x,0],[nh,nw,3]),[h,w],true)})}
async function runDream({record=false}={}){
 if(!current)return status('先に画像を選んでください');if(busy)return status('処理中です');busy=true;$('run').disabled=true;abort=false;
 try{await ensureModel();pushHistory();let base=imageDataToTensor(current);const target=+$('size').value,ratio=Math.min(1,target/Math.max(base.shape[0],base.shape[1]));if(ratio<1){const r=tf.image.resizeBilinear(base,[Math.round(base.shape[0]*ratio),Math.round(base.shape[1]*ratio)],true);base.dispose();base=r}
 const steps=+$('steps').value,oct=+$('octaves').value,str=+$('strength').value,detail=+$('detail').value,color=+$('color').value,zoom=+$('zoom').value;let x=base;
 for(let o=0;o<oct;o++){if(abort)break;const scale=Math.pow(1.18,o-(oct-1)),nh=Math.max(96,Math.round(base.shape[0]*scale)),nw=Math.max(96,Math.round(base.shape[1]*scale));if(x.shape[0]!==nh||x.shape[1]!==nw){const r=tf.image.resizeBilinear(x,[nh,nw],true);x.dispose();x=r}for(let s=0;s<steps;s++){if(abort)break;const nx=await dreamStep(x,0.007*str,detail);x.dispose();x=nx;if((s+1)%3===0){const c=colorBoost(x,color);x.dispose();x=c;await tf.nextFrame()}status(`夢見中 ${o+1}/${oct} ・ ${s+1}/${steps}`)}}
 if($('autoZoom').checked||record){const z=zoomTensor(x,zoom);x.dispose();x=z}const rgb=tensorToImageData(x),data=await tensorToData(rgb);rgb.dispose();x.dispose();base.dispose();drawData(data);status(abort?'停止しました':'完了');return data
 }catch(e){console.error(e);status(`エラー: ${e.message}`)}finally{busy=false;$('run').disabled=false}
}
$('run').onclick=()=>runDream();$('stop').onclick=()=>{abort=true;status('停止要求')};$('undo').onclick=()=>{const x=history.pop();if(x)drawData(x)};$('reset').onclick=()=>{if(original){pushHistory();drawData(original)}};$('download').onclick=()=>downloadCanvas('deepdream.png');$('fit').onclick=()=>canvas.scrollIntoView({behavior:'smooth',block:'center'});$('split').onclick=()=>{compareMode=!compareMode;renderCompare()};$('compare').oninput=renderCompare;$('random').onclick=()=>{for(const id of['strength','steps','octaves','zoom','detail','color']){const e=$(id),min=+e.min,max=+e.max,step=+e.step||.01,v=Math.round((min+Math.random()*(max-min))/step)*step;e.value=v;e.dispatchEvent(new Event('input'))}};
function renderCompare(){if(!compareMode||!original||!current)return current&&ctx.putImageData(current,0,0);const p=+$('compare').value;ctx.putImageData(current,0,0);const tmp=document.createElement('canvas');tmp.width=original.width;tmp.height=original.height;tmp.getContext('2d').putImageData(original,0,0);ctx.save();ctx.beginPath();ctx.rect(0,0,canvas.width*p,canvas.height);ctx.clip();ctx.drawImage(tmp,0,0,canvas.width,canvas.height);ctx.restore();ctx.strokeStyle='white';ctx.beginPath();ctx.moveTo(canvas.width*p,0);ctx.lineTo(canvas.width*p,canvas.height);ctx.stroke()}
async function loadFile(file){try{const bmp=await createImageBitmap(file),max=1200,r=Math.min(1,max/Math.max(bmp.width,bmp.height));canvas.width=Math.round(bmp.width*r);canvas.height=Math.round(bmp.height*r);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);original=ctx.getImageData(0,0,canvas.width,canvas.height);current=cloneImageData(original);history=[];$('drop').classList.add('hidden');status(`${canvas.width}×${canvas.height} 読み込み完了`);bmp.close()}catch(e){status(`画像読込失敗: ${e.message}`)}}
$('file').onchange=e=>e.target.files[0]&&loadFile(e.target.files[0]);['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));document.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadFile(f)});
function downloadCanvas(name){const a=document.createElement('a');a.download=name;a.href=canvas.toDataURL('image/png');a.click()}
$('sequence').onclick=async()=>{if(!current||busy)return;sequenceFrames=[];const n=Math.min(30,Math.max(2,+$('frames').value));for(let i=0;i<n;i++){if(abort)break;await runDream({record:true});sequenceFrames.push(canvas.toDataURL('image/png'));status(`連続夢 ${i+1}/${n}`)}$('exportZip').disabled=sequenceFrames.length===0;status(`連続夢 完了 ${sequenceFrames.length}枚`)};
$('exportZip').onclick=()=>sequenceFrames.forEach((url,i)=>setTimeout(()=>{const a=document.createElement('a');a.href=url;a.download=`deepdream-${String(i+1).padStart(3,'0')}.png`;a.click()},i*220));
let hold;canvas.addEventListener('pointerdown',()=>{hold=setTimeout(()=>{compareMode=!compareMode;renderCompare()},650)});canvas.addEventListener('pointerup',()=>clearTimeout(hold));
status('画像を選んでください');
