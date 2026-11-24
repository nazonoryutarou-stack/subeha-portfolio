/* Procedural VRM motion curves. Radians, in normalized humanoid local joint space.
   No DOM/THREE dependency: deterministic snapshots and bounds can be tested in Node. */
export const RELAXED_BASE_POSE=Object.freeze({
 spine:[2,0,0],chest:[-2,0,0],neck:[-1,0,0],
 leftUpperArm:[-6,0,70],rightUpperArm:[-6,0,-70],
 leftLowerArm:[-7,0,-7],rightLowerArm:[-7,0,7],
 leftHand:[-3,0,-3],rightHand:[-3,0,3],
 leftUpperLeg:[-2,0,2],rightUpperLeg:[-2,0,-2],
 leftLowerLeg:[3,0,0],rightLowerLeg:[3,0,0],
});
export const MOTION_LABELS=Object.freeze([
 ['idle','自然な待機'],['breathe','深呼吸'],['sway','ゆったり揺れる'],
 ['talk','話す'],['explain','説明する'],['nod','うなずく'],
 ['shake','首を横に振る'],['wave','手を振る'],['bow','お辞儀'],
 ['listen','耳を傾ける'],['point','右を指す'],['pointLeft','左を指す'],
 ['celebrate','喜ぶ'],['shyMove','照れる'],['thinkingMove','考え込む'],
 ['lookAround','見回す'],['stepShift','重心を移す'],['idolBounce','リズムに乗る'],
 ['prayerMove','祈る'],['tired','疲れる'],['confident','堂々とする'],
 ['danceLight','軽く踊る'],['sneak','忍び足'],
]);
const rad=d=>d*Math.PI/180;
const sin=Math.sin;
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
/* Return movement deviations only; base pose remains intact underneath.
   Intensity scales every dynamic contribution, not the neutral standing pose. */
