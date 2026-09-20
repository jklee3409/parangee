import test from 'node:test';
import assert from 'node:assert/strict';
import { greetingPose,restingGreeting,deformGreeting,drawCheekBlush,GREETING_DURATION } from '../dist/greeting-motion.js';

test('greeting has clear slow head turns, a smiling bow and exact rest', () => {
  assert.ok(greetingPose(.95).turn>0);
  assert.ok(greetingPose(1.95).turn<0);
  assert.ok(greetingPose(2.8).turn>0);
  for(let t=0;t<3.6;t+=.01) {
    assert.ok(Math.abs(greetingPose(t).turn)<.176);
    assert.ok(Math.abs(greetingPose(t+.01).turn-greetingPose(t).turn)/.01<.64);
  }
  assert.ok(greetingPose(2.22).smile>.9);
  assert.ok(greetingPose(2.4).nod>.008);
  assert.ok(greetingPose(2.25).blink>.5);
  for(const t of [-1,0,GREETING_DURATION,10]) {
    assert.deepEqual(greetingPose(t),restingGreeting());
    assert.deepEqual(deformGreeting(.431,.337,greetingPose(t)),[.431,.337]);
  }
});

test('head rotation foreshortens eye spacing without affecting arms or feet', () => {
  const aspect=1327/1186;
  const distance=(a,b)=>Math.hypot((a[0]-b[0])*aspect,a[1]-b[1]);
  const a=[.431,.337],b=[.580,.337],originalDistance=distance(a,b);
  for(let t=0;t<3.6;t+=.04) {
    const pose=greetingPose(t);
    const ratio=distance(deformGreeting(...a,pose),deformGreeting(...b,pose))/originalDistance;
    assert.ok(ratio>.80&&ratio<1.03);
    for(const point of [[.281,.722],[.726,.719],[.41,.90],[.61,.90]])
      assert.ok(distance(deformGreeting(...point,pose),point)<.00001);
  }
});

test('pose position and velocity remain continuous across all phase changes', () => {
  const boundaries=[0,.15,.23,.38,.45,.55,.58,.8,.95,1.5,1.55,1.65,1.75,1.95,1.99,2.04,2.18,2.22,2.33,2.4,2.55,2.63,2.65,2.8,2.82,3.6];
  for(const t of boundaries) {
    const a=greetingPose(t-.0001),b=greetingPose(t),c=greetingPose(t+.0001);
    for(const key of Object.keys(b)) {
      assert.ok(Math.abs(c[key]-a[key])<.002,key+' position at '+t);
      assert.ok(Math.abs((c[key]-b[key])-(b[key]-a[key]))<.000001,key+' speed at '+t);
    }
  }
});

test('full-resolution greeting mesh stays unfolded, including smile and slow blink', () => {
  const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let t=0;t<3.65;t+=.075) {
    const pose=greetingPose(t);
    const nx=64,ny=60;
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
      const a=deformGreeting(x/nx,y/ny,pose),b=deformGreeting((x+1)/nx,y/ny,pose),c=deformGreeting(x/nx,(y+1)/ny,pose),d=deformGreeting((x+1)/nx,(y+1)/ny,pose);
      assert.ok(area(a,b,c)>0&&area(b,d,c)>0,`fold at ${t}, ${x}, ${y}`);
    }
  }
});

test('reduced motion keeps the smile with smaller head movement and a gentler blink', () => {
  for(const t of [.62,1.13,2.25,2.4]) {
    const normal=greetingPose(t),calm=greetingPose(t,true);
    for(const key of ['roll','turn','nod','tilt','squash','tail'])assert.ok(Math.abs(calm[key])<=Math.abs(normal[key])*.201);
    assert.equal(calm.smile,normal.smile);
    assert.ok(calm.blink<=normal.blink*.351);
  }
});


test('aegyo moves the head while both shoulders and torso stay still', () => {
  let largestHeadMotion=0;
  for(let t=0;t<3.6;t+=.04) {
    const pose=greetingPose(t);
    assert.equal(pose.tilt,0);assert.equal(pose.squash,0);
    for(const point of [[.338,.535],[.675,.535],[.5,.65]]) {
      const moved=deformGreeting(...point,pose);
      assert.ok(Math.hypot(moved[0]-point[0],moved[1]-point[1])<.000001);
    }
    const nose=deformGreeting(.505,.367,pose);
    largestHeadMotion=Math.max(largestHeadMotion,Math.abs(nose[0]-.505));
  }
  assert.ok(largestHeadMotion>.02&&largestHeadMotion<.026);
});

