const $=id=>document.getElementById(id);
const BUILD='2026-08-19 v12';
const TFHUB_URL='https://tfhub.dev/google/tfjs-model/imagenet/inception_v3/classification/3/default/1';
const KAGGLE_URL='https://www.kaggle.com/models/google/inception-v3/TfJs/classification/2';
const OCTAVE_N=5;
const OCTAVE_SCALE=1.30;
const ITER_N=18; // mobile compromise; the supplied Keras notebook uses 50
const STEP_SIZE=0.012;
const JITTER=24;
const INTERNAL_MAX=420;
const canvas=$('stage'),ctx=canvas.getContext('2d',{willReadFrequently:true});
let original=null,current=null,history=[],abort=false,busy=false,net=null,dreamEnds=[];
const status=t=>$('status').textContent=`${t} ｜ ${BUILD}`;
const cloneImageData=x=>new ImageData(new Uint8ClampedArray(x.data),x.width,x.height);
function drawData(d){canvas.width=d.width;canvas.height=d.height;ctx.putImageData(d,0,0);current=cloneImageData(d);$('drop').classList.add('hidden')}
function pushHistory(){if(!current)return;history.push(cloneImageData(current));if(history.length>8)history.shift()}
function withTimeout(p,ms,label){return Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label)),ms))])}

function graphNodeNames(){
  const g=net?.executor?.graph;
  if(!g)return[];
  if(g.nodes){if(Array.isArray(g.nodes))return g.nodes.map(n=>n?.name).filter(Boolean);return Object.keys(g.nodes)}
  if(g.nodeMap){if(g.nodeMap instanceof Map)return [...g.nodeMap.keys()];return Object.keys(g.nodeMap)}
  return[];
}
function chooseDreamEnds(){
  const names=graphNodeNames();
  const exact=(token)=>names.filter(n=>n.includes(token)&&/(concat|ConcatV2|output|Identity)$/i.test(n));
  let a=exact('Mixed_6a'),b=exact('Mixed_6c');
  if(!a.length)a=names.filter(n=>n.includes('Mixed_6a'));
  if(!b.length)b=names.filter(n=>n.includes('Mixed_6c'));
  if(a.length&&b.length)return[a[a.length-1],b[b.length-1]];
  const mixed=names.filter(n=>/Mixed_[567][a-z]/.test(n)&&/(concat|ConcatV2)/i.test(n));
  if(mixed.length>=2)return[mixed[Math.floor(mixed.length*.38)],mixed[Math.floor(mixed.length*.58)]];
  throw new Error('Inception中間層(Mixed_6a/Mixed_6c)を検出できません');
}
async function verifyEnds(ends){
  const z=tf.zeros([1,299,299,3]);
  try{
    const out=net.execute(z,ends),arr=Array.isArray(out)?out:[out];
    for(const t of arr){await t.data();t.dispose()}
  }finally{z.dispose()}
}
async function loadNetwork(){
  if(net)return;
  if(typeof tf==='undefined')throw new Error('TensorFlow.jsの読込に失敗しました');
  status('TensorFlowを準備しています…');
  await withTimeout(tf.ready(),15000,'TensorFlow初期化が15秒を超えました');
  try{await tf.setBackend('webgl');await tf.ready()}catch{await tf.setBackend('cpu');await tf.ready()}
  const urls=[TFHUB_URL,KAGGLE_URL];
  let lastErr=null;
  for(let i=0;i<urls.length&&!net;i++){
    try{
      status(`InceptionV3を取得しています… ${i+1}/${urls.length}`);
      net=await withTimeout(tf.loadGraphModel(urls[i],{fromTFHub:true,onProgress:p=>status(`InceptionV3取得中 ${Math.round(p*100)}%`)}),120000,'InceptionV3取得が120秒を超えました');
    }catch(e){lastErr=e;console.warn('model source failed',urls[i],e);net=null}
  }
  if(!net)throw new Error(`InceptionV3取得失敗: ${lastErr?.message||'network error'}`);
  status('夢を見る中間層を探索しています…');
  dreamEnds=chooseDreamEnds();
  await verifyEnds(dreamEnds);
  status(`準備完了 / ${dreamEnds.map(n=>n.split('/').slice(-2).join('/')).join(' + ')} / ${tf.getBackend()}`);
}

