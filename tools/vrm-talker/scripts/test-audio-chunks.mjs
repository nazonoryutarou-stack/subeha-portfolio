import assert from 'node:assert/strict';
import {buildTranscriptionChunkPlan} from '../src/audio-chunker.js';

const short = buildTranscriptionChunkPlan(120);
assert.equal(short.chunks.length, 1);
assert.deepEqual(
  short.chunks.map(({startSeconds, endSeconds, coreStartSeconds, coreEndSeconds}) => ({startSeconds, endSeconds, coreStartSeconds, coreEndSeconds})),
  [{startSeconds: 0, endSeconds: 120, coreStartSeconds: 0, coreEndSeconds: 120}],
);

const long = buildTranscriptionChunkPlan(1000, {chunkSeconds: 480, overlapSeconds: 2});
assert.equal(long.chunks.length, 3);
assert.equal(long.overlapSeconds, 2);
assert.deepEqual(
  long.chunks.map(({startSeconds, endSeconds, coreStartSeconds, coreEndSeconds}) => ({startSeconds, endSeconds, coreStartSeconds, coreEndSeconds})),
  [
    {startSeconds: 0, endSeconds: 482, coreStartSeconds: 0, coreEndSeconds: 480},
    {startSeconds: 478, endSeconds: 962, coreStartSeconds: 480, coreEndSeconds: 960},
    {startSeconds: 958, endSeconds: 1000, coreStartSeconds: 960, coreEndSeconds: 1000},
  ],
);

for (let index = 1; index < long.chunks.length; index++) {
  const previous = long.chunks[index - 1];
  const current = long.chunks[index];
  assert.equal(previous.coreEndMs, current.coreStartMs, 'core ownership windows must be continuous');
  assert.ok(previous.endMs > current.startMs, 'raw ASR chunks must overlap at boundaries');
}

console.log('Long-audio overlap chunk planning tests passed');
