/* SUBEHA CUT feature-lab core. Pure, non-destructive analysis and edit planning. */
import {splitAt} from './timeline.mjs';
const finite=x=>Number.isFinite(x)?x:0;
export const MAX_ANALYSIS_SECONDS=120;
export const MAX_SPLITS=48;
export function rmsWindows(buffer,{stepSeconds=.04,startSeconds=0,maxSeconds=MAX_ANALYSIS_SECONDS}={}){
 if(!buffer || !Number.isFinite(buffer.sampleRate) || buffer.sampleRate<=0 || typeof buffer.getChannelData!=='function')throw Error('音声データがありません');
 const sampleRate=buffer.sampleRate,channels=Math.min(2,buffer.numberOfChannels||0);
 if(!channels)throw Error('音声チャンネルがありません');
 const step=Math.max(128,Math.round(sampleRate*stepSeconds));
 const start=Math.round(Math.max(0,finite(startSeconds))*sampleRate);
 const end=Math.min(buffer.length,start+Math.round(Math.min(MAX_ANALYSIS_SECONDS,Math.max(1,maxSeconds))*sampleRate));
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
 const out=[];
 for(let offset=start;offset+step<=end;offset+=step){
  let power=0,count=0;
  for(let i=offset;i<offset+step;i+=4){let sum=0;for(const chan of data)sum+=chan[i]||0;sum/=channels;power+=sum*sum;count++;}
  out.push({time:offset/sampleRate,rms:Math.sqrt(power/Math.max(1,count))});
 }
 return out;
}
export function detectSilences(windows,{thresholdDb=-37,minSeconds=.45}={}){
 if(!Array.isArray(windows)||!windows.length)return [];
 const threshold=Math.pow(10,Math.min(-8,Math.max(-75,thresholdDb))/20);
 const gap=Math.max(.05,minSeconds),step=Math.max(.001,(windows[1]?.time??windows[0].time+.04)-windows[0].time);
 let begin=null;const spans=[];
 for(let i=0;i<=windows.length;i++){
  const quiet=i<windows.length&&windows[i].rms<threshold;
  if(quiet && begin===null)begin=windows[i].time;
  if(!quiet&&begin!==null){const end=i<windows.length?windows[i].time:windows.at(-1).time+step;if(end-begin>=gap)spans.push({start:+begin.toFixed(3),end:+end.toFixed(3)});begin=null;}
 }
 return spans;
}
export function detectBeats(windows,{sensitivity=1.25,minGap=.29}={}){
 if(!Array.isArray(windows)||windows.length<8)return [];
 const energy=windows.map(x=>Math.log1p(Math.max(0,x.rms)*80));
 const flux=energy.map((v,i)=>i<2?0:Math.max(0,v-(energy[i-1]+energy[i-2])/2));
 const sorted=flux.slice().sort((a,b)=>a-b);
 const median=sorted[Math.floor(sorted.length*.5)]||0;
 const high=sorted[Math.floor(sorted.length*.85)]||0;
 const threshold=Math.max(.04,median+(high-median)*(.32+Math.max(.4,Math.min(2,sensitivity))*.30));
 const beats=[];let last=-Infinity;
 for(let i=2;i<flux.length-2;i++){
  if(flux[i]<threshold||flux[i]<flux[i-1]||flux[i]<flux[i+1])continue;
  const time=windows[i].time;
  if(time-last<Math.max(.16,minGap))continue;
  beats.push(+time.toFixed(3));last=time;
  if(beats.length>=256)break;
 }
 return beats;
}
export function frameDifference(before,after){
 if(!before || !after || before.length!==after.length ||before.length<4)return 0;
 let sum=0,n=0;
 for(let i=0;i<before.length;i+=4){sum+=Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2]);n+=3;}
 return sum/(n*255);
}
export function detectSceneCuts(frames,{threshold=.19,minGap=.65}={}){
 if(!Array.isArray(frames)||frames.length<2)return [];
 const out=[];let last=-Infinity;
 for(let i=1;i<frames.length;i++){
  const jump=frameDifference(frames[i-1].pixels,frames[i].pixels);
  if(jump>=threshold && frames[i].time-last>=minGap){out.push({time:+frames[i].time.toFixed(3),score:+jump.toFixed(3)});last=frames[i].time;}
 }
 return out;
}
export function sourceToProjectTime(sourceTime,clip,spanStart){
 if(!clip)return finite(sourceTime);
 const speed=Math.max(.05,finite(clip.speed)||1);
 const local=clip.reverse?(clip.end-sourceTime):(sourceTime-clip.start);
 if(local<-.001||sourceTime<clip.start-.001||sourceTime>clip.end+.001)return null;
 return Math.max(0,finite(spanStart)+local/speed);
}
export function normalizeMarkers(markers,{max=256}={}){
 const seen=new Set();const out=[];
 for(const mark of (Array.isArray(markers)?markers:[])){
  const time=Number(mark.time),kind=String(mark.kind||'cue');
  if(!Number.isFinite(time)||time<0)continue;
  const key=kind+':'+time.toFixed(2);if(seen.has(key))continue;seen.add(key);
  out.push({time:+time.toFixed(3),kind,label:String(mark.label||kind).slice(0,80)});
  if(out.length>=max)break;
 }
 return out.sort((a,b)=>a.time-b.time);
}
export function splitAtMarkers(clips,marks,{limit=MAX_SPLITS}={}){
 let result=Array.isArray(clips)?clips.map(c=>structuredClone(c)):[];
 let count=0;
 const times=[...new Set((marks||[]).map(x=>Number(x.time)).filter(Number.isFinite).filter(x=>x>=.07).map(x=>+x.toFixed(3)))].sort((a,b)=>b-a);
 for(const time of times.slice(0,Math.min(MAX_SPLITS,Math.max(0,limit)))){
  const split=splitAt(result,time);if(split){result=split.clips;count++;}
 }
 return {clips:result,count,considered:times.length};
}
export function searchTranscript(cues,query,{limit=100}={}){
 const term=String(query||'').trim().toLocaleLowerCase();
 return (Array.isArray(cues)?cues:[]).filter(x=>!term||String(x.text||'').toLocaleLowerCase().includes(term)).slice(0,limit);
}
export function parseEditCommand(input){
 const text=String(input||'').trim();
 let m;
 if((m=text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*秒(?:の位置)?(?:で|に)\s*分割/)))return {type:'split',seconds:Number(m[1]),description:m[1]+'秒の位置でクリップを分割'};
 if((m=text.match(/(?:速度|再生速度)\s*(?:を|は)?\s*(0\.25|0\.5|0\.75|1|1\.25|1\.5|2|3|4)\s*倍/)))return {type:'speed',speed:Number(m[1]),description:'選択クリップを'+m[1]+'倍速に変更'};
 if((m=text.match(/(?:^|\s)(9:16|16:9|1:1|4:5|3:4|21:9)\s*(?:に|へ|で|$)/)))return {type:'ratio',ratio:m[1],description:'キャンバス比率を'+m[1]+'に変更'};
 if((m=text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*秒(?:に|へ|に移動)/)))return {type:'seek',seconds:Number(m[1]),description:m[1]+'秒へ移動'};
 if((m=text.match(/(?:テキスト|文字)\s*[「『](.{1,100})[」』]\s*(?:を|追加|入れて|表示)?/)))return {type:'text',text:m[1],description:'再生位置に文字を追加: '+m[1]};
 if(/(?:音を消す|ミュート)/.test(text))return {type:'mute',description:'選択クリップをミュート'};
 return null;
}
