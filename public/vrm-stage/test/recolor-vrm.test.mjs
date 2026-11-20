import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceGLB,recolorVRM} from '../recolor-vrm.mjs';

function makeGLB(){
 const doc={asset:{version:'2.0'},extensionsUsed:['VRMC_vrm'],
  extensions:{VRMC_vrm:{specVersion:'1.0',meta:{name:'Subeha test',authors:['Creator']}}},
  materials:[{pbrMetallicRoughness:{baseColorFactor:[.5,.5,.5,.75]}}]};
 const text=new TextEncoder().encode(JSON.stringify(doc)),len=(text.length+3)&~3;
 const size=12+8+len+8+4,bytes=new Uint8Array(size),v=new DataView(bytes.buffer);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,size,true);
 v.setUint32(12,len,true);v.setUint32(16,0x4e4f534a,true);
 bytes.fill(32,20,20+len);bytes.set(text,20);
 v.setUint32(20+len,4,true);v.setUint32(24+len,0x004e4942,true);
 bytes.set([2,4,6,8],28+len);
 return bytes.buffer;
}
test('recolored VRM retains original binary and extension metadata',()=>{
 const original=makeGLB(),before=parseSourceGLB(original);
 const patched=recolorVRM(original,{'0':'#ff0000'}),after=parseSourceGLB(patched.bytes);
 assert.equal(patched.changed,1);
 assert.deepEqual(after.doc.extensions,before.doc.extensions);
 assert.deepEqual(after.doc.extensionsUsed,before.doc.extensionsUsed);
 const m=after.doc.materials[0].pbrMetallicRoughness.baseColorFactor;
 assert.equal(m[0],1);assert.equal(m[1],0);assert.equal(m[2],0);assert.equal(m[3],.75);
 assert.deepEqual([...after.chunks.find(c=>c.type===0x004e4942).bytes],[2,4,6,8]);
 assert.equal(patched.bytes.byteLength%4,0);
 assert.deepEqual(parseSourceGLB(original).doc.materials[0],before.doc.materials[0]);
});
test('invalid material index, colors and no-op export are rejected',()=>{
 assert.throws(()=>recolorVRM(makeGLB(),{}),/ありません/);
 assert.throws(()=>recolorVRM(makeGLB(),{'7':'#112233'}),/存在しない/);
 assert.throws(()=>recolorVRM(makeGLB(),{'0':'<unsafe>'}),/不正/);
});
