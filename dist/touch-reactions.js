import { restingGreeting } from './greeting-motion.js';

const ease = t => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };
export function touchRegion([x, y]) {
  if (x >= .32 && x <= .69 && y >= .20 && y <= .39) return 'pet';
  if (x >= .36 && x <= .66 && y >= .51 && y <= .79) return 'tickle';
  return null;
}

// Track travel and deliberate reversals, so a tap or a single pull stays a squish.
export class TouchGesture {
  constructor(point, time) { this.reset(point, time); }
  reset(point, time) {
    this.region = touchRegion(point); this.last = point; this.start = time;
    this.time = time; this.travel = 0; this.direction = 0; this.extreme = point[0];
    this.turns = 0; this.kind = null;
  }
  move(point, time) {
    const region = touchRegion(point);
    if (!region || region !== this.region || time-this.time > 350 || time-this.start > 1400) {
      this.reset(point, time); return null;
    }
    const dx = point[0]-this.last[0], dy = point[1]-this.last[1];
    const distance = Math.hypot(dx, dy), dt = Math.max(1, time-this.time);
    this.last = point; this.time = time;
    if (distance/dt > .0012) { this.reset(point, time); return null; }
    this.travel += distance;
    // Use accumulated displacement, not per-event deltas: high-frequency touch
    // events must recognize the same rub as a lower-frequency pointer stream.
    const excursion = point[0]-this.extreme;
    if (!this.direction && Math.abs(excursion) >= .012) {
      this.direction = Math.sign(excursion); this.extreme = point[0];
    } else if (this.direction && excursion*this.direction > 0) {
      this.extreme = point[0];
    } else if (this.direction && excursion*this.direction <= -.012) {
      this.turns++; this.direction *= -1; this.extreme = point[0];
    }
    const duration = time-this.start;
    if (region === 'pet' && duration >= 180 && this.travel >= .055) this.kind = 'pet';
    if (region === 'tickle' && duration >= 180 && this.travel >= .075 && this.turns >= 2) this.kind = 'tickle';
    return this.kind;
  }
}

export function reactionPose(type, seconds, strength = 1, reduced = false) {
  const p = restingGreeting(), movement = reduced ? .2 : 1;
  const amount = ease(seconds/.25)*strength;
  if (type === 'wake') {
    const end = 1-ease((seconds-1.5)/.7);
    p.blink = .5 * (ease(seconds/.15)-ease((seconds-.25)/.45)) * end;
    p.smile = ease((seconds-.35)/.6)*end;
    p.blush = p.smile*.65;
    p.nod = -.004*Math.sin(Math.PI*Math.min(1, seconds/2.2))*movement;
  } else {
    p.smile = amount; p.blush = amount*.85;
    p.blink = amount*(type === 'pet' ? .35 : .48);
    p.tail = Math.sin(seconds*Math.PI*2/1.1)*.07*amount*movement;
    p.roll = (type === 'pet' ? .025 : Math.sin(seconds*16)*.008)*amount*movement;
    p.nod = (type === 'pet' ? -.003 : Math.sin(seconds*20)*.002)*amount*movement;
    p.mouth = type === 'tickle' ? amount*.8 : 0;
    p.squash = type === 'tickle' ? Math.sin(seconds*20)*.006*amount*movement : 0;
  }
  return p;
}
