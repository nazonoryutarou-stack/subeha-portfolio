import assert from 'node:assert/strict';
import {sniffEncodedBytes,inspectEncodedBlob,exportNotice} from '../export-integrity.mjs';
const bin = ascii => new Uint8Array([...ascii].map(x=>x.charCodeAt(0)));
const mp4 = bin('\0\0\0\u001cftypisomxxxxavc1___mp4a');
const vp9 = bin('\0\0\0\u001cftypisomxxxxvp09___Opus');
const webm = new Uint8Array([0x1a,0x45,0xdf,0xa3,...bin('V_VP9 A_OPUS')]);
{
 const info=sniffEncodedBytes(mp4,new Uint8Array(),'video/mp4');
 assert.deepEqual([info.container,info.video,info.audio,info.extension,info.universallyCompatible],['mp4','H.264','AAC','mp4',true]);
}
{
 const info=sniffEncodedBytes(vp9,new Uint8Array(),'video/mp4');
 assert.equal(info.video,'VP9'); assert.equal(info.audio,'Opus'); assert.equal(info.universallyCompatible,false);
 assert.match(exportNotice(info,'mp4'),/VP9/);
}
{
 const info=sniffEncodedBytes(webm,new Uint8Array(),'video/mp4');
 assert.equal(info.container,'webm'); assert.equal(info.mimeMismatch,true); assert.equal(info.extension,'webm');
 assert.match(exportNotice(info,'mp4'),/WebM/);
}
{
 const b=new Blob([bin('\0\0\0\u001cftypisomxxxxmdat'),new Uint8Array(550000),bin('vp09___Opus')],{type:'video/mp4'});
 const info=await inspectEncodedBlob(b,'video/mp4');
 assert.equal(info.video,'VP9'); assert.equal(info.audio,'Opus');
}
console.log('export integrity tests PASS');
