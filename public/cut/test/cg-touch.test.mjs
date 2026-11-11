import test from 'node:test';import assert from 'node:assert/strict';import {moveCG,transformCG} from '../cg-touch.mjs';
test('3D drag responds to normalized screen movement',()=>{const before={x:0,y:0,scale:1,yaw:0},newScene=moveCG(before,100,-100,300,600);assert.equal(newScene.x,1);assert.equal(newScene.y,1);assert.equal(before.x,0);});
test('3D pinch scales and rotates with hard safety bounds',()=>{const s=transformCG({scale:1,yaw:0},2,Math.PI/2);assert.equal(s.scale,2);assert.equal(s.yaw,90);assert.equal(transformCG(s,1e6,0).scale,5);});