function imageDataTo01(d){return tf.tidy(()=>tf.browser.fromPixels(d).toFloat().div(255));}
async function tensor01ToData(t){const c=tf.tidy(()=>t.clipByValue(0,1).mul(255));const[h,w]=c.shape,v=await c.data();c.dispose();const out=new Uint8ClampedArray(w*h*4);for(let i=0,j=0;i<v.length;i+=3,j+=4){out[j]=v[i];out[j+1]=v[i+1];out[j+2]=v[i+2];out[j+3]=255}return new ImageData(out,w,h)}
const resize=(t,h,w)=>tf.tidy(()=>tf.image.resizeBilinear(t,[Math.max(75,Math.round(h)),Math.max(75,Math.round(w))],true));
function roll(t,sy,sx){return tf.tidy(()=>{const[h,w,c]=t.shape,y=((sy%h)+h)%h,x=((sx%w)+w)%w;let r=t;if(y)r=tf.concat([r.slice([h-y,0,0],[y,w,c]),r.slice([0,0,0],[h-y,w,c])],0);if(x)r=tf.concat([r.slice([0,w-x,0],[h,x,c]),r.slice([0,0,0],[h,w-x,c])],1);return r})}
function modelInput(x){return tf.tidy(()=>resize(x,299,299).expandDims(0));}
function activationLoss(x){
  const inp=modelInput(x);
  const outs=net.execute(inp,dreamEnds),arr=Array.isArray(outs)?outs:[outs];
  let loss=tf.scalar(0);
  for(const a of arr)loss=loss.add(a.square().mean()); // Google objective_L2: dst.diff = dst.data
  return loss.div(arr.length);
}
async function makeStep(img){
  const ox=Math.floor(Math.random()*(JITTER*2+1))-JITTER,oy=Math.floor(Math.random()*(JITTER*2+1))-JITTER;
  const shifted=roll(img,oy,ox);
  const grad=tf.tidy(()=>{
    const g=tf.grad(x=>activationLoss(x))(shifted);
    // Google Caffe notebook: step_size / abs(g).mean() * g
    return g.div(g.abs().mean().add(1e-8));
  });
  const stepped=tf.tidy(()=>shifted.add(grad.mul(STEP_SIZE)).clipByValue(0,1));
  grad.dispose();shifted.dispose();
  const restored=roll(stepped,-oy,-ox);stepped.dispose();return restored;
}
function buildOctaves(base){
  const octaves=[base.clone()];
  for(let i=1;i<OCTAVE_N;i++){
    const prev=octaves[octaves.length-1],h=Math.max(75,Math.round(prev.shape[0]/OCTAVE_SCALE)),w=Math.max(75,Math.round(prev.shape[1]/OCTAVE_SCALE));
    octaves.push(resize(prev,h,w));
  }
  return octaves;
}
async function runDream(){
  if(!current)return status('先に画像を選んでください');if(busy)return;
  busy=true;abort=false;$('run').disabled=true;
  let base=null,detail=null,result=null;let octaves=[];
  try{
    await loadNetwork();pushHistory();base=imageDataTo01(current);
    if(Math.max(base.shape[0],base.shape[1])>INTERNAL_MAX){const r=INTERNAL_MAX/Math.max(base.shape[0],base.shape[1]),z=resize(base,base.shape[0]*r,base.shape[1]*r);base.dispose();base=z}
    octaves=buildOctaves(base);
    detail=tf.zerosLike(octaves[octaves.length-1]);
    const ordered=[...octaves].reverse();
    for(let oi=0;oi<ordered.length&&!abort;oi++){
      const octaveBase=ordered[oi],h=octaveBase.shape[0],w=octaveBase.shape[1];
      if(oi>0){const d=resize(detail,h,w);detail.dispose();detail=d}
      let src=tf.tidy(()=>octaveBase.add(detail).clipByValue(0,1));
      for(let i=0;i<ITER_N&&!abort;i++){
        const next=await makeStep(src);src.dispose();src=next;
        status(`Octave ${oi+1}/${ordered.length} ・ ${i+1}/${ITER_N}`);
        if((i+1)%2===0)await tf.nextFrame();
      }
      detail.dispose();detail=tf.tidy(()=>src.sub(octaveBase)); // exact Google carry-over idea
      if(result)result.dispose();result=src;
    }
    if(!result)throw new Error('DeepDream処理を開始できません');
    const final=resize(result,original.height,original.width),data=await tensor01ToData(final);final.dispose();drawData(data);status(abort?'停止しました':'完了');
  }catch(e){console.error(e);status(`エラー: ${e.message}`)}finally{
    for(const o of octaves)try{o.dispose()}catch{}
    try{base?.dispose()}catch{}try{detail?.dispose()}catch{}try{result?.dispose()}catch{}
    busy=false;$('run').disabled=false;
  }
}
async function loadFile(file){try{const bmp=await createImageBitmap(file),max=1400,r=Math.min(1,max/Math.max(bmp.width,bmp.height));canvas.width=Math.round(bmp.width*r);canvas.height=Math.round(bmp.height*r);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);original=ctx.getImageData(0,0,canvas.width,canvas.height);current=cloneImageData(original);history=[];$('drop').classList.add('hidden');status(`${canvas.width}×${canvas.height} 読み込み完了`);bmp.close()}catch(e){status(`画像読込失敗: ${e.message}`)}}
$('file').onchange=e=>e.target.files[0]&&loadFile(e.target.files[0]);$('run').onclick=runDream;$('stop').onclick=()=>{abort=true;status('停止要求')};$('undo').onclick=()=>{const x=history.pop();if(x)drawData(x)};$('reset').onclick=()=>{if(original){pushHistory();drawData(original)}};$('download').onclick=()=>{const a=document.createElement('a');a.download='deepdream-google-v12.png';a.href=canvas.toDataURL('image/png');a.click()};['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));document.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadFile(f)});status('画像を選んでください');