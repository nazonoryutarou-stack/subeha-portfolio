import assert from 'node:assert/strict';
import {ENGINE_ROUTE,exportPlan} from '../integrations/engine-plan.mjs';
assert.equal(ENGINE_ROUTE['obj-webgl'],'subeha-web');
const plan=exportPlan({clips:[{assetId:'video1',start:1,end:5,speed:2}],cgScenes:[{modelAssetId:'obj1'}],audioTracks:[{assetId:'audio1'}]});
assert.equal(plan.segments[0].mediaStart,1);assert.equal(plan.segments[0].speed,2);assert.deepEqual(plan.modelAssets,['obj1']);assert.equal(plan.backend,'media3-proposed-not-connected');
assert.ok(plan.warnings.some(x=>x.includes('CG')));
