/* SUBEHA CUT: visible, inspectable compositor order and timeline layer inventory.
 * Each overlay occupies its own row. Last overlay renders on top.
 */
const finite=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
const active=(start,end,time)=>time>=start&&time<=end;
const safe=(s,f)=>String(s||f||'').trim();
export function layerStackEntries(project={},assets=new Map(),time=0){
 const entries=[],getAsset=id=>typeof assets?.get==='function'?assets.get(id):assets?.[id];
 const p=project||{},t=finite(time),over=p.overlays||[];
 for(let i=over.length-1;i>=0;i--){
  const item=over[i],start=finite(item.start),end=start+Math.max(0,finite(item.duration));
  entries.push({kind:'layer',id:item.id,name:safe(getAsset(item.assetId)?.name,'素材 '+(i+1)),
   start,end,visible:item.visible!==false,active:active(start,end,t)&&item.visible!==false,order:i,top:i===over.length-1});
 }
 for(const item of p.cgScenes||[]){
  const start=finite(item.start),end=start+Math.max(0,finite(item.duration));
  entries.push({kind:'cg',id:item.id,name:safe(item.name,'3Dシーン'),start,end,visible:true,active:active(start,end,t)});
 }
 for(const item of p.texts||[]){
  const start=finite(item.start),end=start+Math.max(0,finite(item.duration));
  entries.push({kind:'text',id:item.id,name:safe(item.text,'テキスト').replace(/\s+/g,' ').slice(0,80),start,end,visible:true,active:active(start,end,t)});
 }
 for(const item of p.captions||[]){
  const start=finite(item.start),end=finite(item.end,start);
  entries.push({kind:'caption',id:item.id,name:safe(item.text,'字幕').replace(/\s+/g,' ').slice(0,80),start,end,visible:p.captionEnabled!==false,active:active(start,end,t)&&p.captionEnabled!==false});
 }
 for(const item of p.audioTracks||[]){
  const start=finite(item.start),end=start+Math.max(0,finite(item.duration));
  entries.push({kind:'audio',id:item.id,name:safe(getAsset(item.assetId)?.name,'音声'),start,end,visible:!item.muted,active:active(start,end,t)&&!item.muted});
 }
 return entries;
}
export function layerSummary(project={},assets=new Map(),time=0){
 const entries=layerStackEntries(project,assets,time);
 return {total:entries.length,overlays:(project.overlays||[]).length,active:entries.filter(e=>e.active).length,entries};
}
export function moveOverlayOrder(overlays,id,direction){
 const list=[...(overlays||[])],i=list.findIndex(x=>x.id===id),j=i+(direction>0?1:-1);
 if(i<0||j<0||j>=list.length)return list;
 [list[i],list[j]]=[list[j],list[i]];
 return list;
}
export const stackTime=seconds=>{
 const s=Math.max(0,finite(seconds));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
};
