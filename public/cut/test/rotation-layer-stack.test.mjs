import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {limitAngle,snapRotation,stepRotation,shortestAngularDelta} from '../direct-geometry.mjs';
import {layerStackEntries,layerSummary,moveOverlayOrder} from '../layer-stack-core.mjs';
import {titleAt,upsertTitleKeyframe} from '../text-motion-core.mjs';

const folder=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const radians=n=>n*Math.PI/180;
const nearly=(a,b,e=.000001)=>assert.ok(Math.abs(a-b)<e,String(a)+' != '+String(b));

test('rotation crosses the atan2 wrap without a visible jump',()=>{
 const radiansPerStep=shortestAngularDelta(radians(179),radians(-179));
 nearly(radiansPerStep,radians(2));
 nearly(shortestAngularDelta(radians(-179),radians(179)),radians(-2));
 const gesture={props:{rotation:150},lastAngle:radians(179),travel:0};
 nearly(stepRotation(gesture,radians(-179)),152);
 nearly(stepRotation(gesture,radians(-161)),170);
 nearly(stepRotation(gesture,radians(-151)), -180);
});
test('recovery control snaps to horizontal and right angles',()=>{
 assert.equal(snapRotation(3),0);
 assert.equal(snapRotation(-3),0);
 assert.equal(snapRotation(88),90);
 assert.equal(snapRotation(-92),-90);
 assert.equal(snapRotation(179),-180);
 assert.equal(snapRotation(43),43);
 assert.equal(limitAngle(360),0);
});
test('a title with existing animation can be straightened at current time',()=>{
 const title={text:'回転の修正',rotation:65,duration:4,titleKeyframes:[
  {time:0,rotation:0},{time:2,rotation:65},{time:4,rotation:-15}
 ]};
 nearly(titleAt(title,2).rotation,65);
 const keys=upsertTitleKeyframe(title,2,{rotation:0});
 const edited={...title,titleKeyframes:keys};
 nearly(titleAt(edited,2).rotation,0);
 assert.equal(title.rotation,65);
});
test('complete inventory lists all layers, including inactive and hidden',()=>{
 const project={
  overlays:[{id:'A',assetId:'a',start:0,duration:3},{id:'B',assetId:'b',start:1,duration:2,visible:false}],
  cgScenes:[{id:'G',name:'夢',start:9,duration:1}],
  texts:[{id:'T',text:'文字',start:0,duration:3}],
  captions:[{id:'C',text:'字幕',start:1,end:2}],
  audioTracks:[{id:'S',assetId:'s',start:0,duration:8}]
 };
 const assets=new Map([['a',{name:'ひとつめ'}],['b',{name:'ふたつめ'}],['s',{name:'音声.wav'}]]);
 const inventory=layerSummary(project,assets,1.5);
 assert.equal(inventory.total,6);assert.equal(inventory.overlays,2);
 assert.equal(inventory.active,4);
 assert.equal(inventory.entries[0].id,'B');
 assert.equal(inventory.entries[0].visible,false);
 assert.equal(inventory.entries[1].id,'A');
 assert.equal(inventory.entries[1].name,'ひとつめ');
 assert.deepEqual(new Set(inventory.entries.map(e=>e.kind)),new Set(['layer','cg','text','caption','audio']));
 assert.equal(layerStackEntries(project,assets,10).length,6);
});
test('overlay arrows match back-to-front compositor order',()=>{
 const original=[{id:'bottom'},{id:'mid'},{id:'top'}];
 const moved=moveOverlayOrder(original,'mid',1);
 assert.deepEqual(moved.map(i=>i.id),['bottom','top','mid']);
 assert.deepEqual(original.map(i=>i.id),['bottom','mid','top']);
 assert.deepEqual(moveOverlayOrder(original,'top',1),original);
 assert.deepEqual(moveOverlayOrder(original,'bottom',-1),original);
});
test('full inventory and persistent hide/show are wired to the live editor and export',()=>{
 const direct=readFileSync(resolve(folder,'direct-canvas.mjs'),'utf8');
 const touch=readFileSync(resolve(folder,'touch-workspace.mjs'),'utf8');
 const pro=readFileSync(resolve(folder,'pro.mjs'),'utf8');
 const shell=readFileSync(resolve(folder,'editor-shell.mjs'),'utf8');
 const css=readFileSync(resolve(folder,'editor-shell.css'),'utf8');
 const sw=readFileSync(resolve(folder,'sw.js'),'utf8');
 assert.match(direct,/stepRotation\(g,/);
 assert.match(direct,/upsertTitleKeyframe\(t,local,\{rotation:0\}\)/);
 assert.match(direct,/data-do="straighten"/);
 assert.match(touch,/cut-layer-drawer/);
 assert.match(touch,/rowIndex\*29\+2/);
 assert.match(touch,/moveOverlayOrder/);
 assert.match(pro,/if\(layer\.visible===false\)continue/);
 assert.match(shell,/layerTrigger/);
 assert.match(shell,/make\('レイヤー'/);
 assert.match(css,/\.leap-layout \.cut-timeline-scroll\{overflow-x:auto;overflow-y:auto/);
 assert.match(sw,/layer-stack-core\.mjs/);
});
