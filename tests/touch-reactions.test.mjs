import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionPose } from '../dist/touch-reactions.js';
import { greetingPose, restingGreeting, deformGreeting } from '../dist/greeting-motion.js';

test('tongue appears only during the smiling hold and returns to exact rest', () => {
  assert.equal(greetingPose(.7).mouth,0);
  assert.equal(greetingPose(2.2).mouth,1);
  assert.equal(greetingPose(2.2,true).mouth,1);
  assert.deepEqual(greetingPose(3.6),restingGreeting());
});

test('new expressions keep the face mesh unfolded and reduce movement in calm mode', () => {
  const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(const type of ['pet','tickle','wake']) for(let t=0;t<2.3;t+=.08) {
    const pose=reactionPose(type,t),calm=reactionPose(type,t,1,true);
    for(const key of ['roll','nod','tail','squash']) assert.ok(Math.abs(calm[key])<=Math.abs(pose[key])*.201);
    for(let y=8;y<32;y++) for(let x=16;x<47;x++) {
      const a=deformGreeting(x/64,y/60,pose),b=deformGreeting((x+1)/64,y/60,pose),c=deformGreeting(x/64,(y+1)/60,pose),d=deformGreeting((x+1)/64,(y+1)/60,pose);
      assert.ok(area(a,b,c)>0&&area(b,d,c)>0,`${type} folds at ${t}`);
    }
  }
});