test('tail wags both ways with a fixed base and returns to rest', () => {
  let left=0,right=0;
  for(let t=0;t<GREETING_DURATION;t+=.01) {
    const pose=greetingPose(t);
    const tip=deformGreeting(.775,.475,pose);
    left=Math.min(left,tip[0]-.775);right=Math.max(right,tip[0]-.775);
    for(const point of [[.72,.68],[.70,.56],[.73,.62],[.5,.65]]) {
      assert.deepEqual(deformGreeting(...point,pose),point);
    }
  }
  assert.ok(left<-.015&&right>.015);
  assert.deepEqual(deformGreeting(.775,.475,greetingPose(GREETING_DURATION)),[.775,.475]);
});

test('tail has a slower cadence, bounded speed and a softer final swing', () => {
  const peaks=[],dt=.001;
  for(let t=dt;t<GREETING_DURATION-dt;t+=dt) {
    const a=greetingPose(t-dt).tail,b=greetingPose(t).tail,c=greetingPose(t+dt).tail;
    assert.ok(Math.abs(c-a)/(2*dt)<.81,'tail turns too quickly');
    assert.ok(Math.abs(c-2*b+a)/(dt*dt)<7.5,'tail accelerates abruptly');
    if(b>a&&b>c)peaks.push({time:t,angle:b});
  }
  assert.equal(peaks.length,4);
  const period=peaks[2].time-peaks[1].time;
  assert.ok(period>.95&&period<1.05);
  assert.ok(peaks[2].angle<peaks[1].angle);
  assert.ok(peaks[3].angle<peaks[2].angle*.4);
});

test('tail starts and finishes at rest without a velocity or acceleration jump', () => {
  const dt=.0001;
  for(const reduced of [false,true])for(const time of [0,GREETING_DURATION]) {
    const a=greetingPose(time-dt,reduced).tail,b=greetingPose(time,reduced).tail,c=greetingPose(time+dt,reduced).tail;
    assert.equal(b,0);
    assert.ok(Math.abs(c-a)/(2*dt)<.00001);
    assert.ok(Math.abs(c-2*b+a)/(dt*dt)<.01);
  }
});

test('blush follows both deformed cheeks and clears completely after aegyo', () => {
  const transforms=[];let clears=0,fills=0;
  const ctx={clearRect(){clears++;},save(){},restore(){},setTransform(...args){transforms.push(args);},
    createRadialGradient(){return {addColorStop(){}};},fillRect(){fills++;}};
  const pose=greetingPose(.67);
  const model={width:1000,height:894,greeting:pose,deform(x,y){const p=deformGreeting(x,y,this.greeting);return[p[0]*this.width,p[1]*this.height];}};
  drawCheekBlush(ctx,model,0);
  assert.equal(fills,2);
  for(const [i,cx] of [.387,.624].entries())assert.deepEqual(transforms[i].slice(4),model.deform(cx,.388));
  model.greeting=greetingPose(GREETING_DURATION);drawCheekBlush(ctx,model,0);
  assert.equal(clears,2);assert.equal(fills,2);assert.equal(model.greeting.blush,0);
  assert.ok(greetingPose(1.65).blush>greetingPose(.2).blush);
  assert.equal(greetingPose(1.65,true).blush,greetingPose(1.65).blush);
});


test('larger yaw preserves eye proportions and leaves the head outline intact', () => {
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  for(const [time,direction] of [[.95,1],[1.95,-1]]) {
    const pose=greetingPose(time);
    const eyeWidth=x=>distance(deformGreeting(x-.014,.337,pose),deformGreeting(x+.014,.337,pose));
    const near=eyeWidth(direction>0?.431:.580),far=eyeWidth(direction>0?.580:.431);
    assert.ok(near/far>.9&&near/far<1.1);
    assert.ok(far>.028*.9);assert.ok(near<.028*1.1);
    const left=deformGreeting(.431,.337,pose),right=deformGreeting(.580,.337,pose),nose=deformGreeting(.506,.365,pose);
    // A slide keeps the nose centered between the eyes; a turn must not.
    assert.ok(direction*(nose[0]-(left[0]+right[0])/2)>.0005);
    assert.ok(direction*(nose[0]-.506)>.002);
    assert.ok(Math.abs(nose[0]-.506)<.026);
    const withoutYaw={...pose,turn:0};
    for(const point of [[.30,.30],[.71,.30],[.506,.15]]) {
      assert.deepEqual(deformGreeting(...point,pose),deformGreeting(...point,withoutYaw));
    }
  }
});
