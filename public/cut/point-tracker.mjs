/* Small-patch translational tracker for locally decoded video frames. It does NOT do person recognition. */
export function luma(frame,x,y){
  const n=(y*frame.width+x)*4,d=frame.data;
  return .2126*d[n]+.7152*d[n+1]+.0722*d[n+2];
}
export function patchValues(frame,x,y,r=4){
  if(x-r<0||y-r<0||x+r>=frame.width||y+r>=frame.height)return null;
  const values=[];
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)values.push(luma(frame,x+dx,y+dy));
  return values;
}
export function startPointTrack(frame,x,y,r=4){
  x=Math.round(x);y=Math.round(y);
  const patch=patchValues(frame,x,y,r);if(!patch)return null;
  const mean=patch.reduce((a,b)=>a+b,0)/patch.length;
  const variance=patch.reduce((a,b)=>a+(b-mean)**2,0)/patch.length;
  if(variance<14)return null; // flat colours are impossible to follow reliably.
  return {x,y,r,patch,mean,variance};
}
export function trackPoint(frame,previous,{search=15,maxError=29}={}){
  if(!previous)return null;
  const {r,patch}=previous;let best=null,lowest=Infinity;
  const ax=Math.max(r,previous.x-search),bx=Math.min(frame.width-r-1,previous.x+search);
  const ay=Math.max(r,previous.y-search),by=Math.min(frame.height-r-1,previous.y+search);
  for(let y=ay;y<=by;y++)for(let x=ax;x<=bx;x++){
    let error=0,k=0;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      error+=Math.abs(luma(frame,x+dx,y+dy)-patch[k++]);
    }
    error/=patch.length;
    if(error<lowest){lowest=error;best={x,y};}
  }
  if(!best||lowest>maxError)return null;
  // Keep the original template to reduce drift; reject poor matches.
  return {...previous,...best,error:lowest};
}
