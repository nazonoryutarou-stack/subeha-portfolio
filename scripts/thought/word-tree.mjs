// Adapts stable archive connections to the original product-tree markup.
// The original CSS owns all node placement; display numbers never define edges.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderWordTree(fragments,entryId,urlFor){
 const by=new Map(fragments.map(f=>[f.id,f])),expanded=new Set();
 let serial=0;const html=[];
 const walk=start=>{
  const jobs=[{id:start,parent:null,depth:0,sibling:0,root:true}];
  while(jobs.length){const job=jobs.pop();if(job.close){html.push(job.close);continue;}
   const f=by.get(job.id);if(!f)continue;
   const nodeId=`word-node-${++serial}`;
   const repeated=expanded.has(f.id);expanded.add(f.id);
   const children=repeated?[]:[f.nextId,...f.branchIds].filter(id=>id&&by.has(id));
   const category=children.length>0;
   html.push(`<li${job.parent?` data-parent="${job.parent}"`:''}><a class="node ${job.root?'root':category?'category classification'+(job.depth>1?' subcategory':''):'product'}" data-node="${nodeId}" data-fragment="${f.id}" data-to="${f.id}"${category?` data-depth="${job.depth}"`:''} href="${esc(urlFor(f.id))}" aria-label="断章 ${esc(f.branchNumber)}${repeated?'・再接続':''}">`);
   if(job.root){html.push(`<strong>断章 ${esc(f.branchNumber)}</strong>`);}
   else if(category){html.push(`<span class="glyph glyph-${job.sibling%5+1}" aria-hidden="true"></span><span class="category-copy"><strong>断章 ${esc(f.branchNumber)}</strong><small>${f.body===null?(f.kind==='quotation'?'引用未登録':'本文未登録'):''}</small></span>`);}
   else{html.push(`<strong>${f.body===null?(f.kind==='quotation'?'引用未登録':'本文未登録'):esc(f.body)}</strong><span class="meta"><i aria-hidden="true"></i>${esc(f.branchNumber)}</span>`);}
   html.push('</a>');
   if(children.length){html.push('<ul>');jobs.push({close:'</ul></li>'});for(let i=children.length-1;i>=0;i--)jobs.push({id:children[i],parent:nodeId,depth:job.depth+1,sibling:i});}
   else html.push('</li>');
  }
 };
 html.push('<ul class="tree">');
 walk(entryId);for(const f of fragments)if(!expanded.has(f.id))walk(f.id);
 html.push('</ul>');return html.join('');
}
