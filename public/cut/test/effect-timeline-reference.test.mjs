import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {effectEntriesAtSpans} from '../fx-timeline-core.mjs';

const file=name=>readFileSync(fileURLToPath(new URL('../'+name,import.meta.url)),'utf8');

test('purple effect track begins at effect IN and ends at current clip boundary',()=>{
 const spans=[{clip:{id:'a',fxStack:[{id:'fx1',type:'shake',amount:.7,start:1.25}]},start:3.5,length:6.5}];
 assert.deepEqual(effectEntriesAtSpans(spans),[{id:'fx1',clipId:'a',kind:'effect',type:'shake',start:4.75,end:10,row:0,visible:true}]);
});

test('FX spans use real composition starts, including speed ramps and transitions',()=>{
 const spans=[
  {clip:{id:'a',fxStack:[{id:'x',type:'rgb',start:0,end:2},{id:'y',type:'scan',start:3,end:5,disabled:true}]},start:0,length:5},
  {clip:{id:'b',fxStack:[{id:'z',type:'mosaic',start:1,end:2}]},start:4.25,length:3.5}
 ];
 const out=effectEntriesAtSpans(spans);
 assert.deepEqual(out.map(x=>[x.id,x.start,x.end,x.row]),[['x',0,2,0],['y',3,5,1],['z',5.25,6.25,0]]);
 assert.equal(out[1].visible,false);
});

test('effect ranges are clamped to the clip; out-of-range effects are omitted',()=>{
 const spans=[{clip:{id:'a',fxStack:[{id:'neg',type:'prism',start:-2,end:1},{id:'late',type:'rgb',start:999,end:1000}]},start:2,length:2}];
 const entries=effectEntriesAtSpans(spans);
 assert.equal(entries.length,1);
 assert.equal(entries[0].start,2);
 assert.equal(entries[0].end,3);
});

test('effect UI stays in compact horizontal bottom rail until a timeline effect is tapped',()=>{
 const shell=file('editor-shell.mjs'),touch=file('touch-workspace.mjs'),fx=file('fx-lab.mjs');
 const css=file('fx-lab.css'),theme=file('reference-ui.css'),sw=file('sw.js');
 assert.match(shell,/videoLane\.before\(overlayLane,effectLane\)/);
 assert.match(touch,/effectEntriesAtSpans\(spans\(state\.project\.clips\)\)/);
 assert.match(touch,/window\.__subehaFXFocus\?\.\(fx\.clipId,fx\.id\)/);
 assert.match(fx,/__subehaFXFocus=/);
 assert.match(fx,/added\.start=Math\.max\(0,currentTime\(c\)\)/);
 assert.match(fx,/cut-fx-rail-back/);
 assert.match(css,/data-detail="false"/);
 assert.match(css,/bottomnav\{visibility:hidden\}/);
 assert.match(theme,/cut-effect-lane/);
 assert.match(sw,/subeha-cut-app-v31/);
 assert.match(sw,/fx-timeline-core\.mjs/);
});
