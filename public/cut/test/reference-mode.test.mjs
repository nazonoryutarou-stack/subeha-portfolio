import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const load=(path)=>readFileSync(fileURLToPath(new URL('../'+path,import.meta.url)),'utf8');
const shell=load('editor-shell.mjs');
const html=load('index.html');
const css=load('reference-ui.css');
const fx=load('fx-lab.mjs');
const sw=load('sw.js');
const pro=load('pro.mjs');
const touch=load('touch-workspace.mjs');

test('audited main editing categories are visible and ordered as in Android screenshot',()=>{
 const main=shell.slice(shell.indexOf(' const general=['),shell.indexOf(' function openMagicEdit()'));
 const labels=['マジック編集','オーバーレイ','テキスト','オーディオ','フィルタ','調整','エフェクト'];
 let last=-1;
 for(const label of labels){const i=main.indexOf("make('"+label+"'");assert.ok(i>last,label);last=i;}
 for(const label of ['キャンバス','字幕','すべて'])assert.ok(main.includes("make('"+label+"'"),label);
});
test('project-specific original studios no longer mount or appear in ordinary tools',()=>{
 for(const symbol of ['mountCGStudio','mountEngineHub','mountRetouchStudio','mountVideoRetouchStudio'])assert.doesNotMatch(pro,new RegExp(symbol));
 for(const label of ['先進機能ラボ','統合エンジン','3D映像','声を作る'])assert.doesNotMatch(shell,new RegExp("make\\('"+label));
 assert.doesNotMatch(html,/voice-studio\.mjs|japanese-ui\.mjs|PERSONAL VIDEO LAB|白紙から、異常な映像を/);
 assert.doesNotMatch(touch,/state\.project\.cgScenes/);
});
test('reference rails display user-observed FX names and core gesture entry points',()=>{
 for(const name of ['シェイク','プリズム','オフセット','古い映画','モザイク','焦点ぼけ','RGB','パターン','スキャン','カレイド'])assert.ok(fx.includes("'"+name+"'"),name);
 assert.match(fx,/cut-fx-carousel/);
 assert.doesNotMatch(fx,/data-page="looks"|data-page="optics"/);
 assert.match(css,/cut-timeline-scroll/);
 assert.match(css,/display:flex!important/);
 assert.match(touch,/cut-layer-stack-open/);
});
test('new offline install has a neutral icon and does not pre-cache bespoke original studios',()=>{
 const manifest=JSON.parse(load('manifest.webmanifest'));
 assert.equal(manifest.name,'動画編集');
 assert.equal(manifest.icons[0].src,'./icons/editor.svg');
 assert.match(sw,/subeha-cut-app-v30/);
 assert.match(sw,/icons\/editor\.svg/);
 for(const file of ['cg-studio.mjs','engine-hub-ui.mjs','voice-studio.mjs','japanese-ui.mjs'])assert.doesNotMatch(sw,new RegExp("'\\./"+file.replace('.','\\.')+"'"));
 assert.match(html,/編集/);
});
