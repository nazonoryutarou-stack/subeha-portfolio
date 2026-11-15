import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {PBR_TITLE_PRESETS,PBR_TITLE_KEYFRAME_FIELDS,normalizedPbrTitle,applyPbrPreset,pbrHexRgb} from '../pbr-title-core.mjs';
import {drawPbrTitle,canUsePbrTitle} from '../pbr-title-render.mjs';
import {titleAt,upsertTitleKeyframe} from '../text-motion-core.mjs';
import {drawAnimatedTitle} from '../text-motion-render.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function ctxMock(){
 let painted=0;
 const ctx={
  save(){},restore(){},translate(){},rotate(){},scale(){},
  beginPath(){},fill(){},rect(){},roundRect(){},fillRect(){},
  strokeText(){},fillText(){painted++;},
  measureText(s){return {width:Array.from(String(s)).length*13}}
 };
 return {ctx,painted:()=>painted,canvas:{width:720,height:1280}};
}
test('eight original material presets keep text, timing and transform independent',()=>{
 assert.equal(Object.keys(PBR_TITLE_PRESETS).length,8);
 const original={id:'t1',text:'日本語を立体に',start:2.4,duration:3,rotation:12};
 const styled=applyPbrPreset(original,'gold');
 assert.equal(styled.text,original.text);
 assert.equal(styled.start,original.start);
 assert.equal(styled.rotation,original.rotation);
 assert.equal(styled.pbrEnabled,true);
 assert.equal(styled.pbrColor,'#ffcb55');
 assert.equal(original.pbrEnabled,undefined);
});
test('malformed numeric and color settings have bounded safe defaults',()=>{
 const m=normalizedPbrTitle({pbrEnabled:true,pbrStyle:'not-a-style',pbrRoughness:-1,pbrMetallic:99,pbrDepth:999,pbrLight1Angle:999,pbrColor:'url(javascript:bad)'});
 assert.equal(m.style,'chrome');assert.equal(m.roughness,.04);
 assert.equal(m.metallic,1);assert.equal(m.depth,36);
 assert.equal(m.light1.angle,360);assert.equal(m.color,PBR_TITLE_PRESETS.chrome.color);
 assert.deepEqual(pbrHexRgb('#000000'),[0,0,0]);
});
test('light and material traits interpolate without disturbing old projects',()=>{
 assert.ok(PBR_TITLE_KEYFRAME_FIELDS.includes('pbrLight1Intensity'));
 const base={x:.5,pbrMetallic:0,pbrRoughness:.2};
 const k0=upsertTitleKeyframe(base,0);
 const animated={...base,titleKeyframes:k0};
 const k1=upsertTitleKeyframe(animated,2,{pbrMetallic:1,pbrRoughness:.8});
 const midpoint=titleAt({...animated,titleKeyframes:k1},1);
 assert.equal(midpoint.pbrMetallic,.5);
 assert.equal(midpoint.pbrRoughness,.5);
 assert.equal(midpoint.x,.5);
});
test('WebGL unavailable in Node returns safe Canvas2D fallback',()=>{
 assert.equal(canUsePbrTitle(),false);
 const testCanvas=ctxMock();
 const box=drawPbrTitle(testCanvas.ctx,testCanvas.canvas,{text:'立体文字',size:62,x:.5,y:.5,pbrEnabled:true},0);
 assert.ok(box);assert.ok(testCanvas.painted()>0);
});
test('legacy 2D and new PBR title both use same export draw entrypoint',()=>{
 const regular=ctxMock(),lit=ctxMock();
 const common={text:'字幕 日本語',size:60,start:0,duration:3};
 drawAnimatedTitle(regular.ctx,regular.canvas,common,1);
 drawAnimatedTitle(lit.ctx,lit.canvas,{...common,pbrEnabled:true,pbrStyle:'chrome'},1);
 assert.ok(regular.painted()>0);assert.ok(lit.painted()>0);
});
test('GPU is isolated from export canvas and has explicit blend/context fallback',()=>{
 const shader=readFileSync(resolve(root,'pbr-title-render.mjs'),'utf8');
 const app=readFileSync(resolve(root,'app.mjs'),'utf8');
 const touch=readFileSync(resolve(root,'direct-canvas.mjs'),'utf8');
 const sw=readFileSync(resolve(root,'sw.js'),'utf8');
 assert.match(shader,/preserveDrawingBuffer:true/);
 assert.match(shader,/drawTitle\(ctx,canvas,item\)/);
 assert.match(shader,/gl\.drawArrays/);
 assert.match(shader,/uMetallic/);
 assert.match(shader,/uRoughness/);
 assert.match(shader,/uLight1/);
 assert.match(shader,/uLight2/);
 assert.match(app,/drawAnimatedTitle\(ctx,canvas,t,state\.current-t\.start\)/);
 assert.match(touch,/cut-pbr-lightpad/);
 assert.match(sw,/pbr-title-render\.mjs/);
});
