const $=id=>document.getElementById(id);
const BUILD='2026-08-19 v8';
const canvas=$('stage'),ctx=canvas.getContext('2d',{willReadFrequently:true});
let original=null,current=null,history=[],abort=false,busy=false,model=null;

const DOG_CLASSES=[151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268];
const ANIMAL_ACCENTS=[281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300];
const STAGES=[
  {max:176,steps:34,step:1.8,semantic:3.8,feature:.24,blur:11,noise:1.6},
  {max:272,steps:38,step:1.35,semantic:3.2,feature:.32,blur:7,noise:1.15},
  {max:384,steps:42,step:1.0,semantic:2.7,feature:.42,blur:5,noise:.75}
];

function status(s){$('status').textContent=`${s} ｜ ${BUILD}`}
function cloneImageData(x){return new ImageData(new Uint8ClampedArray(x.data),x.width,x.height)}
function drawData(data){canvas.width=data.width;canvas.height=data.height;ctx.putImageData(data,0,0);current=cloneImageData(data);$('drop').classList.add('hidden')}
function pushHistory(){if(current){history.push(cloneImageData(current));if(history.length>8)history.shift()}}
function withTimeout(p,ms,label){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(label)),ms))])}

async function ensureModel(){
  if(model)return;
  if(typeof tf==='undefined'||typeof mobilenet==='undefined')throw new Error('TensorFlow.jsの読込に失敗しました');
  status('ニューラルネットを起こしています…');
  await withTimeout(tf.ready(),12000,'TensorFlow初期化が12秒を超えました');
  if(tf.getBackend()!=='webgl'){
    try{await withTimeout(tf.setBackend('webgl'),7000,'WebGL初期化失敗');await tf.ready()}catch{await tf.setBackend('cpu');await tf.ready()}
  }
  status('ImageNetの記憶を読み込んでいます…');
  model=await withTimeout(mobilenet.load({version:1,alpha:.5}),30000,'MobileNet取得が30秒を超えました');
  const z=tf.zeros([96,96,3]);
  try{const a=model.infer(z,false),b=model.infer(z,true);await Promise.all([a.data(),b.data()]);a.dispose();b.dispose()}finally{z.dispose()}
  status(`準備完了 / ${tf.getBackend()}`);
}

