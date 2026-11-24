/* VRM Stage / shot data model. No browser globals; testable in Node. */
export const EXPRESSIONS=Object.freeze(['neutral','happy','angry','sad','relaxed','surprised']);
import {MOTION_LABELS} from './motion-rig.mjs';
export const MOVEMENTS=Object.freeze(MOTION_LABELS.map(([id])=>id));
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
 ['neutral','自然な立ち姿'],['tPose','T字（確認用）'],['armsOpen','腕を広げる'],
 ['greeting','挨拶'],['point','右を指す'],['pointLeft','左を指す'],
 ['thinking','考える'],['handsOnHips','腰に手を添える'],['armsCrossed','腕組み風'],
 ['prayer','祈る'],['shy','照れる'],['proud','胸を張る'],
 ['idolPose','決めポーズ'],['crouchReady','身構える'],['dance','ダンス姿勢'],
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

export function normalizeExpressionMix(raw){
 const out={};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
 for(const [key,value] of Object.entries(raw).slice(0,64)){
  if(typeof key!=='string'||!key||key.length>80||/[<>\\x00-\\x1f]/.test(key))continue;
  const amount=clamp(value,0,1);
  if(amount>0)out[key]=Math.round(amount*1000)/1000;
 }
 return out;
}

/* Presets are offsets from the relaxed base pose, not absolute T-pose rotations.
   The tPose exception is an optional rig diagnostic that cancels the base. */
export function presetPose(name){
 const result={
  neutral:{},
  tPose:{spine:[-2,0,0],chest:[2,0,0],neck:[1,0,0],
   leftUpperArm:[6,0,-70],rightUpperArm:[6,0,70],
   leftLowerArm:[7,0,7],rightLowerArm:[7,0,-7],
   leftHand:[3,0,3],rightHand:[3,0,-3],
   leftUpperLeg:[2,0,-2],rightUpperLeg:[2,0,2],
   leftLowerLeg:[-3,0,0],rightLowerLeg:[-3,0,0]},
  armsOpen:{leftUpperArm:[0,0,-55],rightUpperArm:[0,0,55],leftLowerArm:[-5,0,0],rightLowerArm:[-5,0,0]},
  greeting:{rightUpperArm:[-23,0,-47],rightLowerArm:[-45,0,14],rightHand:[0,0,-8],head:[4,-7,0]},
  point:{rightUpperArm:[-33,0,-50],rightLowerArm:[-7,0,0],head:[0,-10,0],chest:[0,-7,0]},
  pointLeft:{leftUpperArm:[-33,0,50],leftLowerArm:[-7,0,0],head:[0,10,0],chest:[0,7,0]},
  thinking:{rightUpperArm:[-23,0,-20],rightLowerArm:[-68,0,12],rightHand:[9,0,10],head:[9,-8,-4]},
  handsOnHips:{leftUpperArm:[-18,0,-16],rightUpperArm:[-18,0,16],
   leftLowerArm:[-64,0,15],rightLowerArm:[-64,0,-15],chest:[-5,0,0]},
  armsCrossed:{leftUpperArm:[-30,0,-24],rightUpperArm:[-30,0,24],
   leftLowerArm:[-88,0,-25],rightLowerArm:[-88,0,25],chest:[-3,0,0]},
  prayer:{leftUpperArm:[-35,0,-15],rightUpperArm:[-35,0,15],
   leftLowerArm:[-48,0,0],rightLowerArm:[-48,0,0],head:[8,0,0]},
  shy:{head:[9,-7,5],chest:[7,0,0],leftUpperArm:[-12,0,-8],rightUpperArm:[-12,0,8],
   leftLowerArm:[-26,0,0],rightLowerArm:[-26,0,0],leftUpperLeg:[0,0,-4],rightUpperLeg:[0,0,4]},
  proud:{spine:[-5,0,0],chest:[-7,0,0],head:[-4,0,0],leftUpperArm:[0,0,-6],rightUpperArm:[0,0,6]},
  idolPose:{leftUpperArm:[-20,0,-26],rightUpperArm:[-36,0,-42],
   rightLowerArm:[-42,0,0],spine:[-3,0,8],head:[-5,0,-7],leftUpperLeg:[0,0,-6]},
  crouchReady:{spine:[18,0,0],leftUpperLeg:[-33,0,0],rightUpperLeg:[-36,0,0],
   leftLowerLeg:[52,0,0],rightLowerLeg:[54,0,0],leftUpperArm:[-25,0,-10],rightUpperArm:[-25,0,10]},
  dance:{leftUpperArm:[-25,0,-30],rightUpperArm:[-25,0,-48],
   leftUpperLeg:[-18,0,12],rightUpperLeg:[22,0,-8],spine:[0,12,12]},
  sit:{leftUpperLeg:[-78,0,0],rightUpperLeg:[-78,0,0],
   leftLowerLeg:[77,0,0],rightLowerLeg:[77,0,0],spine:[-5,0,0]},
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
  expressionMix:normalizeExpressionMix(shot.expressionMix),
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
 return {schema:'vrm-stage/v1',duration:seconds(duration),shots:normalizeShots(shots,duration).map(({id,start,expression,movement,camera,mouth,intensity,framing,pose,expressionMix,zoom})=>({id,start,expression,movement,camera,mouth,intensity,framing,pose,expressionMix,zoom}))};
}
