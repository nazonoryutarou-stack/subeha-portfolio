const $ = id => document.getElementById(id);
const BUILD = '2026-08-19 v11';
const MODEL_URL = './model/inceptionv3/model.json';
const OCTAVE_SCALE = 1.30;
const OCTAVE_LEVELS = [-2,-1,0,1,2];
const STEPS_PER_OCTAVE = 50;
const STEP_SIZE = 0.01;
const JITTER = 20;
const INTERNAL_MAX = 384;
const canvas=$('stage'), ctx=canvas.getContext('2d',{willReadFrequently:true});
let original=null,current=null,history=[],abort=false,busy=false,baseModel=null,dreamModel=null;
const status=t=>$('status').textContent=`${t} ｜ ${BUILD}`;
const cloneImageData=x=>new ImageData(new Uint8ClampedArray(x.data),x.width,x.height);
function drawData(d){canvas.width=d.width;canvas.height=d.height;ctx.putImageData(d,0,0);current=cloneImageData(d);$('drop').classList.add('hidden')}
function pushHistory(){if(!current)return;history.push(cloneImageData(current));if(history.length>8)history.shift()}
function withTimeout(p,ms,label){return Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error(label)),ms))])}

async function ensureModel(){
  if(dreamModel)return;
  if(typeof tf==='undefined')throw new Error('TensorFlow.jsの読込に失敗しました');
  status('TensorFlowを準備しています…');
  await withTimeout(tf.ready(),15000,'TensorFlow初期化が15秒を超えました');
  try{await tf.setBackend('webgl');await tf.ready()}catch(e){await tf.setBackend('cpu');await tf.ready()}
  status('InceptionV3を読み込んでいます…');
  baseModel=await withTimeout(tf.loadLayersModel(MODEL_URL),120000,'InceptionV3取得が120秒を超えました');
  const mixed3=baseModel.getLayer('mixed3');
  const mixed5=baseModel.getLayer('mixed5');
  if(!mixed3||!mixed5)throw new Error('mixed3 / mixed5 が見つかりません');
  dreamModel=tf.model({inputs:baseModel.inputs,outputs:[mixed3.output,mixed5.output]});
  const probe=tf.zeros([1,299,299,3]);
  try{const out=dreamModel.predict(probe);for(const t of out){await t.data();t.dispose()}}finally{probe.dispose()}
  status(`準備完了 / InceptionV3 mixed3+mixed5 / ${tf.getBackend()}`);
}

const imageDataTo255=d=>tf.tidy(()=>tf.browser.fromPixels(d).toFloat());
function preprocess255(t){return tf.tidy(()=>t.div(127.5).sub(1));}
function deprocess11(t){return tf.tidy(()=>t.add(1).mul(127.5).clipByValue(0,255));}
async function tensor255ToData(t){const c=tf.tidy(()=>t.clipByValue(0,255));const[h,w]=c.shape,v=await c.data();c.dispose();const out=new Uint8ClampedArray(w*h*4);for(let i=0,j=0;i<v.length;i+=3,j+=4){out[j]=v[i];out[j+1]=v[i+1];out[j+2]=v[i+2];out[j+3]=255}return new ImageData(out,w,h)}
const resizeTensor=(t,h,w)=>tf.tidy(()=>tf.image.resizeBilinear(t,[Math.max(75,Math.round(h)),Math.max(75,Math.round(w))],true));
function roll2d(t,sy,sx){return tf.tidy(()=>{const[h,w,c]=t.shape,y=((sy%h)+h)%h,x=((sx%w)+w)%w;let r=t;if(y)r=tf.concat([r.slice([h-y,0,0],[y,w,c]),r.slice([0,0,0],[h-y,w,c])],0);if(x)r=tf.concat([r.slice([0,w-x,0],[h,x,c]),r.slice([0,0,0],[h,w-x,c])],1);return r})}
function calcLoss11(img){const batch=img.expandDims(0),outs=dreamModel.apply(batch,{training:false}),arr=Array.isArray(outs)?outs:[outs];let loss=tf.scalar(0);for(const a of arr)loss=loss.add(a.mean());return loss;}
async function dreamStep11(img){
  const sx=Math.floor(Math.random()*(JITTER*2+1))-JITTER, sy=Math.floor(Math.random()*(JITTER*2+1))-JITTER;
  const shifted=roll2d(img,sy,sx);
  const grad=tf.tidy(()=>{
    const g=tf.grad(x=>calcLoss11(x))(shifted);
    const {variance}=tf.moments(g);
    return g.div(variance.sqrt().add(1e-8));
  });
  const stepped=tf.tidy(()=>shifted.add(grad.mul(STEP_SIZE)).clipByValue(-1,1));
  grad.dispose();shifted.dispose();
  const restored=roll2d(stepped,-sy,-sx);stepped.dispose();
  return restored;
}

