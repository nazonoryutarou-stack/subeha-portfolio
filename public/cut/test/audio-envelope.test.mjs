import test from 'node:test';import assert from 'node:assert/strict';
import {decodeWavEnvelope,envelopeAt} from '../audio-envelope.mjs';
function pcmWav(){const rate=16000,frames=rate;const bytes=new ArrayBuffer(44+frames*2),d=new DataView(bytes);const ascii=(i,s)=>{for(let k=0;k<s.length;k++)d.setUint8(i+k,s.charCodeAt(k));};ascii(0,'RIFF');d.setUint32(4,36+frames*2,true);ascii(8,'WAVE');ascii(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,rate,true);d.setUint32(28,rate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);ascii(36,'data');d.setUint32(40,frames*2,true);for(let i=0;i<frames;i++)d.setInt16(44+i*2,i<rate/2?0:Math.round(18000*Math.sin(i*2*Math.PI*300/rate)),true);return bytes;}
test('mouth envelope follows actual WAV amplitude and silence',()=>{
 const env=decodeWavEnvelope(pcmWav());assert.equal(env.duration,1);assert.ok(envelopeAt(env,.15)<.05);assert.ok(envelopeAt(env,.75)>.4);assert.equal(envelopeAt(env,1.2),0);assert.equal(envelopeAt(env,-.1),0);
});
test('truncated/broken audio fails safely',()=>{assert.throws(()=>decodeWavEnvelope(new ArrayBuffer(20)),/WAV/);const b=pcmWav();new DataView(b).setUint32(40,1e8,true);assert.throws(()=>decodeWavEnvelope(b),/壊れています/);});
