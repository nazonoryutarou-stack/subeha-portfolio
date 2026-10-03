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
export function layout(fs){
 const es=edges(fs),depth=new Map(),incoming=new Set(es.map(e=>e.to));
 const children=new Map(fs.map(f=>[f.id,[]]));
 for(const e of es)children.get(e.from).push(e.to);
 const queue=fs.filter(f=>!incoming.has(f.id)).map(f=>[f.id,0]);let cursor=0;
 const run=()=>{while(cursor<queue.length){const[id,d]=queue[cursor++];if(depth.has(id))continue;depth.set(id,d);for(const to of children.get(id))if(!depth.has(to))queue.push([to,d+1]);}};
 run();for(const f of fs)if(!depth.has(f.id)){queue.push([f.id,0]);run();}
 const columns=new Map();for(const f of fs){const d=depth.get(f.id);if(!columns.has(d))columns.set(d,[]);columns.get(d).push(f);}
 const maxRows=Math.max(1,...[...columns.values()].map(c=>c.length));
 const nodeWidth=Math.max(136,...fs.map(f=>f.branchNumber.length*9+32));
 const placed=new Map();
 for(const [d,column]of columns)column.forEach((f,row)=>placed.set(f.id,{...f,x:nodeWidth/2+26+d*(nodeWidth+84),y:80+(maxRows-column.length)*80+row*160,nodeWidth}));
 return fs.map(f=>placed.get(f.id));
}
export function connectorPath(source,target){
 const sx=source.x+source.nodeWidth/2,tx=target.x-target.nodeWidth/2;
 const bend=Math.max(36,Math.abs(tx-sx)*.55);
 return `M${sx} ${source.y} C${sx+bend} ${source.y},${tx-bend} ${target.y},${tx} ${target.y}`;
}
export const chronological = fs => [...fs].sort((a,b)=>(a.writtenAt||a.publishedAt||'9999').localeCompare(b.writtenAt||b.publishedAt||'9999')||a.order-b.order);
