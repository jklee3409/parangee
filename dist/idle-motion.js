import { restingGreeting } from './greeting-motion.js';

export const IDLE_SLEEP_DELAY = 10_000;

// Ease into a sleepy expression using the original eyes and head mesh.
export function sleepyPose(idleMilliseconds, reduced = false) {
  const pose = restingGreeting();
  const seconds = Math.max(0, (idleMilliseconds - IDLE_SLEEP_DELAY) / 1000);
  const t = Math.min(1, seconds / 1.8);
  const amount = t * t * t * (t * (t * 6 - 15) + 10);
  pose.blink = .78 * amount;
  pose.nod = .012 * amount * (.7 + .3 * Math.sin(seconds * Math.PI * 2 / 4.8)) * (reduced ? .2 : 1);
  return pose;
}