export function movementAngles(kind,time,shotStart=0,intensity=.75){
 const t=Math.max(0,finite(time)),local=Math.max(0,t-finite(shotStart));
 const a=clamp(finite(intensity),0,1);
 const out={};
 const set=(joint,x=0,y=0,z=0)=>{out[joint]=[rad(x)*a,rad(y)*a,rad(z)*a];};
 const w=sin(t*1.8),slow=sin(t*.8),beat=sin(local*5),walk=sin(local*3.2);
 set('spine',.6*w,0,.4*slow);set('chest',.8*w,0,-.5*slow);
 set('head',.5*sin(t*.9),.8*sin(t*.57),0);
 if(kind==='idle')return out;
 if(kind==='breathe'){set('chest',3*sin(t*1.55),0,0);set('spine',1.8*sin(t*1.55+.4),0,0);set('leftShoulder',0,0,1.5*sin(t*1.55));set('rightShoulder',0,0,-1.5*sin(t*1.55));}
 else if(kind==='sway'){set('hips',0,0,2.5*slow);set('spine',0,0,-3.5*slow);set('chest',0,1.5*slow,-2*slow);set('head',0,-2*slow,2*slow);set('leftUpperArm',0,0,4*slow);set('rightUpperArm',0,0,4*slow);}
 else if(kind==='nod'){set('head',12*sin(local*5),0,0);set('neck',3*sin(local*5-.3),0,0);}
 else if(kind==='shake'){set('head',0,18*sin(local*4),0);set('chest',0,2*sin(local*4-.6),0);}
 else if(kind==='bow'){const bow=clamp(local/.65,0,1);set('spine',27*bow,0,0);set('chest',9*bow,0,0);set('head',-7*bow,0,0);set('hips',4*bow,0,0);}
 else if(kind==='listen'){set('head',-5,-9,7);set('chest',0,-4,0);set('rightShoulder',0,0,-4);}
 else if(kind==='talk'||kind==='explain'){
  const expressive=kind==='explain'?1.5:1;
  set('head',3*sin(local*2.3),5*sin(local*1.4),0);
  set('chest',1,4*sin(local*1.5),0);
  set('leftUpperArm',-9*expressive-7*sin(local*2.8),0,-12*expressive+9*sin(local*2));
  set('rightUpperArm',-11*expressive+8*sin(local*2.3),0,13*expressive-9*sin(local*2.5));
  set('leftLowerArm',-15*expressive+9*sin(local*2.2),0,6);
  set('rightLowerArm',-18*expressive+10*sin(local*2.4),0,-6);
 }
 else if(kind==='wave'){set('rightUpperArm',-18,0,-45);set('rightLowerArm',-30,0,18+20*sin(local*7));set('rightHand',0,0,14*sin(local*7));set('head',0,-7,0);}
 else if(kind==='point'||kind==='pointLeft'){
  const left=kind==='pointLeft',arm=left?'left':'right',sign=left?-1:1;
  set(arm+'UpperArm',-28,0,sign* -45);set(arm+'LowerArm',-4,0,0);
  set('chest',0,sign* -8,0);set('head',0,sign* -12,0);
 }
 else if(kind==='celebrate'){set('leftUpperArm',-35,0,-33);set('rightUpperArm',-35,0,33);set('leftLowerArm',-35+12*beat,0,0);set('rightLowerArm',-35-12*beat,0,0);set('hips',0,0,3*beat);set('chest',-4*beat,0,0);}
 else if(kind==='shyMove'){set('spine',6,0,0);set('head',8,-9,5);set('leftUpperArm',-15,0,-12);set('rightUpperArm',-15,0,12);set('leftLowerArm',-24,0,0);set('rightLowerArm',-24,0,0);}
 else if(kind==='thinkingMove'){set('head',10,-8+3*slow,-4);set('rightUpperArm',-18,0,-15);set('rightLowerArm',-62,0,12);set('chest',3,0,0);}
 else if(kind==='lookAround'){set('head',0,22*sin(local*.8),-2);set('neck',0,5*sin(local*.8-.3),0);set('chest',0,5*sin(local*.8-.5),0);}
 else if(kind==='stepShift'){set('hips',0,0,5*walk);set('spine',0,0,-4*walk);set('leftUpperLeg',5*walk,0,0);set('rightUpperLeg',-5*walk,0,0);set('leftLowerLeg',3*Math.max(0,walk),0,0);set('rightLowerLeg',3*Math.max(0,-walk),0,0);}
 else if(kind==='idolBounce'){set('hips',2+4*Math.max(0,beat),0,3*sin(local*2.5));set('spine',-3*Math.max(0,beat),0,-3*sin(local*2.5));set('leftUpperArm',-12,0,-8+8*beat);set('rightUpperArm',-12,0,8-8*beat);set('head',-2*beat,0,0);}
 else if(kind==='prayerMove'){set('leftUpperArm',-25,0,-12);set('rightUpperArm',-25,0,12);set('leftLowerArm',-35,0,0);set('rightLowerArm',-35,0,0);set('head',9+2*slow,0,0);}
 else if(kind==='tired'){set('spine',9+2*slow,0,0);set('chest',7,0,0);set('head',12+3*slow,0,0);set('leftShoulder',0,0,4);set('rightShoulder',0,0,-4);}
 else if(kind==='confident'){set('spine',-5,0,0);set('chest',-7,0,0);set('head',-4,0,0);set('leftUpperArm',0,0,-6);set('rightUpperArm',0,0,6);}
 else if(kind==='danceLight'){set('hips',0,7*walk,7*walk);set('spine',3*sin(local*3.2),-6*walk,-6*walk);set('chest',0,6*walk,0);set('leftUpperArm',-18+12*walk,0,-18+12*walk);set('rightUpperArm',-18-12*walk,0,18+12*walk);set('leftUpperLeg',9*walk,0,0);set('rightUpperLeg',-9*walk,0,0);}
 else if(kind==='sneak'){set('spine',15+2*walk,0,0);set('hips',5,0,4*walk);set('leftUpperLeg',12*walk,0,0);set('rightUpperLeg',-12*walk,0,0);set('leftLowerLeg',10*Math.max(0,-walk),0,0);set('rightLowerLeg',10*Math.max(0,walk),0,0);set('leftUpperArm',-12,0,0);set('rightUpperArm',-12,0,0);}
 return out;
}
