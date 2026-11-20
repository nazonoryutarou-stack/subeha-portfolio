import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {POSE_BONES, POSE_PRESETS, normalizePose, presetPose, normalizeShots, splitShot, projectJSON} from '../shots.mjs';

const read=relative=>readFileSync(fileURLToPath(new URL('../'+relative,import.meta.url)),'utf8');
test('20 standard VRM bones can be individually controlled',()=>{
 assert.equal(POSE_BONES.length,20);
 assert.ok(POSE_BONES.some(([name])=>name==='head'));
 assert.ok(POSE_BONES.some(([name])=>name==='leftUpperLeg'));
 assert.ok(POSE_BONES.some(([name])=>name==='rightHand'));
});
test('preset poses only set known joint names',()=>{
 const keys=new Set(POSE_BONES.map(row=>row[0]));
 for(const [id] of POSE_PRESETS){
  const pose=presetPose(id);
  for(const key of Object.keys(pose))assert.ok(keys.has(key),'Unexpected bone: '+key);
 }
 assert.deepEqual(presetPose('neutral'),{});
 assert.ok(presetPose('armsOpen').leftUpperArm);
});
test('unsafe or invalid pose angles are ignored or clamped',()=>{
 const result=normalizePose({head:[999,-999,12.12],unknown:[0,0,50],spine:['x',0,0]});
 assert.deepEqual(result.head,[130,-130,12.1]);
 assert.equal('unknown' in result,false);
 assert.equal(Math.abs(result.spine?.[0]??0)<=130,true);
});
test('new shots keep independent pose data and zoom',()=>{
 let shots=normalizeShots([{start:0,pose:{head:[15,0,0]},zoom:1.3}],20);
 shots=splitShot(shots,10,20);
 shots[1].pose.head=[45,0,0];
 assert.equal(shots[0].pose.head[0],15);
 assert.equal(shots[1].pose.head[0],45);
 assert.equal(shots[0].zoom,1.3);
});
test('legacy stage JSON remains compatible while persisting poses',()=>{
 const shots=normalizeShots([{start:0,movement:'wave',pose:{leftUpperArm:[25,0,0]},zoom:2}],15);
 const doc=projectJSON(shots,15);
 assert.equal(doc.schema,'vrm-stage/v1');
 assert.deepEqual(doc.shots[0].pose.leftUpperArm,[25,0,0]);
 assert.equal(doc.shots[0].zoom,2);
 assert.equal(normalizeShots([{start:0,expression:'neutral'}],15)[0].zoom,1);
});
test('main UI exposes built-in model, edit rig, material color and video tools',()=>{
 const html=read('index.html'),app=read('app.mjs'),css=read('style.css');
 for(const id of ['load-subeha','pose-bone','pose-x','pose-y','pose-z','pose-reset','pose-presets','material-select','material-color','zoom','model-info','export-video'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/new URL\('\.\.\/models\/Subeha\.vrm',import\.meta\.url\)/);
 assert.match(app,/modelName===materialOwner/);
 assert.match(app,/getNormalizedBoneNode/);
 assert.match(app,/setMaterialColor/);
 assert.match(app,/playingSilent=true/);
 assert.match(css,/\.pose-panel/);
});
