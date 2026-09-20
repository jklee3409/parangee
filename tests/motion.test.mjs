import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ParangBreathing } from '../dist/parang-breathing.js';

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.document = { hidden: false };
globalThis.window = { devicePixelRatio: 1 };
function model() {
  const m = Object.create(ParangBreathing.prototype);
  Object.assign(m, {
    ready: true, destroyed: false, running: true, visible: true, down: false, pointer: null,
    elapsed: 0, lastTime: null, lastDraw: 0, pixelRatio: 1, press: 0, velocity: 0,
    drag: [0, 0], dragTarget: [0, 0], dragVelocity: [0, 0], point: [.51, .53],
    softness: 1, pressure: 1, held: 0, memory: 0, ripple: 0, rippleAge: 0,
    action: null, autoRelease: 0, reduced: false, width: 1, height: 1,
    pose: { squash: 0, lift: 0, tilt: 0, wave: 0 },
    options: { period: 4200, expansion: .035, lift: .009, fps: 60 },
    element: { dataset: {}, hasPointerCapture: () => false }, events: [],
    emit(type) { this.events.push(type); }, draw() {},
  });
  return m;
}
function advance(m, seconds, step = 1000 / 60) {
  let time = m.lastTime ?? 0;
  if (m.lastTime === null) m.tick(time);
  for (let n = 0; n < Math.ceil(seconds * 1000 / step); n++) { time += step; m.tick(time); }
}
function positiveMesh(m) {
  const n = 32;
  const area = (a, b, c) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
  for (let y=0; y<n; y++) for (let x=0; x<n; x++) {
    const a=m.deform(x/n,y/n,.5), b=m.deform((x+1)/n,y/n,.5), c=m.deform(x/n,(y+1)/n,.5), d=m.deform((x+1)/n,(y+1)/n,.5);
    assert.ok([...a,...b,...c,...d].every(Number.isFinite));
    assert.ok(area(a,b,c)>0 && area(b,d,c)>0, `fold at ${x},${y}`);
  }
}
test('idle sleep begins after ten seconds and touch wakes immediately', () => {
  const m=model(); m.speech={textContent:''};
  advance(m,9.9); assert.equal(m.greeting.blink,0);
  advance(m,.4); assert.ok(m.greeting.blink>0&&m.greeting.blink<.1);
  assert.equal(m.element.dataset.sleeping,'true'); assert.match(m.speech.textContent,/Zzz/);
  advance(m,2); assert.equal(m.greeting.blink,.78);
  m.squeeze(); assert.equal(m.greeting.blink,0);
  assert.equal(m.element.dataset.sleeping,undefined); assert.match(m.speech.textContent,/왔구나/);
  assert.equal(m.reaction.type,'wake');
  advance(m,12); assert.equal(m.greeting.blink,0);
  m.release(); advance(m,9.9); assert.equal(m.greeting.blink,0);
  advance(m,2); assert.ok(m.greeting.blink>.7);
});

test('wake greeting smiles, ends, and cancels on another action or pause', () => {
  const m=model(); m.speech={textContent:''}; advance(m,12); m.squeeze(); m.release();
  advance(m,.35); assert.ok(m.greeting.blink>.1);
  advance(m,.6); assert.ok(m.greeting.smile>.8); positiveMesh(m);
  advance(m,1.4); assert.equal(m.reaction,null); assert.equal(m.speech.textContent,'');
  advance(m,12); m.squeeze(); m.release(); m.play('jump');
  assert.equal(m.reaction,null); assert.equal(m.action.type,'jump');
  m.pause(); assert.equal(m.greeting.mouth,0);
});

test('pet and tickle buttons play without pressing and settle after three seconds', () => {
  for (const kind of ['pet','tickle']) for (const reduced of [false,true]) {
    const m=model(); m.reduced=reduced; m.speech={textContent:''};
    advance(m,12);
    assert.equal(m.play(kind),true);
    assert.equal(m.element.dataset.sleeping,undefined);
    assert.equal(m.reaction.type,kind); assert.equal(m.down,false);
    advance(m,.4); assert.ok(m.greeting.smile>0); positiveMesh(m);
    assert.ok(m.speech.textContent.length>0);
    advance(m,2.7);
    assert.equal(m.reaction,null); assert.equal(m.speech.textContent,'');
    assert.equal(m.greeting.mouth,0);
  }
});

test('reaction buttons respect lifecycle guards and touch or other actions interrupt them', () => {
  for (const kind of ['pet','tickle']) {
    const m=model(); m.speech={textContent:''};
    m.ready=false; assert.equal(m.play(kind),false); m.ready=true;
    m.squeeze(); assert.equal(m.play(kind),false); m.release();
    m.play('jump'); assert.equal(m.play(kind),false); advance(m,2);
    m.play(kind); m.squeeze(); assert.equal(m.reaction,null); m.release();
    m.play(kind); assert.equal(m.play('wave'),true); assert.equal(m.reaction,null);
    m.pause(); assert.equal(m.reaction,null); assert.equal(m.speech.textContent,'');
    assert.equal(m.play(kind),false);
    m.start(); m.play(kind); advance(m,.4); m.pause();
    assert.equal(m.reaction,null); assert.equal(m.greeting.mouth,0);
  }
});

test('head strokes and belly rubbing remain ordinary drags', () => {
  for (const y of [.26,.65]) {
    const m=model(); m.squeeze(.45,y);
    for(const x of [.48,.51,.48,.45,.48,.51]) {
      advance(m,.1); m.moveTouch([x,y]);
      assert.equal(m.reaction,null);
      assert.equal(m.dragTarget[0],Math.tanh((x-.45)*4)*.12);
    }
    m.release();
  }
});

