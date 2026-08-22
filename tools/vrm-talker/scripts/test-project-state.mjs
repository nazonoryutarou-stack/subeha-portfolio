import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) {
      super(type);
      this.detail = init.detail;
    }
  };
}

const eventTarget = new EventTarget();
globalThis.window = {
  dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
  addEventListener: eventTarget.addEventListener.bind(eventTarget),
  removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
};

const {
  getProject,
  isSourceVerificationPending,
  loadProjectSnapshot,
  setSourceFile,
} = await import('../src/app/project-state.js');

const sourceBytes = new TextEncoder().encode('exact-source-audio-fixture');
const expectedSha = createHash('sha256').update(sourceBytes).digest('hex');
const snapshot = {
  version: 1,
  source: {name: 'original.m4a', sha256: expectedSha, durationMs: 12345},
  clip: {startMs: 1000, endMs: 9000},
  avatar: {speaker: 'HOST', model: 'Subeha.vrm'},
  captions: [{text: '保存字幕', startMs: 1200, endMs: 2200, speaker: 'HOST'}],
  speakerTurns: [{speaker: 'HOST', startMs: 1000, endMs: 3000}],
  visualCues: [],
  visualReferences: [{
    id: 'visual-1', kind: 'generated', startMs: 1500, endMs: 2500,
    url: 'data:image/png;base64,AA==', thumbnailUrl: 'data:image/png;base64,AA==',
  }],
  layout: {width: 720, height: 1280, captionBottomPx: 290, showSafeArea: true, background: null},
};

loadProjectSnapshot(snapshot);
assert.equal(isSourceVerificationPending(), true, 'loaded project must require source verification');
assert.equal(getProject().captions[0].text, '保存字幕');
assert.equal(getProject().visualReferences.length, 1);

const wrong = new Blob([new TextEncoder().encode('wrong-source')], {type: 'audio/mp4'});
Object.defineProperty(wrong, 'name', {value: 'original.m4a'});
await assert.rejects(() => setSourceFile(wrong, 12345), /一致しません/);
assert.equal(isSourceVerificationPending(), true, 'wrong source must keep project locked');
assert.equal(getProject().captions[0].text, '保存字幕', 'wrong source must not destroy captions');
assert.equal(getProject().visualReferences.length, 1, 'wrong source must not destroy visuals');

const correct = new Blob([sourceBytes], {type: 'audio/mp4'});
Object.defineProperty(correct, 'name', {value: 'renamed-source.m4a'});
await setSourceFile(correct, 12345);
assert.equal(isSourceVerificationPending(), false, 'matching source must unlock project');
assert.equal(getProject().source.sha256, expectedSha);
assert.equal(getProject().source.name, 'renamed-source.m4a', 'same bytes may be safely rebound under a different filename');
assert.equal(getProject().captions[0].text, '保存字幕', 'matching source must preserve captions');
assert.equal(getProject().visualReferences.length, 1, 'matching source must preserve visuals');
assert.equal(getProject().avatar.speaker, 'HOST', 'matching source must preserve avatar speaker');

console.log('Project reopen/source verification tests passed');
