import assert from 'node:assert/strict';
import {EFFECT_NAMES,applyEffect} from '../effects.mjs';
const context={save(){this.saved=(this.saved||0)+1;},restore(){this.saved--;},createRadialGradient(){return {addColorStop(){}}},fillRect(){this.filled=(this.filled||0)+1;}};
const canvas={width:720,height:1280};
applyEffect(context,canvas,'vignette',.4,1);
applyEffect(context,canvas,'lightleak',.4,1);
assert.equal(context.saved,0);
assert.equal(context.filled,2);
assert.ok(EFFECT_NAMES.includes('prism'));
applyEffect(context,canvas,'none',.5);
assert.equal(context.saved,0);
console.log('effect gradient drawing: PASS');

// Videoleap 1.40.1 reference screen effects (independent implementations).
for(const name of ['shake','prism','offset','oldfilm','mosaic','focusblur','rgb','pattern','scan','kaleido']) assert.ok(EFFECT_NAMES.includes(name), name+' is available');
console.log('device-audit effect categories: PASS');
