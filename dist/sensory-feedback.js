/** Tactile envelopes and quiet synthesized sounds; no audio assets or network. */
export class SensoryFeedback {
  constructor() {
    this.haptics = true; this.sound = false; this.lastPulse = -Infinity; this.audio = null;
    const cap = window.Capacitor;
    this.native = cap?.isNativePlatform?.() ? cap.Plugins?.SquishyHaptics ?? null : null;
    this.supported = Boolean(this.native || navigator.vibrate);
  }
  unlock() {
    if (!this.sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.audio ??= new Audio(); this.audio.resume().catch(() => {});
    } catch { /* Audio is optional. */ }
  }
  pulse(type, strength = 1) {
    if (document.hidden) return;
    const now = performance.now();
    if (type === 'stretch' && now - this.lastPulse < 95) return;
    this.lastPulse = now;
    if (this.haptics && this.supported) {
      if (this.native) this.native.play({ type, strength }).catch(() => {});
      else {
        const patterns = { press: [12], stretch: [7], release: [10, 24, 7], jump: [7], land: [22, 28, 10], wave: [8, 65, 8] };
        try { navigator.vibrate(patterns[type] || [8]); } catch {}
      }
    }
    if (!this.sound || !this.audio || this.audio.state !== 'running') return;
    const ctx = this.audio, t = ctx.currentTime;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const notes = { press: [180, 75], stretch: [150, 220], release: [130, 340], jump: [220, 470], land: [130, 55], wave: [420, 570] };
    const [from, to] = notes[type] || notes.press;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(from, t);
    oscillator.frequency.exponentialRampToValueAtTime(to, t + .13);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.035 * Math.max(.2, Math.min(1, strength)), t + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .2);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(t); oscillator.stop(t + .22);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  stop() {
    if (this.native) this.native.stop().catch(() => {});
    else if (navigator.vibrate) { try { navigator.vibrate(0); } catch {} }
    this.audio?.suspend().catch(() => {});
  }
}
