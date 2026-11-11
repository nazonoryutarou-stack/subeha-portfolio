import {layoutTitle,drawTitle} from './title-render.mjs';
/* SUBEHA CUT v0.4 — timestamp-faithful subtitle ingest and canvas burn-in. No ASR, no cloud. */
export function parseTimestamp(input) {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : NaN;
  const value=String(input ?? '').trim().replace(',', '.');
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const m=/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);
  if(!m) return NaN;
  const h=Number(m[1]||0), min=Number(m[2]), sec=Number(m[3]);
  if(min>59&&m[1]||sec>59)return NaN;
  return h*3600+min*60+sec+Number((m[4]||'0').padEnd(3,'0'))/1000;
}
export function normalizeCues(items,{offset=0,limit=3000}={}){
  if(!Array.isArray(items))throw new Error('字幕データは配列で指定してください');
  const out=[];
  for(const cue of items.slice(0,limit+1)){
    if(out.length>=limit)throw new Error(`字幕数が上限${limit}件を超えています`);
    const start=parseTimestamp(cue.start),end=parseTimestamp(cue.end);
    const txt=String(cue.text??cue.content??'').replace(/<[^>]*>/g,'').trim().slice(0,500);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!txt)continue;
    out.push({id:globalThis.crypto?.randomUUID?.()||'cue-'+out.length+'-'+Date.now(),start:Math.max(0,start+offset),end:Math.max(.001,end+offset),text:txt});
  }
  return out.filter(x=>x.end>x.start).sort((a,b)=>a.start-b.start);
}
export function parseSRT(text,{offset=0}={}){
  const blocks=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/);
  const cues=[];
  for(const block of blocks){
    const lines=block.trim().split('\n'),i=lines.findIndex(x=>x.includes('-->'));
    if(i<0)continue;
    const m=/^\s*(\S+)\s*-->\s*(\S+)/.exec(lines[i]);
    if(m)cues.push({start:m[1],end:m[2],text:lines.slice(i+1).join('\n')});
  }
  return normalizeCues(cues,{offset});
}
export function parseVTT(text,{offset=0}={}){
  const input=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/^WEBVTT[^\n]*\n/,'');
  const blocks=input.trim().split(/\n\s*\n/),cues=[];
  for(const block of blocks){
    if(/^\s*(NOTE|STYLE|REGION)(\s|$)/.test(block))continue;
    const lines=block.trim().split('\n'),i=lines.findIndex(x=>x.includes('-->'));
    if(i<0)continue;
    const m=/^\s*(\S+)\s*-->\s*(\S+)/.exec(lines[i]);
    if(m)cues.push({start:m[1],end:m[2],text:lines.slice(i+1).join('\n')});
  }
  return normalizeCues(cues,{offset});
}
function whisperTime(x){
  if(x==null)return NaN;
  if(typeof x==='object'){
    if(x.ms!=null)return Number(x.ms)/1000;
    if(x.from!=null)return parseTimestamp(x.from);
  }
  return parseTimestamp(x);
}
export function parseWhisperJSON(source,{offset=0}={}){
  const obj=typeof source==='string'?JSON.parse(source):source;
  const segments=Array.isArray(obj)?obj:obj?.segments||obj?.transcription||obj?.results?.segments;
  if(!Array.isArray(segments))throw new Error('Whisper JSONに segments / transcription 配列がありません');
  return normalizeCues(segments.map(s=>({start:s.start??(s.t0!=null?Number(s.t0)/100:whisperTime(s.timestamps?.from)),end:s.end??(s.t1!=null?Number(s.t1)/100:whisperTime(s.timestamps?.to)),text:s.text??s.content??s.words?.map(w=>w.word||w.text||'').join('')})),{offset});
}
export function parseSubtitleFile(text,filename='',options={}){
  const name=String(filename).toLowerCase();
  if(name.endsWith('.json'))return parseWhisperJSON(text,options);
  if(name.endsWith('.vtt')||/^\uFEFF?WEBVTT/.test(text))return parseVTT(text,options);
  return parseSRT(text,options);
}
export function activeCue(cues,time){
  if(!Array.isArray(cues)||!cues.length)return null;
  let lo=0,hi=cues.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(cues[mid].start<=time)lo=mid+1;else hi=mid;}
  // Latest cue takes priority in a modest overlap window.
  for(let i=lo-1;i>=Math.max(0,lo-15);i--)if(cues[i].start<=time&&time<cues[i].end)return cues[i];
  return null;
}
export function timestampSRT(n){
  const ms=Math.max(0,Math.round(n*1000));
  const hh=Math.floor(ms/3600000),mm=Math.floor(ms/60000)%60,ss=Math.floor(ms/1000)%60,mmm=ms%1000;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')},${String(mmm).padStart(3,'0')}`;
}
export function exportSRT(cues){return (cues||[]).slice().sort((a,b)=>a.start-b.start).map((c,i)=>`${i+1}\n${timestampSRT(c.start)} --> ${timestampSRT(c.end)}\n${c.text}\n`).join('\n');}
export const defaultCaptionStyle=Object.freeze({size:42,y:.82,color:'#ffffff',background:true,shadow:true});
export function captionAppearance(project,cue){
 const base={x:.5,rotation:0,...defaultCaptionStyle,...(project?.captionStyle||{})};
 return {...base,...(cue?.style||{})};
}
export function captionLayout(ctx,canvas,project,cue){
 const item={...captionAppearance(project,cue),text:cue?.text||''};
 return layoutTitle(ctx,canvas,item,true);
}
export function drawCaptions(ctx,canvas,project,time){
 if(project.captionEnabled===false)return;
 const cue=activeCue(project.captions,time);if(!cue)return;
 return drawTitle(ctx,canvas,{...captionAppearance(project,cue),text:cue.text},true);
}
