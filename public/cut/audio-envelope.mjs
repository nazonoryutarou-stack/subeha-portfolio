/** Lightweight PCM WAV amplitude envelope for deterministic VRM mouth motion.
 * Supports RIFF PCM16 or IEEE float32, mono/stereo, without WebAudio microphone permissions.
 */
export function decodeWavEnvelope(buffer,{stepMs=40,maxSeconds=180}={}){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<44)throw Error('WAVファイルが短すぎます');
  const d=new DataView(buffer);
  const four=(p)=>String.fromCharCode(...new Uint8Array(buffer,p,4));
  if(four(0)!=='RIFF'||four(8)!=='WAVE')throw Error('RIFF形式のWAVではありません');
  let fmt=null, dataOffset=-1, dataSize=0;
  for(let p=12;p+8<=buffer.byteLength;){
    const name=four(p),size=d.getUint32(p+4,true),at=p+8;
    if(size>buffer.byteLength-at)throw Error('WAVのデータが壊れています');
    if(name==='fmt '){if(size<16)throw Error('WAV形式が不正です');fmt={codec:d.getUint16(at,true),channels:d.getUint16(at+2,true),rate:d.getUint32(at+4,true),block:d.getUint16(at+12,true),bits:d.getUint16(at+14,true)};}
    if(name==='data'&&dataOffset<0){dataOffset=at;dataSize=size;}
    p=at+size+(size&1);
  }
  if(!fmt||dataOffset<0)throw Error('音声データがありません');
  const {codec,channels,rate,block,bits}=fmt;
  if(![1,3].includes(codec)||!((codec===1&&bits===16)||(codec===3&&bits===32))||channels<1||channels>2||rate<8000||rate>192000||block!==channels*(bits/8))throw Error('口パクに使えるPCM WAVではありません');
  const frames=Math.floor(dataSize/block), maxFrames=Math.min(frames,Math.floor(maxSeconds*rate));
  const step=Math.max(1,Math.round(rate*stepMs/1000));const amps=[];
  for(let from=0;from<maxFrames;from+=step){let sum=0,peak=0,count=0;
    for(let i=from;i<Math.min(maxFrames,from+step);i+=Math.max(1,Math.floor(step/800))){
      let value=0;for(let ch=0;ch<channels;ch++){const off=dataOffset+i*block+ch*bits/8;value+=codec===1?d.getInt16(off,true)/32768:d.getFloat32(off,true);}value/=channels;
      if(Number.isFinite(value)){sum+=value*value;peak=Math.max(peak,Math.abs(value));count++;}
    }
    amps.push(count?Math.sqrt(sum/count):0);
  }
  // Relative gain calibration; quiet voices remain visible without amplifying silence.
  const loud=Math.max(.025,...amps);const values=amps.map(v=>Math.max(0,Math.min(1,(v/loud-.075)/.72)));
  return {values,stepSeconds:step/rate,duration:frames/rate};
}
export function envelopeAt(env,time){
  if(!env||!Number.isFinite(time)||time<0||time>=env.duration)return 0;
  const x=time/env.stepSeconds,i=Math.floor(x),mix=x-i;
  return Math.max(0,Math.min(1,(env.values[i]??0)*(1-mix)+(env.values[i+1]??env.values[i]??0)*mix));
}
