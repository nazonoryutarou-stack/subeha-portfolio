import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAvatar,applyPreset,PRESETS,PARAMS,CATEGORY_OPTIONS,fromProject,toProject,randomAvatar} from '../model.mjs';

test('default avatar and all preset choices are valid',()=>{
 const basic=normalizeAvatar();
 for(const preset of PRESETS){
  const x=applyPreset(preset.id);assert.equal(x.format,'avatar-atelier/v1');
  for(const [key,options] of Object.entries(CATEGORY_OPTIONS))
   assert.ok(options.some(row=>row[0]===x[key]),preset.id+':'+key);
 }
 assert.equal(basic.hairStyle,'bob');
});

test('face/body/hair sliders clamp to safe ranges',()=>{
 const x=normalizeAvatar({headSize:999,eyeSize:-2,legLength:0,hairWaves:200});
 assert.equal(x.headSize,PARAMS.headSize.max);
 assert.equal(x.eyeSize,PARAMS.eyeSize.min);
 assert.equal(x.legLength,PARAMS.legLength.min);
 assert.equal(x.hairWaves,PARAMS.hairWaves.max);
});

test('stored project saves and restores a user-designed character',()=>{
 const original=normalizeAvatar({name:'Test',author:'Me',hairStyle:'ponytail',topStyle:'jacket',mouthSmile:.35});
 const json=JSON.parse(JSON.stringify(toProject(original)));
 assert.deepEqual(fromProject(json),original);
});

test('hand-drawn hair survives JSON roundtrip and is bounded',()=>{
 const input={customHair:[[[.1,.1,.25],[.2,-.2,.25]],[[999,999,999],[.25,-.1,.25]]]};
 const x=normalizeAvatar(input);
 assert.equal(x.customHair.length,2);
 assert.deepEqual(x.customHair[0],input.customHair[0]);
 assert.equal(x.customHair[1][0][0],1.5);
 assert.deepEqual(fromProject(toProject(x)).customHair,x.customHair);
 assert.equal(normalizeAvatar({customHair:Array(100).fill([[0,0,.2],[.2,-.2,.2]])}).customHair.length,36);
});

test('random models keep all parameter domains valid',()=>{
 for(const seed of [0,1,5,777,1234567]){
  const x=randomAvatar(seed);
  for(const [key,p] of Object.entries(PARAMS)){
   assert.ok(x[key]>=p.min&&x[key]<=p.max,key+' '+seed);
  }
 }
});

test('all exposed parameters are used to produce visible geometry',()=>{
 const source=readFileSync(new URL('../geometry.mjs',import.meta.url),'utf8');
 for(const key of Object.keys(PARAMS))assert.ok(source.includes('p.'+key),'unused slider: '+key);
 for(const key of ['customHair','Hair_Custom','Human_head','Skin_Torso','Mouth','Eyes_Left','Eyes_Right'])
  assert.ok(source.includes(key),'missing geometry feature '+key);
});