test('actions wake the character and restart idle time when finished', () => {
  for (const type of ['squish','jump','wave','pet','tickle']) {
    const m=model(); advance(m,12);
    assert.equal(m.element.dataset.sleeping,'true');
    assert.equal(m.play(type),true);
    assert.equal(m.element.dataset.sleeping,undefined);
    assert.equal(m.greeting.blink,0);
    advance(m,4); assert.equal(m.action,null);
    advance(m,6); assert.equal(m.element.dataset.sleeping,undefined);
    advance(m,4); assert.equal(m.element.dataset.sleeping,'true');
  }
});

test('pause clears sleep and resuming grants a fresh ten seconds', () => {
  const m=model(); m.speech={textContent:''}; advance(m,12);
  m.pause(); assert.equal(m.greeting.blink,0);
  assert.equal(m.element.dataset.sleeping,undefined); assert.equal(m.speech.textContent,'');
  m.start(); advance(m,9.9); assert.equal(m.greeting.blink,0);
  advance(m,2); assert.ok(m.greeting.blink>.7);
});

test('sleeping eyes and nod keep the mesh unfolded, including reduced motion', () => {
  for (const reduced of [false,true]) {
    const m=model(); m.reduced=reduced;
    for(let time=10;time<17;time+=.2) {
      m.elapsed=time*1000; m.updatePose(); positiveMesh(m);
      assert.ok(m.greeting.nod <= (reduced ? .0024 : .012) + 1e-12);
    }
  }
});

test('touch blush builds while held, fades after release and clears on pause', () => {
  const m=model();
  m.squeeze(); assert.ok(m.touchBlush>0);
  advance(m,.5); assert.ok(m.touchBlush>.95);
  m.release(); advance(m,.3); assert.ok(m.touchBlush>.3&&m.touchBlush<.6);
  advance(m,4); assert.equal(m.touchBlush,0);
  m.squeeze(); m.pause(); assert.equal(m.touchBlush,0);
});

test('greeting speech clears on completion, interruption and pause', () => {
  const m=model(); m.speech={textContent:''};
  m.play('wave'); assert.ok(m.speech.textContent.length>0);
  advance(m,3.7); assert.equal(m.speech.textContent,'');
  m.play('wave'); m.squeeze(); assert.equal(m.speech.textContent,'');
  m.release(); m.play('wave'); m.pause(); assert.equal(m.speech.textContent,'');
});

test('original character image remains byte-for-byte unchanged', () => {
  const original = execFileSync('git', ['show', 'HEAD:dist/assets/parang.png'], { maxBuffer: 20_000_000 });
  const hash = data => createHash('sha256').update(data).digest('hex');
  assert.equal(hash(readFileSync(new URL('../dist/assets/parang.png', import.meta.url))), hash(original));
});
test('all softness settings settle after repeated presses, drags and release', () => {
  for (const softness of [0,1,2]) for (const step of [1000/120,1000/30,200]) {
    const m=model(); m.softness=softness;
    for(let i=0;i<5;i++) {m.squeeze();m.dragTarget=[.12,-.12];advance(m,.35,step);m.release();advance(m,.25,step);}
    advance(m,12,step);
    assert.ok(Math.abs(m.press)<.001); assert.ok(m.memory<.001);
    assert.ok(Math.hypot(...m.drag)<.001); assert.equal(m.down,false);
  }
});
test('extreme touch positions and drags do not invert the character mesh', () => {
  const m=model();m.press=1.8;m.memory=.3;m.ripple=1;m.rippleAge=.1;
  for(const point of [[.25,.2],[.3,.3],[.5,.5],[.75,.7],[.5,.85],[.85,.9]])
    for(const drag of [[.15,.15],[-.15,-.15],[.15,-.15],[-.15,.15]]) {m.point=point;m.drag=drag;positiveMesh(m);}
});
test('jump has anticipation, flight, a single landing and returns to idle', () => {
  const m=model(); assert.equal(m.play('jump'),true); assert.equal(m.play('wave'),false);
  advance(m,.15);assert.ok(m.pose.squash>0);
  advance(m,.4);assert.ok(m.pose.lift>.1);
  positiveMesh(m);advance(m,1.5);assert.equal(m.action,null);
  assert.equal(m.events.filter(x=>x==='land').length,1);
  advance(m,.1);assert.deepEqual(m.pose,{squash:0,lift:0,tilt:0,wave:0});
});
test('wave and jump meshes stay unfolded throughout their timelines', () => {
  for(const type of ['wave','jump']) {const m=model();m.play(type);for(let i=0;i<110;i++){advance(m,.04);positiveMesh(m);}}
});
test('calm mode reduces motion and pause cancels pending landing', () => {
  const normal=model(),calm=model();calm.reduced=true;
  normal.play('jump');calm.play('jump');advance(normal,.5);advance(calm,.5);
  assert.ok(calm.pose.lift<normal.pose.lift*.2);
  normal.pause();assert.equal(normal.action,null);assert.equal(normal.running,false);
  assert.equal(normal.events.includes('land'),false);
  assert.equal(normal.play('wave'),false);
});
test('automatic squish releases and pointer cancellation is silent', () => {
  const m=model();m.play('squish');advance(m,1);assert.equal(m.down,false);
  m.squeeze();const count=m.events.length;m.release(true);assert.equal(m.events.length,count);
});
