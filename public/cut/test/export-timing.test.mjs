import assert from 'node:assert/strict';
import {advanceTimeline} from '../export-timing.mjs';
const p={current:1,lastTimestamp:1000,timestamp:2000,anchor:500,recording:true,duration:5};
assert.equal(advanceTimeline(p),1.5);
assert.equal(advanceTimeline({...p,timestamp:6200}),5);
assert.equal(advanceTimeline({...p,recording:false,timestamp:2000}),1.12);
assert.equal(advanceTimeline({...p,timestamp:250}),0);
console.log('export wall-clock tests PASS');
