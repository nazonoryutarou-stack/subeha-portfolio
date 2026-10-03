export const visible = a => a.fragments.filter(f=>['placeholder','published'].includes(f.status));
export const edges = fs => {const ids=new Set(fs.map(f=>f.id));return fs.flatMap(f=>[f.nextId,...f.branchIds].filter(id=>id&&ids.has(id)).map(to=>({from:f.id,to})));};
export function validate(a){
 if(a.schemaVersion!==1||a.siteName!=='すべての歯が見える'||!Array.isArray(a.fragments))throw Error('Invalid archive');
 const ids=new Set(),nums=new Set();
 for(const f of a.fragments){
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(f.id)||ids.has(f.id))throw Error('Duplicate/invalid id');ids.add(f.id);
  if(!/^\d+(?:-\d+)*$/.test(f.branchNumber)||nums.has(f.branchNumber))throw Error('Duplicate/invalid branch');nums.add(f.branchNumber);
  if(!['placeholder','draft','published','archived'].includes(f.status)||!['fragment','poem','record','quotation'].includes(f.kind)||!Array.isArray(f.branchIds)||!Array.isArray(f.tags)||!f.tags.every(t=>typeof t==='string')||!Number.isFinite(f.order))throw Error('Invalid fields');
  if(f.status==='placeholder'&&(f.body!==null||f.textOrigin!==null||f.citation!==null))throw Error('Placeholder must have no manuscript');
  if(f.body!==null&&(typeof f.body!=='string'||f.textOrigin!==(f.kind==='quotation'?'designated-quotation':'author')))throw Error('Missing text provenance');
  if(f.status==='published'&&!f.body?.trim())throw Error('Published body required');
  for(const date of [f.writtenAt,f.publishedAt])if(date!==null&&(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date.slice(0,10)).toISOString().slice(0,10)!==date.slice(0,10)))throw Error('Invalid date');
  if(f.citation){if(f.kind!=='quotation'||typeof f.citation!=='object')throw Error('Invalid citation');for(const [k,v]of Object.entries(f.citation)){if(!['author','source','work','note','url'].includes(k)||typeof v!=='string')throw Error('Invalid citation field');if(k==='url'&&!/^https?:$/.test(new URL(v).protocol))throw Error('Invalid citation URL');}}
 }
 if(!ids.has(a.entryId)||!visible(a).some(f=>f.id===a.entryId))throw Error('Invalid entry');
 for(const f of a.fragments){const out=[f.nextId,...f.branchIds].filter(Boolean);if(new Set(out).size!==out.length)throw Error('Duplicate edge');for(const id of [f.previousId,...out].filter(Boolean))if(!ids.has(id)||id===f.id)throw Error('Invalid connection');}
 return a;
}
export const chronological = fs => [...fs].sort((a,b)=>(a.writtenAt||a.publishedAt||'9999').localeCompare(b.writtenAt||b.publishedAt||'9999')||a.order-b.order);
