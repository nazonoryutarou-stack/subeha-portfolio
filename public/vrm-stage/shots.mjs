/* VRM Stage / shot data model. No browser globals; testable in Node. */
export const EXPRESSIONS=Object.freeze(['neutral','happy','angry','sad','relaxed','surprised']);
export const MOVEMENTS=Object.freeze(['idle','nod','shake','wave','bow','listen','talk']);
export const CAMERAS=Object.freeze(['full','medium','close']);
export const MOUTHS=Object.freeze(['auto','closed','aa','ee','ih','oh','ou']);

/* Per-cut authorable humanoid joint rotations (degrees) for user-owned VRMs. */
export const POSE_BONES=Object.freeze([
 ['hips','腰'],['spine','背骨'],['chest','胸'],['upperChest','胸上部'],
 ['neck','首'],['head','頭'],['leftShoulder','左肩'],['leftUpperArm','左上腕'],
 ['leftLowerArm','左肘'],['leftHand','左手'],['rightShoulder','右肩'],
 ['rightUpperArm','右上腕'],['rightLowerArm','右肘'],['rightHand','右手'],
 ['leftUpperLeg','左太もも'],['leftLowerLeg','左膝'],['leftFoot','左足'],
 ['rightUpperLeg','右太もも'],['rightLowerLeg','右膝'],['rightFoot','右足']
]);
const BONE_KEYS=new Set(POSE_BONES.map(([key])=>key));
export const POSE_PRESETS=Object.freeze([
 ['neutral','基本姿勢'],['armsOpen','腕を広げる'],['greeting','挨拶'],
 ['point','指さし'],['thinking','考える'],['dance','ダンス姿勢'],
 ['sit','座り姿勢（簡易）']
]);
export function normalizePose(raw){
 const result={};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
 for(const [key,value] of Object.entries(raw)){
  if(!BONE_KEYS.has(key)||!Array.isArray(value)||value.length!==3)continue;
  const angles=value.map(n=>Math.round(clamp(n,-130,130)*10)/10);
  if(angles.some(n=>Math.abs(n)>.0001))result[key]=angles;
 }
 return result;
}
export function presetPose(name){
 const result={
  neutral:{},
  armsOpen:{leftUpperArm:[-12,0,72],rightUpperArm:[-12,0,-72],leftLowerArm:[0,0,-12],rightLowerArm:[0,0,12]},
  greeting:{rightUpperArm:[-10,0,-115],rightLowerArm:[0,0,-65],head:[10,0,0]},
  point:{rightUpperArm:[-70,0,-45],rightLowerArm:[0,0,-22],head:[0,-10,0]},
  thinking:{rightUpperArm:[-35,0,-45],rightLowerArm:[-35,0,-75],head:[12,-8,0]},
  dance:{leftUpperArm:[-25,0,92],rightUpperArm:[-20,0,-100],leftUpperLeg:[-18,0,12],rightUpperLeg:[22,0,-8],spine:[0,12,12]},
  sit:{leftUpperLeg:[-78,0,0],rightUpperLeg:[-78,0,0],leftLowerLeg:[77,0,0],rightLowerLeg:[77,0,0],spine:[-5,0,0]}
 };
 return normalizePose(result[name]||{});
}

const num=(x,f=0)=>Number.isFinite(Number(x))?Number(x):f;
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,num(x)));
export const SHOT_DEFAULT=Object.freeze({expression:'neutral',movement:'idle',camera:'medium',mouth:'auto',intensity:.75,framing:0});
export const seconds=n=>Math.max(.01,Math.min(7200,num(n,20)));
export const newShot=(start,end,settings={})=>({...SHOT_DEFAULT,...settings,id:'s'+Math.random().toString(36).slice(2,10),start,end});
export function normalizeShots(shots,duration=20){
 const total=seconds(duration);
 const list=(Array.isArray(shots)?shots:[]).map((shot,i)=>({...SHOT_DEFAULT,...shot,
  id:String(shot.id||'s'+i),start:clamp(shot.start,0,total),
  intensity:clamp(shot.intensity,0,1),framing:clamp(shot.framing,-1,1),
  expression:EXPRESSIONS.includes(shot.expression)?shot.expression:'neutral',
  movement:MOVEMENTS.includes(shot.movement)?shot.movement:'idle',
  camera:CAMERAS.includes(shot.camera)?shot.camera:'medium',
  mouth:MOUTHS.includes(shot.mouth)?shot.mouth:'auto',
  pose:normalizePose(shot.pose),
  zoom:clamp(shot.zoom??1,.45,2.3)})).sort((a,b)=>a.start-b.start);
 if(!list.length)list.push(newShot(0,total));
 list[0].start=0;
 for(let i=1;i<list.length;i++)list[i].start=clamp(list[i].start,list[i-1].start+.1,total-.1);
 return list.map((s,i)=>({...s,end:i+1<list.length?list[i+1].start:total}));
}
export function splitShot(shots,time,duration){
 const total=seconds(duration),list=normalizeShots(shots,total),t=clamp(time,.1,total-.1);
 const index=list.findIndex(s=>t>s.start+.09&&t<s.end-.09);
 if(index<0)return list;
 const next=list.slice();next.splice(index+1,0,newShot(t,total,{...list[index],id:undefined}));
 return normalizeShots(next,total);
}
export function moveCut(shots,index,time,duration){
 const list=normalizeShots(shots,duration);
 if(index<=0||index>=list.length)return list;
 const a=list[index-1],b=list[index];
 list[index].start=clamp(time,a.start+.1,b.end-.1);
 return normalizeShots(list,duration);
}
export function removeShot(shots,index,duration){
 const list=normalizeShots(shots,duration);
 if(list.length<=1||index<0||index>=list.length)return list;
 list.splice(index,1);return normalizeShots(list,duration);
}
export function findShot(shots,time){
 if(!shots.length)return null;return shots.find(s=>time>=s.start&&time<s.end)||shots[shots.length-1];
}
export function computeEnvelope(channelData,sampleRate,step=1/40){
 if(!channelData?.length||!sampleRate)return [];
 const windowSize=Math.max(1,Math.floor(sampleRate*step));
 const result=[];
 for(let i=0;i<channelData.length;i+=windowSize){
  let square=0,count=0;
  for(let j=i;j<Math.min(i+windowSize,channelData.length);j+=3){const v=channelData[j];square+=v*v;count++;}
  result.push(Math.sqrt(square/Math.max(1,count)));
 }
 return result;
}
export function amplitudeAt(envelope,t,step=1/40,gain=6){
 const index=clamp(Math.floor(Math.max(0,t)/step),0,Math.max(0,envelope.length-1));
 const raw=envelope[index]||0;
 return clamp(Math.max(0,raw-.018)*gain,0,1);
}
export function projectJSON(shots,duration){
 return {schema:'vrm-stage/v1',duration:seconds(duration),shots:normalizeShots(shots,duration).map(({id,start,expression,movement,camera,mouth,intensity,framing,pose,zoom})=>({id,start,expression,movement,camera,mouth,intensity,framing,pose,zoom}))};
}
