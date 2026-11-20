import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestPoseBone, dragPoseAngles} from '../pose-gestures.mjs';

test('touching near a projected joint selects that joint only', () => {
 const joints = [{name:'head',x:100,y:100},{name:'leftHand',x:130,y:100}];
 assert.equal(nearestPoseBone(joints,101,102), 'head');
 assert.equal(nearestPoseBone(joints,135,100,20), 'leftHand');
 assert.equal(nearestPoseBone(joints,250,250), null);
 assert.equal(nearestPoseBone(joints,NaN,0), null);
 assert.equal(nearestPoseBone([{name:'bad',x:NaN,y:0}],0,0), null);
});

test('finger movements map to editable X/Z rotations and preserve Y', () => {
 assert.deepEqual(dragPoseAngles([10,20,30],20,-10),[14.5,20,21]);
 assert.deepEqual(dragPoseAngles([125,4,-125],-100,-100),[130,4,-80]);
 assert.deepEqual(dragPoseAngles(null,0,0),[0,0,0]);
 assert.deepEqual(dragPoseAngles([0,0,0],10000,10000),[-130,0,-130]);
});