function imageDataToTensor(data){return tf.tidy(()=>tf.browser.fromPixels(data).toFloat())}
async function tensorToData(t){const[h,w]=t.shape,v=await t.clipByValue(0,255).data(),out=new Uint8ClampedArray(w*h*4);for(let i=0,j=0;i<v.length;i+=3,j+=4){out[j]=v[i];out[j+1]=v[i+1];out[j+2]=v[i+2];out[j+3]=255}return new ImageData(out,w,h)}
function resizeToMax(t,max){return tf.tidy(()=>{const[h,w]=t.shape,r=Math.min(1,max/Math.max(h,w));return r===1?t.clone():tf.image.resizeBilinear(t,[Math.max(2,Math.round(h*r)),Math.max(2,Math.round(w*r))],true)})}
function roll2d(t,sy,sx){return tf.tidy(()=>{const[h,w,c]=t.shape,y=((sy%h)+h)%h,x=((sx%w)+w)%w;let r=t;if(y)r=tf.concat([r.slice([h-y,0,0],[y,w,c]),r.slice([0,0,0],[h-y,w,c])],0);if(x)r=tf.concat([r.slice([0,w-x,0],[h,x,c]),r.slice([0,0,0],[h,w-x,c])],1);return r})}
function hashSeed(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function chooseTargets(seed,count=8){let h=hashSeed(seed),pool=[...DOG_CLASSES,...ANIMAL_ACCENTS],out=[];for(let i=0;i<count;i++){h=(Math.imul(h,1664525)+1013904223)>>>0;out.push(pool[h%pool.length])}return out}
function semanticLoss(x,seed,semanticWeight,featureWeight){
  const resized=tf.image.resizeBilinear(x,[224,224],true);
  const logits=model.infer(resized,false);
  const emb=model.infer(resized,true);
  const targets=chooseTargets(seed,10);
  const chosen=tf.gather(logits,targets,1);
  const sem=tf.logSumExp(chosen,1).mean();
  const ch=emb.shape[emb.rank-1]||1024;
  const idx=targets.slice(0,6).map((n,i)=>(n*37+i*53)%ch);
  const e=tf.gather(emb,idx,emb.rank-1);
  const feat=tf.relu(e).square().mean();
  return sem.mul(semanticWeight).add(feat.mul(featureWeight));
}
function multiscaleGrad(g,blur){return tf.tidy(()=>{
  const b1=tf.avgPool(g.expandDims(0),3,1,'same').squeeze([0]);
  const b2=tf.avgPool(g.expandDims(0),blur,1,'same').squeeze([0]);
  const hi=g.sub(b1),mid=b1.sub(b2),lo=b2;
  const norm=x=>x.div(x.square().mean().sqrt().add(1e-8));
  return norm(hi).mul(.45).add(norm(mid).mul(.95)).add(norm(lo).mul(.9));
})}
function injectOriginalDetail(dream,base,amount=.34){return tf.tidy(()=>{
  const[h,w]=dream.shape,full=tf.image.resizeBilinear(base,[h,w],true),small=tf.image.resizeBilinear(full,[Math.max(16,Math.round(h/2.4)),Math.max(16,Math.round(w/2.4))],true),up=tf.image.resizeBilinear(small,[h,w],true),detail=full.sub(up);return dream.add(detail.mul(amount)).clipByValue(0,255);
})}
function colorDream(t,phase){return tf.tidy(()=>{
  const[h,w]=t.shape,r=t.slice([0,0,0],[h,w,1]),g=t.slice([0,0,1],[h,w,1]),b=t.slice([0,0,2],[h,w,1]);
  const px=2+Math.round((Math.sin(phase)+1)*2),rr=roll2d(r,1,px),bb=roll2d(b,-1,-px);
  const mix=tf.concat([rr,g,bb],2),mean=mix.mean(2,true),sat=1.18;
  return mean.add(mix.sub(mean).mul(sat)).clipByValue(0,255);
})}

async function dreamStep(img,stage,seed,stepNo){
  const jitter=14,sx=Math.floor((Math.random()-.5)*jitter),sy=Math.floor((Math.random()-.5)*jitter),rolled=roll2d(img,sy,sx);
  const grad=tf.tidy(()=>{
    let g=tf.grad(x=>semanticLoss(x,seed,stage.semantic,stage.feature))(rolled);
    g=multiscaleGrad(g,stage.blur);
    return g.div(g.square().mean().sqrt().add(1e-8));
  });
  let next=tf.tidy(()=>rolled.add(grad.mul(stage.step)).clipByValue(0,255));
  grad.dispose();rolled.dispose();
  if(stage.noise>0&&stepNo%2===0){const n=tf.randomNormal(next.shape,0,stage.noise);const z=tf.tidy(()=>next.add(n).clipByValue(0,255));next.dispose();n.dispose();next=z}
  const restored=roll2d(next,-sy,-sx);next.dispose();return restored;
}

async function runDream(){
  if(!current)return status('先に画像を選んでください');
  if(busy)return;
  busy=true;abort=false;$('run').disabled=true;
  let base=null,x=null;
  try{
    await ensureModel();pushHistory();
    base=imageDataToTensor(current);
    const seed=`dream-${Date.now()}`;
    for(let si=0;si<STAGES.length;si++){
      if(abort)break;
      const stage=STAGES[si];
      const target=resizeToMax(base,stage.max);
      if(x){const up=tf.image.resizeBilinear(x,[target.shape[0],target.shape[1]],true);x.dispose();x=injectOriginalDetail(up,base,si===0?.16:.38);up.dispose()}else x=target.clone();
      target.dispose();
      for(let s=0;s<stage.steps;s++){
        if(abort)break;
        const nx=await dreamStep(x,stage,`${seed}-stage${si}`,s);x.dispose();x=nx;
        if((s+1)%6===0){const c=colorDream(x,(si+1)*(s+1)*.17);x.dispose();x=c;await tf.nextFrame()}
        status(`夢見中 ${si+1}/3 ・ ${s+1}/${stage.steps}`);
      }
    }
    if(!abort){
      const final=tf.image.resizeBilinear(x,[base.shape[0],base.shape[1]],true);x.dispose();x=injectOriginalDetail(final,base,.46);final.dispose();
      const colored=colorDream(x,2.4);x.dispose();x=colored;
    }
    const data=await tensorToData(x);drawData(data);status(abort?'停止しました':'完了');
  }catch(e){console.error(e);status(`エラー: ${e.message}`)}finally{try{x?.dispose()}catch{}try{base?.dispose()}catch{}busy=false;$('run').disabled=false}
}

async function loadFile(file){try{const bmp=await createImageBitmap(file),max=1400,r=Math.min(1,max/Math.max(bmp.width,bmp.height));canvas.width=Math.round(bmp.width*r);canvas.height=Math.round(bmp.height*r);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);original=ctx.getImageData(0,0,canvas.width,canvas.height);current=cloneImageData(original);history=[];$('drop').classList.add('hidden');status(`${canvas.width}×${canvas.height} 読み込み完了`);bmp.close()}catch(e){status(`画像読込失敗: ${e.message}`)}}
function downloadCanvas(){const a=document.createElement('a');a.download='deepdream-v8.png';a.href=canvas.toDataURL('image/png');a.click()}

$('file').onchange=e=>e.target.files[0]&&loadFile(e.target.files[0]);
$('run').onclick=runDream;
$('stop').onclick=()=>{abort=true;status('停止要求')};
$('undo').onclick=()=>{const x=history.pop();if(x)drawData(x)};
$('reset').onclick=()=>{if(original){pushHistory();drawData(original)}};
$('download').onclick=downloadCanvas;
['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
document.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadFile(f)});
status('画像を選んでください');