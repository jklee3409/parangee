import { ParangBreathing } from './parang-breathing.js';
import { SensoryFeedback } from './sensory-feedback.js';
const element = document.getElementById('parang');
const model = new ParangBreathing(element);
const sensory = new SensoryFeedback();
const dialog = document.getElementById('settings');
const guide = document.getElementById('play-guide');
const modalOpen = () => dialog.open || guide.open;
const defaults = { haptics: true, sound: false, calm: false, softness: 1 };
const preferences = { ...defaults };
try {
  const stored = JSON.parse(localStorage.getItem('parang-sensory') || '{}');
  for (const key of ['haptics', 'sound', 'calm']) if (typeof stored?.[key] === 'boolean') preferences[key] = stored[key];
  if ([0, 1, 2].includes(stored?.softness)) preferences.softness = stored.softness;
} catch { /* Private browsing and invalid storage use defaults. */ }
const themeToggle = document.getElementById('theme-toggle');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let chosenTheme;
try { const stored=localStorage.getItem('parang-theme'); if (['light','dark'].includes(stored)) chosenTheme=stored; } catch {}
function applyTheme(theme) {
  document.documentElement.dataset.theme=theme;
  themeToggle.setAttribute('aria-pressed',String(theme==='dark'));
  themeToggle.querySelector('span').textContent=theme==='dark'?'☀':'☾';
  document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#101923':'#f3f7fa';
}
themeToggle.addEventListener('click',()=>{
  chosenTheme=document.documentElement.dataset.theme==='dark'?'light':'dark';
  applyTheme(chosenTheme);
  try { localStorage.setItem('parang-theme',chosenTheme); } catch {}
});
systemTheme.addEventListener('change',event=>{if(!chosenTheme)applyTheme(event.matches?'dark':'light');});
applyTheme(chosenTheme || (systemTheme.matches?'dark':'light'));
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
    if (model.play(type)) {
      const button=document.getElementById(type);
      button.classList.remove('is-playing');
      void button.offsetWidth;
      button.classList.add('is-playing');
    }
  });
}
for(const button of document.querySelectorAll('.action'))button.addEventListener('animationend',()=>button.classList.remove('is-playing'));
document.getElementById('settings-open').addEventListener('click', () => { model.pause(); sensory.stop(); dialog.showModal(); });
document.getElementById('settings-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if (!document.hidden && !modalOpen()) model.start(); });
const pages = [...guide.querySelectorAll('.guide-page')];
const next = document.getElementById('guide-next');
const previous = document.getElementById('guide-prev');
let guideStep = 0;
function showGuideStep(index) {
  guideStep = index;
  pages.forEach((page, i) => { page.hidden = i !== index; });
  guide.querySelectorAll('.guide-progress i').forEach((dot, i) => dot.classList.toggle('current', i === index));
  document.getElementById('guide-count').textContent = `${index+1} / ${pages.length}`;
  previous.hidden = index === 0;
  next.textContent = index === pages.length-1 ? '같이 놀자 ♡' : '다음 →';
  guide.scrollTop = 0;
}
document.getElementById('help-open').addEventListener('click', () => {
  model.pause(); sensory.stop(); showGuideStep(0); guide.showModal();
});
document.getElementById('help-close').addEventListener('click', () => guide.close());
next.addEventListener('click', () => {
  if (guideStep === pages.length-1) guide.close(); else showGuideStep(guideStep+1);
});
previous.addEventListener('click', () => {
  showGuideStep(Math.max(0, guideStep-1));
  if (previous.hidden) next.focus();
});
guide.addEventListener('close', () => { if (!document.hidden && !modalOpen()) model.start(); });
const pause = () => { model.pause(); sensory.stop(); };
window.addEventListener('pagehide', pause);
window.addEventListener('pageshow', () => { if (!modalOpen()) model.start(); });
window.addEventListener('blur', () => sensory.stop());
window.addEventListener('focus', () => { if (modalOpen()) model.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else if (modalOpen()) model.pause(); });
