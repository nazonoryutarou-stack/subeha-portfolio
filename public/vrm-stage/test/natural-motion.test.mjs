import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {RELAXED_BASE_POSE,MOTION_LABELS,movementAngles} from '../motion-rig.mjs';
import {MOVEMENTS,POSE_BONES,POSE_PRESETS,presetPose,normalizeShots,projectJSON} from '../shots.mjs';
const read=name=>readFileSync(fileURLToPath(new URL('../'+name,import.meta.url)),'utf8');
test('natural rest pose lowers BOTH arms in a normalized VRM T-pose',()=>{
 assert.ok(RELAXED_BASE_POSE.leftUpperArm[2]>55);
 assert.ok(RELAXED_BASE_POSE.rightUpperArm[2]<-55);
 assert.equal(RELAXED_BASE_POSE.leftUpperArm[2],-RELAXED_BASE_POSE.rightUpperArm[2]);
 assert.deepEqual(presetPose('neutral'),{});
 assert.equal(presetPose('tPose').leftUpperArm[2],-RELAXED_BASE_POSE.leftUpperArm[2]);
 assert.equal(presetPose('tPose').rightUpperArm[2],-RELAXED_BASE_POSE.rightUpperArm[2]);
});
test('every motion is named, finite, intensity-clamped and supported by serialization',()=>{
 assert.equal(MOTION_LABELS.length,23);
 assert.deepEqual(MOVEMENTS,MOTION_LABELS.map(([id])=>id));
 for(const [id] of MOTION_LABELS){
  const bones=movementAngles(id,12.25,10,.75);
  assert.ok(Object.keys(bones).length>0,id);
  for(const [name,angles] of Object.entries(bones)){
   assert.ok(POSE_BONES.some(([bone])=>bone===name),id+':'+name);
   assert.equal(angles.length,3);
   for(const angle of angles)assert.ok(Number.isFinite(angle) && Math.abs(angle)<Math.PI,id+':'+name);
  }
  const shots=normalizeShots([{start:0,movement:id}],20);
  assert.equal(shots[0].movement,id);
  assert.equal(projectJSON(shots,20).shots[0].movement,id);
  for(const angles of Object.values(movementAngles(id,2,0,0)))assert.ok(angles.every(value=>Math.abs(value)<1e-12),id);
 }
});
test('motion state at the same time is deterministic and malformed inputs do not introduce NaN',()=>{
 for(const [id] of MOTION_LABELS){
  assert.deepEqual(movementAngles(id,1.2,.4,.65),movementAngles(id,1.2,.4,.65));
  for(const values of Object.values(movementAngles(id,NaN,Infinity,Infinity)))
   assert.ok(values.every(Number.isFinite),id);
 }
});
test('all pose presets are valid and distinct from the neutral baseline',()=>{
 const names=new Set(POSE_PRESETS.map(([id])=>id));
 assert.ok(names.size>=15);
 for(const id of ['handsOnHips','armsCrossed','prayer','shy','proud','idolPose','crouchReady','pointLeft'])
  assert.ok(Object.keys(presetPose(id)).length>0,id);
 for(const [id] of POSE_PRESETS)
  for(const [bone,rotation] of Object.entries(presetPose(id))){
   assert.ok(POSE_BONES.some(([key])=>key===bone),id+':'+bone);
   assert.ok(rotation.every(v=>Number.isFinite(v)&&Math.abs(v)<=130));
  }
});
test('motion and pose pickers render across the two editing contexts',()=>{
 const html=read('index.html'),app=read('app.mjs');
 assert.match(html,/id="pose-movement"/);
 assert.match(app,/\$\('pose-movement'\)\.value=shot\.movement/);
 assert.match(app,/movementAngles\(shot\.movement,time,shot\.start,amount\)/);
 assert.match(app,/Object\.entries\(RELAXED_BASE_POSE\)/);
 for(const [id] of MOTION_LABELS){
  assert.ok(html.includes('value="'+id+'"'),id);
 }
});
