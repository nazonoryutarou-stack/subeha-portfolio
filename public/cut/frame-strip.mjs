/* Sampling positions for an editor filmstrip. Pure module, safe in Node tests. */
const finite=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
export function frameSampleTimes(clip,width,{tileWidth=72,maxSamples=12}={}){
  const start=Math.max(0,finite(clip?.start)),end=Math.max(start,finite(clip?.end,start));
  const count=Math.max(1,Math.min(Math.max(1,Math.floor(finite(maxSamples,12))),Math.ceil(Math.max(0,finite(width))/Math.max(24,finite(tileWidth,72)))));
  const range=end-start;
  return Array.from({length:count},(_,i)=>{
    const fraction=(i+.5)/count;
    return Number((clip?.reverse?end-range*fraction:start+range*fraction).toFixed(4));
  });
}
export function frameStripKey(assetId,clip,width){
  const samples=frameSampleTimes(clip,width);
  return [assetId,Number(clip?.start||0).toFixed(3),Number(clip?.end||0).toFixed(3),!!clip?.reverse,samples.length].join('|');
}
