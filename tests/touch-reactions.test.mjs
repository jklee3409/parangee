import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchGesture, reactionPose } from '../dist/touch-reactions.js';
import { greetingPose, restingGreeting, deformGreeting } from '../dist/greeting-motion.js';

test('tap, single belly pull, fast drag and off-body gestures do not trigger reactions', () => {
  const tap=new TouchGesture([.5,.27],0);
  assert.equal(tap.move([.502,.27],250),null);
  const pull=new TouchGesture([.4,.65],0);
  for(let i=1;i<=8;i++) assert.equal(pull.move([.4+i*.025,.65],i*60),null);
  const fast=new TouchGesture([.4,.27],0);
  assert.equal(fast.move([.65,.27],40),null);
  const outside=new TouchGesture([.75,.6],0);
  for(let i=1;i<=6;i++) assert.equal(outside.move([.75+(i%2)*.02,.6],i*100),null);
});

test('gesture state resets when leaving a region or after a pause', () => {
  const gesture=new TouchGesture([.4,.25],0);
  assert.equal(gesture.move([.46,.25],200),'pet');
  assert.equal(gesture.move([.46,.65],300),null);
  assert.equal(gesture.move([.5,.65],800),null);
  assert.equal(gesture.turns,0);
});

test('tickling recognizes tiny high-frequency deltas but ignores hand jitter', () => {
  const g=new TouchGesture([.45,.65],0);
  let time=0,result;
  for(const [from,to] of [[.45,.49],[.49,.45],[.45,.49]]) {
    for(let i=1;i<=40;i++) result=g.move([from+(to-from)*i/40,.65],time+=5);
  }
  assert.equal(result,'tickle');
  const jitter=new TouchGesture([.5,.65],0);
  for(let i=1;i<100;i++) assert.equal(jitter.move([.5+Math.sin(i)*.003,.65],i*10),null);
});

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
