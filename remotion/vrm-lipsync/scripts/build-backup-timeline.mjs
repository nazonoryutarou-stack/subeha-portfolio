#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const wordPath=process.argv[2] ?? path.join(root,'input','word-timing.jsonl');
const mouthPath=process.argv[3] ?? path.join(root,'input','mouth.jsonl');
const outPath=process.argv[4] ?? path.join(root,'src','backup','generatedTimeline.ts');

const lines=(p)=>fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean).map((line,n)=>{
  try{return JSON.parse(line)}catch(e){throw new Error(`${p}:${n+1}: invalid JSON`)}
});

const wordRows=lines(wordPath).filter(x=>x.type==='part');
const mouthRows=lines(mouthPath).filter(x=>x.type==='mouth');

if(!wordRows.length) throw new Error('word timing contains no type=part rows');
if(!mouthRows.length) throw new Error('mouth curve contains no type=mouth rows');

wordRows.sort((a,b)=>Number(a.start_ms)-Number(b.start_ms));
mouthRows.sort((a,b)=>Number(a.t_ms)-Number(b.t_ms));

for(let i=0;i<wordRows.length;i++){
  const start=Number(wordRows[i].start_ms);
  if(!Number.isFinite(start)||start<0) throw new Error(`invalid start_ms at word row ${i}`);
  if(i && start<Number(wordRows[i-1].start_ms)) throw new Error('word timing not monotonic');
}
for(let i=0;i<mouthRows.length;i++){
  const t=Number(mouthRows[i].t_ms);
  if(!Number.isFinite(t)||t<0) throw new Error(`invalid t_ms at mouth row ${i}`);
  if(i && t<Number(mouthRows[i-1].t_ms)) throw new Error('mouth timing not monotonic');
}

const inferredEnd=(i)=>{
  const row=wordRows[i];
  const explicit=Number(row.end_ms);
  if(Number.isFinite(explicit)&&explicit>Number(row.start_ms)) return explicit;
  const next=Number(row.next_start_ms);
  if(Number.isFinite(next)&&next>Number(row.start_ms)) return next;
  if(i+1<wordRows.length) return Number(wordRows[i+1].start_ms);
  return Number(row.start_ms)+650;
};

const parts=wordRows.map((r,i)=>({
  text:String(r.text??''),
  startMs:Math.round(Number(r.start_ms)),
  endMs:Math.max(Math.round(Number(r.start_ms))+1,Math.round(inferredEnd(i))),
  confidence:Number.isFinite(Number(r.confidence_level))?Number(r.confidence_level):
    (Number.isFinite(Number(r.probability))?Number(r.probability):undefined),
  timingMode:String(r.timing_mode??'token'),
  segmentIndex:Number.isFinite(Number(r.segment_index))?Number(r.segment_index):undefined,
}));

const rawMouths=mouthRows.map(r=>({
  tMs:Math.round(Number(r.t_ms)),
  open:Math.max(0,Math.min(1,Number(r.open)||0)),
  voiced:Boolean(r.voiced_hint),
}));

const durationMs=Math.max(
  parts.at(-1)?.endMs??0,
  rawMouths.at(-1)?.tMs??0
);

// Analysis stays at ~10 ms, but the rendered video is 30 fps.
// Collapse each video-frame bucket to its maximum mouth opening so articulation
// peaks survive without embedding hundreds of thousands of unnecessary samples.
const renderFps=30;
const frameMs=1000/renderFps;
const renderFrames=Math.max(1,Math.ceil(durationMs/frameMs));
const mouths=[];
let cursor=0;
for(let frame=0;frame<renderFrames;frame++){
  const start=frame*frameMs;
  const end=(frame+1)*frameMs;
  while(cursor<rawMouths.length && rawMouths[cursor].tMs<start) cursor++;
  let j=cursor, open=0, voiced=false;
  while(j<rawMouths.length && rawMouths[j].tMs<end){
    open=Math.max(open,rawMouths[j].open);
    voiced=voiced||rawMouths[j].voiced;
    j++;
  }
  mouths.push({tMs:Math.round(start),open,voiced});
}

const timingSource=String(wordRows[0]?.source??'unknown-timing');
const src=`// AUTO-GENERATED. Do not hand-edit.
export type TimingPart={text:string;startMs:number;endMs:number;confidence?:number;timingMode?:string;segmentIndex?:number};
export type MouthFrame={tMs:number;open:number;voiced:boolean};
export const backupMeta=${JSON.stringify({schema:'subeha-vtuber-backup-v1',source:timingSource+'+waveform-rms',durationMs,renderFps},null,2)} as const;
export const timingParts:TimingPart[]=${JSON.stringify(parts)};
export const mouthFrames:MouthFrame[]=${JSON.stringify(mouths)};
`;
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,src);
console.log(JSON.stringify({parts:parts.length,mouthSourceFrames:rawMouths.length,mouthFrames:mouths.length,durationMs,renderFps,outPath}));