async function dreamAtScale(img255){
  let x=preprocess255(img255);
  try{
    for(let s=0;s<STEPS_PER_OCTAVE&&!abort;s++){
      const next=await dreamStep11(x);x.dispose();x=next;
      status(`夢見中 ・ ${s+1}/${STEPS_PER_OCTAVE}`);
      if((s+1)%2===0)await tf.nextFrame();
    }
    return deprocess11(x);
  }finally{x.dispose()}
}

async function runDream(){
  if(!current)return status('先に画像を選んでください');
  if(busy)return;
  busy=true;abort=false;$('run').disabled=true;
  let base=null,work=null,dreamed=null;
  try{
    await ensureModel();pushHistory();
    base=imageDataTo255(current);
    if(Math.max(base.shape[0],base.shape[1])>INTERNAL_MAX){
      const r=INTERNAL_MAX/Math.max(base.shape[0],base.shape[1]);
      const z=resizeTensor(base,base.shape[0]*r,base.shape[1]*r);base.dispose();base=z;
    }
    work=base.clone();
    for(let oi=0;oi<OCTAVE_LEVELS.length&&!abort;oi++){
      const n=OCTAVE_LEVELS[oi],scale=Math.pow(OCTAVE_SCALE,n);
      const scaled=resizeTensor(work,base.shape[0]*scale,base.shape[1]*scale);
      work.dispose();work=scaled;
      status(`Octave ${oi+1}/${OCTAVE_LEVELS.length} を見ています…`);
      dreamed=await dreamAtScale(work);
      work.dispose();work=resizeTensor(dreamed,base.shape[0],base.shape[1]);
      dreamed.dispose();dreamed=null;
    }
    if(!work)throw new Error('DeepDream処理を開始できません');
    const final=resizeTensor(work,original.height,original.width);
    const data=await tensor255ToData(final);final.dispose();drawData(data);
    status(abort?'停止しました':'完了');
  }catch(e){console.error(e);status(`エラー: ${e.message}`)}finally{
    try{base?.dispose()}catch{}try{work?.dispose()}catch{}try{dreamed?.dispose()}catch{}
    busy=false;$('run').disabled=false;
  }
}

async function loadFile(file){try{const bmp=await createImageBitmap(file),max=1400,r=Math.min(1,max/Math.max(bmp.width,bmp.height));canvas.width=Math.round(bmp.width*r);canvas.height=Math.round(bmp.height*r);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);original=ctx.getImageData(0,0,canvas.width,canvas.height);current=cloneImageData(original);history=[];$('drop').classList.add('hidden');status(`${canvas.width}×${canvas.height} 読み込み完了`);bmp.close()}catch(e){status(`画像読込失敗: ${e.message}`)}}
$('file').onchange=e=>e.target.files[0]&&loadFile(e.target.files[0]);
$('run').onclick=runDream;
$('stop').onclick=()=>{abort=true;status('停止要求')};
$('undo').onclick=()=>{const x=history.pop();if(x)drawData(x)};
$('reset').onclick=()=>{if(original){pushHistory();drawData(original)}};
$('download').onclick=()=>{const a=document.createElement('a');a.download='deepdream-inception-v11.png';a.href=canvas.toDataURL('image/png');a.click()};
['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
document.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadFile(f)});
status('画像を選んでください');