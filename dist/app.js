import { ParangBreathing } from './parang-breathing.js';
import { SensoryFeedback } from './sensory-feedback.js';
import { GREETING_DURATION } from './greeting-motion.js';
const element = document.getElementById('parang');
const model = new ParangBreathing(element);
const sensory = new SensoryFeedback();
const bubble = document.getElementById('bubble');
const dialog = document.getElementById('settings');
const defaults = { haptics: true, sound: false, calm: false, softness: 1 };
const preferences = { ...defaults };
try {
  const stored = JSON.parse(localStorage.getItem('parang-sensory') || '{}');
  for (const key of ['haptics', 'sound', 'calm']) if (typeof stored?.[key] === 'boolean') preferences[key] = stored[key];
  if ([0, 1, 2].includes(stored?.softness)) preferences.softness = stored.softness;
} catch { /* Private browsing and invalid storage use defaults. */ }
let bubbleTimer, greetingIndex = 0;
const greetings = ['(˶ᵔ ᵕ ᵔ˶) ♡', '(≧◡≦) ♡', '(づ ◕‿◕ )づ', '(｡♥‿♥｡)'];
function say(text) {
  clearTimeout(bubbleTimer); bubble.textContent = text; bubble.classList.add('visible');
  bubbleTimer = setTimeout(() => { bubble.classList.remove('visible'); bubble.textContent = ''; }, (GREETING_DURATION + .25) * 1000);
}
function applySettings() {
  sensory.haptics = preferences.haptics; sensory.sound = preferences.sound;
  model.softness = preferences.softness; model.setCalm(preferences.calm);
  document.getElementById('softness-value').textContent = ['탱글탱글', '폭신폭신', '몰랑몰랑'][preferences.softness];
  if (!preferences.haptics || !preferences.sound) sensory.stop();
}
for (const key of Object.keys(defaults)) {
  const control = document.getElementById(key);
  if (key === 'softness') control.value = preferences[key]; else control.checked = preferences[key];
  control.addEventListener('change', () => {
    preferences[key] = key === 'softness' ? Number(control.value) : control.checked;
    applySettings(); sensory.unlock();
    try { localStorage.setItem('parang-sensory', JSON.stringify(preferences)); } catch {}
    if (key === 'haptics' && preferences.haptics) sensory.pulse('press');
  });
}
if (!sensory.supported) {
  document.getElementById('haptics').disabled = true;
  document.getElementById('haptic-help').textContent = '이 환경에서는 진동을 지원하지 않아요';
}
if (sensory.native) sensory.native.available().then(({ supported }) => {
  sensory.supported = supported;
  document.getElementById('haptics').disabled = !supported;
  if (!supported) document.getElementById('haptic-help').textContent = '이 기기에는 진동 모터가 없어요';
}).catch(() => {});
applySettings();
element.addEventListener('parang-interaction', ({ detail }) => { sensory.unlock(); sensory.pulse(detail.type, detail.strength); });
for (const type of ['squish', 'jump', 'wave']) {
  document.getElementById(type).addEventListener('click', () => {
    sensory.unlock();
    if (model.play(type) && type === 'wave') say(greetings[greetingIndex++ % greetings.length]);
  });
}
document.getElementById('settings-open').addEventListener('click', () => { model.pause(); sensory.stop(); dialog.showModal(); });
document.getElementById('settings-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if (!document.hidden) model.start(); });
const pause = () => { model.pause(); sensory.stop(); clearTimeout(bubbleTimer); bubble.classList.remove('visible'); bubble.textContent = ''; };
window.addEventListener('pagehide', pause);
window.addEventListener('pageshow', () => { if (!dialog.open) model.start(); });
window.addEventListener('blur', () => sensory.stop());
window.addEventListener('focus', () => { if (dialog.open) model.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else if (dialog.open) model.pause(); });
