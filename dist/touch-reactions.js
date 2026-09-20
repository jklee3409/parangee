import { restingGreeting } from './greeting-motion.js';

const ease = t => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };
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
