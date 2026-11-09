import assert from 'node:assert/strict';
import {EDIT_TEMPLATES,applyEditTemplate} from '../edit-templates.mjs';
assert.equal(Object.keys(EDIT_TEMPLATES).length,6);
const before={ratio:'9:16',clips:[{id:'a',assetId:'image1',filter:'none',start:0,end:5}],texts:[{id:'keep',text:'ORIGINAL'}],audioTracks:[{id:'audio',assetId:'sound'}]};
const after=applyEditTemplate(before,'noir',{id:'title1',title:'新しい映画',clipId:'a'});
assert.equal(after.ratio,'21:9');assert.equal(after.clips[0].filter,'mono');assert.equal(after.texts.at(-1).text,'新しい映画');assert.equal(after.texts[0].text,'ORIGINAL');assert.equal(after.audioTracks[0].assetId,'sound');
assert.equal(before.clips[0].filter,'none');assert.equal(before.texts.length,1);assert.throws(()=>applyEditTemplate(before,'unknown',{id:'x'}));assert.throws(()=>applyEditTemplate({clips:[]},'vlog',{id:'x'}));
for(const name of Object.keys(EDIT_TEMPLATES))assert.equal(applyEditTemplate(before,name,{id:name}).texts.length,2);
console.log('edit templates tests PASS');
