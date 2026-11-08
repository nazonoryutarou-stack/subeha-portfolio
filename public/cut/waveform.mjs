/* Audio peaks from decoded local audio only. Memoize to avoid repeated decoding. */
export function samplePeaks(channelData,bins=180){
  if(!channelData||!channelData.length)return [];
  const out=new Float32Array(bins);
  for(let i=0;i<bins;i++){
    const start=Math.floor(i*channelData.length/bins),end=Math.min(channelData.length,Math.max(start+1,Math.floor((i+1)*channelData.length/bins)));
    let max=0;const stride=Math.max(1,Math.floor((end-start)/128));
    for(let j=start;j<end;j+=stride)max=Math.max(max,Math.abs(channelData[j]));
    out[i]=Math.min(1,max);
  }
  return Array.from(out);
}
export function drawPeaks(ctx,peaks,w,h){
  if(!peaks?.length)return;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#83efc8';
  for(let i=0;i<peaks.length;i++){
    const x=i*w/peaks.length,amp=Math.max(1,peaks[i]*h*.45);
    ctx.fillRect(x,h/2-amp,Math.max(1,w/peaks.length*.65),amp*2);
  }
}
export async function decodeWaveform(blob,{bins=180,maxBytes=32*1024*1024}={}){
  if(blob.size>maxBytes)throw Error('音声ファイルが波形解析の上限32MBを超えました');
  const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Ctx)throw Error('Web Audioに非対応です');
  const ctx=new Ctx();try{
    const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());
    const channel=decoded.getChannelData(0);
    return samplePeaks(channel,bins);
  }finally{ctx.close().catch(()=>{});}
}
