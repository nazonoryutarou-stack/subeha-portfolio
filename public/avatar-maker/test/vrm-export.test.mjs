import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// The container conversion functions are pure JS; evaluating just that portion
// keeps these tests runnable without a GPU or the three npm dependency.
const source=readFileSync(new URL('../export-vrm.mjs',import.meta.url),'utf8')
 .replace(/^import .*\n/gm,'').replace(/^export /gm,'');
const helpers=new Function('TextEncoder','TextDecoder','GLTFExporter',source+
 '\nreturn {decodeGLB,encodeGLB,addVRMExtension,verifyVRM};')(TextEncoder,TextDecoder,class GLTFExporterStub{});
const names=['hips','spine','head','leftUpperLeg','leftLowerLeg','leftFoot',
 'rightUpperLeg','rightLowerLeg','rightFoot','leftUpperArm','leftLowerArm','leftHand',
 'rightUpperArm','rightLowerArm','rightHand'];
function fixture(){
 const nodes=names.map(name=>({name:'Human_'+name}));
 const targetCount=[3,3,10];
 for(const [index,name] of ['Eyes_Left','Eyes_Right','Mouth'].entries())nodes.push({name,mesh:index});
 const meshes=targetCount.map(count=>({primitives:[{targets:Array.from({length:count},()=>({POSITION:0}))}]}));
 return helpers.encodeGLB({asset:{version:'2.0'},nodes,meshes,skins:[{joints:[0]}]},new Uint8Array([1,2,3,4,5]));
}
test('GLB chunk encoding uses four-byte alignment and roundtrips JSON and bytes',()=>{
 const bytes=fixture(),read=helpers.decodeGLB(bytes);
 assert.equal(bytes.byteLength%4,0);
 assert.equal(read.json.nodes[0].name,'Human_hips');
 assert.equal(read.bin[0],1);assert.equal(read.bin[4],5);
});

test('VRM1 extension has required humanoid node mappings and mouth/blink expressions',()=>{
 const bytes=helpers.addVRMExtension(fixture(),{name:'3D Character',author:'User'});
 const info=helpers.verifyVRM(bytes);
 assert.equal(info.meta.name,'3D Character');
 assert.deepEqual(info.expressions.filter(x=>['aa','ee','ih','oh','ou'].includes(x)).length,5);
 assert.ok(info.expressions.includes('blink'));
 const vrm=helpers.decodeGLB(bytes).json.extensions.VRMC_vrm;
 assert.equal(vrm.humanoid.humanBones.head.node,2);
 assert.equal(vrm.expressions.preset.aa.morphTargetBinds[0].index,0);
});

test('VRM export user permissions persist without accidentally widening rights',()=>{
 const bytes=helpers.addVRMExtension(fixture(),{name:'Self',author:'Me',religious:true,commercial:true});
 const meta=helpers.verifyVRM(bytes).meta;
 assert.equal(meta.avatarPermission,'onlyAuthor');
 assert.equal(meta.commercialUsage,'corporation');
 assert.equal(meta.allowPoliticalOrReligiousUsage,true);
 assert.equal(meta.allowRedistribution,false);
});
test('malformed VRM without required bone is rejected',()=>{
 const doc=helpers.decodeGLB(fixture()),id=doc.json.nodes.findIndex(n=>n.name==='Human_head');
 doc.json.nodes.splice(id,1);
 assert.throws(()=>helpers.addVRMExtension(helpers.encodeGLB(doc.json,doc.bin)),/head/);
});
