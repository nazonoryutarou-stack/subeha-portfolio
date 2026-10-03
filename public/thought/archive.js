(()=>{'use strict';
const base=new URL('./',document.currentScript.src),root=new URL('../',base),current=document.body.dataset.current;
const get=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key))||fallback;}catch{return fallback;}};
const set=(storage,key,value)=>{try{storage.setItem(key,JSON.stringify(value));}catch{}};
fetch(new URL('meta.json',base)).then(r=>{if(!r.ok)throw Error('metadata');return r.json();}).then(a=>{
 const by=new Map(a.fragments.map(f=>[f.id,f])),valid=id=>by.has(id),fragmentURL=id=>new URL(`thought/fragments/${id}/`,root).href;
 const seen=new Set(get(localStorage,'thought-seen',[]).filter(valid));
 let trail=[];
 if(current){const state=history.state?.thoughtTrail;const pending=get(sessionStorage,'thought-pending',null);const nav=performance.getEntriesByType('navigation')[0]?.type;
 if(Array.isArray(state)&&state.at(-1)===current)trail=state.filter(valid);
 else if(nav!=='reload'&&pending?.to===current&&Array.isArray(pending.trail))trail=[...pending.trail.filter(valid),current];
 else trail=[current];
 set(sessionStorage,'thought-pending',null);seen.add(current);set(localStorage,'thought-seen',[...seen]);set(sessionStorage,'thought-trail',trail);set(sessionStorage,'thought-current',current);history.replaceState({...history.state,thoughtTrail:trail},'');
 }else trail=get(sessionStorage,'thought-trail',[]).filter(valid);
 function paint(){
  const list=document.querySelector('[data-trail]');
  if(list){list.replaceChildren(...trail.map((id,i)=>{const li=document.createElement('li');if(i===trail.length-1){li.textContent=by.get(id).branchNumber;li.setAttribute('aria-current','step');}else{const link=document.createElement('a');link.href=fragmentURL(id);link.dataset.to=id;link.textContent=by.get(id).branchNumber;li.append(link);}return li;}));}
  const active=current||get(sessionStorage,'thought-current','');
  document.querySelectorAll('[data-fragment]').forEach(node=>{
   const id=node.dataset.fragment;
   node.classList.toggle('is-visited',seen.has(id));node.classList.toggle('is-current',id===active);
   if(id===active)node.setAttribute('aria-current','location');else node.removeAttribute('aria-current');
   node.setAttribute('aria-label',`断章 ${by.get(id).branchNumber}・${id===active?'現在地':seen.has(id)?'通過済み':'未読'}`);
  });
  document.querySelectorAll('[data-fragment-from]').forEach(edge=>edge.classList.toggle('is-travelled',trail.some((id,i)=>id===edge.dataset.fragmentFrom&&trail[i+1]===edge.dataset.fragmentTo)));
 }

 paint();addEventListener('pageshow',()=>{if(current){set(sessionStorage,'thought-trail',trail);set(sessionStorage,'thought-current',current);}else trail=get(sessionStorage,'thought-trail',[]).filter(valid);paint();});
 document.addEventListener('click',e=>{const link=e.target.closest('a[data-to]');if(!link||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const to=link.dataset.to;set(sessionStorage,'thought-pending',{to,trail:current?trail:[]});});
 const search=document.querySelector('[data-search]');if(search){search.parentElement.hidden=false;search.addEventListener('input',()=>{const q=search.value.trim().toLocaleLowerCase();document.querySelectorAll('.index-row').forEach(row=>{const f=by.get(row.dataset.to);row.hidden=!`${f.branchNumber} ${f.tags.join(' ')}`.toLocaleLowerCase().includes(q);});});}
 document.addEventListener('wordtreedrawn',paint);
}).catch(()=>{});
})();
