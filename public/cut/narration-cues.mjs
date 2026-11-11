/** Generate editable, approximate subtitle timings from a written narration. No ASR is claimed. */
export function splitNarration(text, maxChars=19){
  const src=String(text||'').replace(/\r/g,'').trim();
  if(!src)return [];
  const result=[];
  for(const paragraph of src.split(/\n+/)){
    let buffer='';
    for(const ch of Array.from(paragraph.replace(/\s+/g,' '))){
      buffer+=ch;
      const natural=/[。！？!?、，,;；]/.test(ch);
      if(natural || Array.from(buffer).length>=maxChars){
        if(buffer.trim())result.push(buffer.trim());buffer='';
      }
    }
    if(buffer.trim())result.push(buffer.trim());
  }
  return result.slice(0,180);
}
export function makeNarrationCues(text,{start=0,duration=0,idFactory}={}){
  const parts=splitNarration(text);
  if(!parts.length||!Number.isFinite(duration)||duration<=0)return [];
  const begins=Math.max(0,Number(start)||0);
  const weights=parts.map(p=>Math.max(1,Array.from(p).filter(ch=>!/[\s、。，！？!?]/.test(ch)).length));
  const total=weights.reduce((a,b)=>a+b,0), out=[];
  let elapsed=0;
  for(let i=0;i<parts.length;i++){
    const from=begins+elapsed;
    const end= i===parts.length-1 ? begins+duration : begins+duration*(weights.slice(0,i+1).reduce((a,b)=>a+b,0)/total);
    // Preserve a short pause between clauses without introducing time drift.
    const gap=Math.min(.07,(end-from)*.1);
    if(end-from>=.04)out.push({id:idFactory?.()||`voice-cue-${i}-${Date.now()}`,start:Math.round(from*1000)/1000,end:Math.round((end-gap)*1000)/1000,text:parts[i]});
    elapsed=end-begins;
  }
  return out;
}
