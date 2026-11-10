import test from 'node:test';import assert from 'node:assert/strict';import {tickLabel} from '../touch-workspace.mjs';
test('30fps ruler labels half seconds as 15f',()=>{assert.equal(tickLabel(0),'00:00');assert.equal(tickLabel(.5),'15f');assert.equal(tickLabel(1),'00:01');assert.equal(tickLabel(1.5),'15f');});
