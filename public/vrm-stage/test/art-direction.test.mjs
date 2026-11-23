import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read = name => readFileSync(fileURLToPath(new URL('../'+name,import.meta.url)),'utf8');

test('all four workspaces share cut selector without losing other controls',()=>{
 const html=read('index.html');
 const css=read('art-direction.css');
 assert.match(html,/class="work-area" data-workspace="pose"/);
 for(const workspace of ['pose','face','scene','material']){
  assert.match(html,new RegExp('data-workspace-button="'+workspace+'" aria-pressed="(?:true|false)"'));
  assert.ok(css.includes('data-workspace="'+workspace+'"'),workspace);
 }
 for(const critical of ['shot-timeline','pose-bone','expression-controls','material-select','export-video']){
  assert.ok(html.includes('id="'+critical+'"'),critical);
 }
 assert.match(css,/Keep cut selection visible in every mode/);
});
test('two skins and responsive preview dock expose real controls',()=>{
 const html=read('index.html'),css=read('art-direction.css'),logic=read('art-direction.mjs');
 assert.match(html,/id="visual-skin"/);
 assert.match(html,/<option value="console">/);
 assert.match(html,/<option value="gallery">/);
 assert.match(logic,/localStorage\.setItem/);
 assert.match(logic,/ResizeObserver/);
 assert.match(css,/body\[data-skin="gallery"\]/);
 assert.match(css,/\.view-area\{position:sticky;top:var\(--apphead-height\)/);
 assert.match(css,/max-height:620px/);
});
test('touch mode indicator follows the actual pose mode',()=>{
 const app=read('app.mjs');
 assert.match(app,/modeLabel\.textContent=poseTouchMode\?'POSE \/ TOUCH':'CAMERA'/);
});
