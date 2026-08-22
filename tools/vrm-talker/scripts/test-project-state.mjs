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
  addVisualReference,
  getProject,
  isSourceVerificationPending,
  loadProjectSnapshot,
  removeVisualReference,
  setSourceFile,
} = await import('../src/app/project-state.js');

const sourceBytes = new TextEncoder().encode('exact-source-audio-fixture');
const expectedSha = createHash('sha256').update(sourceBytes).digest('hex');
const snapshot = {
  version: 1,
  source: {name: 'original.m4a', sha256: expectedSha, durationMs: 12345},
  clip: {startMs: 1000, endMs: 9000},
  avatar: {speaker: 'HOST', model: 'Subeha.vrm'},
  text: {title: '保存タイトル', telop: ''},
  captions: [{text: '保存字幕', startMs: 1200, endMs: 2200, speaker: 'HOST'}],
  speakerTurns: [{speaker: 'HOST', startMs: 1000, endMs: 3000}],
  visualCues: [],
  visualReferences: [{
    id: 'visual-1', kind: 'generated', startMs: 1500, endMs: 2500,
    url: 'data:image/png;base64,AA==', thumbnailUrl: 'data:image/png;base64,AA==',
  }],
  layout: {width: 720, height: 1280, captionBottomPx: 290, showSafeArea: true, background: null},
};

const invalid = (patch) => structuredClone({...snapshot, ...patch});
assert.throws(
  () => loadProjectSnapshot(invalid({clip: {startMs: 1000, endMs: 13000}})),
  /元音声長/,
  'clip outside source duration must be rejected',
);
assert.throws(
  () => loadProjectSnapshot(invalid({layout: {...snapshot.layout, width: 800, height: 800}})),
  /未対応の出力サイズ/,
  'unsupported render layout must be rejected',
);
assert.throws(
  () => loadProjectSnapshot(invalid({avatar: {...snapshot.avatar, speaker: 'MISSING'}})),
  /speakerTurnsに存在しません/,
  'avatar speaker must exist in speaker turns',
);
assert.throws(
  () => loadProjectSnapshot(invalid({captions: [{text: 'bad', startMs: 12000, endMs: 13000, speaker: 'HOST'}]})),
  /元音声長/,
  'caption outside source duration must be rejected',
);
assert.throws(
  () => loadProjectSnapshot(invalid({visualReferences: [{id: 'bad', startMs: 1000, endMs: 2000}]})),
  /画像データまたはURL/,
  'visual without image source must be rejected',
);

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
assert.equal(getProject().text.title, '保存タイトル', 'matching source must preserve editor text');

const sharedAsset = {
  id: 'openverse-asset-123',
  kind: 'search',
  provider: 'openverse',
  url: 'data:image/png;base64,AA==',
  thumbnailUrl: 'data:image/png;base64,AA==',
  creator: 'fixture creator',
  license: 'cc0',
};
const firstPlacement = addVisualReference({...sharedAsset, startMs: 3000, endMs: 4000});
const secondPlacement = addVisualReference({...sharedAsset, startMs: 5000, endMs: 6000});
assert.notEqual(firstPlacement.id, secondPlacement.id, 'same asset must receive unique timeline placement IDs');
assert.equal(firstPlacement.assetId, 'openverse-asset-123');
assert.equal(secondPlacement.assetId, 'openverse-asset-123');
assert.equal(getProject().visualReferences.length, 3);
assert.equal(removeVisualReference(firstPlacement.id), true);
assert.equal(getProject().visualReferences.some((item) => item.id === secondPlacement.id), true, 'removing one placement must preserve another placement of the same asset');

console.log('Project validation/reopen/source verification/visual placement tests passed');
