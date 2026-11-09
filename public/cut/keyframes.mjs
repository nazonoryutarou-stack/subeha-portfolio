/* Interpolated base-clip transforms in source-independent timeline seconds. */
export function clipTransform(clip,seconds){
 const base={x:clip.x??.5,y:clip.y??.5,zoom:clip.zoom??1,rotation:clip.rotation??0,opacity:clip.opacity??1};
 const points=(clip.keyframes||[]).filter(x=>Number.isFinite(x.time)).slice().sort((a,b)=>a.time-b.time);
 if(!points.length)return base;
 if(seconds<=points[0].time)return {...base,...numericFields(points[0])};
 if(seconds>=points.at(-1).time)return {...base,...numericFields(points.at(-1))};
 const b=points.findIndex(f=>f.time>=seconds),before=points[b-1],after=points[b];
 let t=(seconds-before.time)/(after.time-before.time);
 if(clip.easing==='ease-in-out')t=t*t*(3-2*t);
 const out={...base};
 for(const k of Object.keys(base))out[k]=Number(before[k]??base[k])+(Number(after[k]??base[k])-Number(before[k]??base[k]))*t;
 return out;
}
function numericFields(point){const props={};for(const k of ['x','y','zoom','rotation','opacity'])if(Number.isFinite(point[k]))props[k]=point[k];return props;}
