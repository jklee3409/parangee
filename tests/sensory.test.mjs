import test from 'node:test';
import assert from 'node:assert/strict';
import { SensoryFeedback } from '../dist/sensory-feedback.js';
globalThis.document = { hidden: false };
test('native Capacitor adapter works without importing the Capacitor web bundle', async () => {
  const calls=[];
  globalThis.window={Capacitor:{isNativePlatform:()=>true,Plugins:{SquishyHaptics:{play:async value=>calls.push(value),stop:async()=>calls.push('stop')}}}};
  const feedback=new SensoryFeedback();
  assert.equal(feedback.supported,true);feedback.pulse('land',.7);feedback.stop();
  assert.deepEqual(calls,[{type:'land',strength:.7},'stop']);
});
test('muted and background feedback do not vibrate', () => {
  let calls=0;
  globalThis.window={Capacitor:{isNativePlatform:()=>true,Plugins:{SquishyHaptics:{play:async()=>calls++}}}};
  const feedback=new SensoryFeedback();feedback.haptics=false;feedback.pulse('press');
  feedback.haptics=true;document.hidden=true;feedback.pulse('land');document.hidden=false;
  assert.equal(calls,0);
});
test('stretch events are rate limited', () => {
  let calls=0;
  globalThis.window={Capacitor:{isNativePlatform:()=>true,Plugins:{SquishyHaptics:{play:async()=>calls++}}}};
  const feedback=new SensoryFeedback();
  for(let i=0;i<20;i++)feedback.pulse('stretch',.8);
  assert.equal(calls,1);
});
