import {frameSampleTimes,frameStripKey} from './frame-strip.mjs';
/* Single decoder at a time protects mobile preview playback from filmstrip decode spikes. */
export function createFilmstripCache({maxEntries=28}={}){
 const ready=new Map(),pending=new Map(),queue=[];
 let busy=false;
 const remember=(key,frames)=>{if(ready.has(key))ready.delete(key);ready.set(key,frames);while(ready.size>maxEntries)ready.delete(ready.keys().next().value);};
 const wait=(element,event,timeout=3000)=>new Promise((resolve,reject)=>{
   let timer;const clean=()=>{clearTimeout(timer);element.removeEventListener(event,onOK);element.removeEventListener('error',onFail);};
   const onOK=()=>{clean();resolve();};const onFail=()=>{clean();reject(new Error('動画のサムネイルをデコードできません'))};
   element.addEventListener(event,onOK,{once:true});element.addEventListener('error',onFail,{once:true});
   timer=setTimeout(()=>{clean();reject(new Error('フレーム取得がタイムアウトしました'));},timeout);
 });
 async function framesFor(asset,times){
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  video.src=asset.url;
  const buffer=document.createElement('canvas');buffer.width=104;buffer.height=62;const ctx=buffer.getContext('2d',{alpha:false});
  try{
   if(video.readyState<1)await wait(video,'loadedmetadata');
   const frames=[];
   for(const at of times){
    const time=Math.max(0,Math.min(Math.max(0,video.duration-.04),at));
    if(Math.abs(video.currentTime-time)>.018){const seeked=wait(video,'seeked');video.currentTime=time;await seeked;}
    if(!video.videoWidth||!video.videoHeight)throw Error('フレームがありません');
    const vw=video.videoWidth,vh=video.videoHeight,zoom=Math.max(buffer.width/vw,buffer.height/vh),dw=vw*zoom,dh=vh*zoom;
    ctx.fillStyle='#24252b';ctx.fillRect(0,0,buffer.width,buffer.height);
    ctx.drawImage(video,(buffer.width-dw)/2,(buffer.height-dh)/2,dw,dh);
    frames.push(buffer.toDataURL('image/jpeg',.57));
   }
   return frames;
  }finally{video.pause();video.removeAttribute('src');video.load();}
 }
 async function drain(){if(busy)return;busy=true;try{
   while(queue.length){const job=queue.shift();try{
    const frames=await framesFor(job.asset,job.times);remember(job.key,frames);
    for(const callback of pending.get(job.key)||[])callback(frames);
   }catch(e){console.warn('Filmstrip thumbnail fallback:',e.message);}finally{pending.delete(job.key);}}
  }finally{busy=false;}}
 function request(asset,clip,width,callback){
  if(asset?.type!=='video'||!asset.url||typeof callback!=='function')return;
  const key=frameStripKey(asset.id,clip,width);
  if(ready.has(key)){const frames=ready.get(key);ready.delete(key);ready.set(key,frames);callback(frames);return;}
  if(pending.has(key)){const callbacks=pending.get(key);if(callbacks.length<4)callbacks.push(callback);return;}
  pending.set(key,[callback]);queue.push({key,asset,times:frameSampleTimes(clip,width)});void drain();
 }
 return {request,clear(){ready.clear();queue.length=0;}};
}
