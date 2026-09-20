/** Framework-independent high-DPI breathing and squishy renderer. */
import { MeshRenderer } from './mesh-renderer.js';
import { characterTexture } from './character-texture.js';
import { sleepyPose } from './idle-motion.js';
import { TouchGesture, reactionPose } from './touch-reactions.js';
import { greetingPose, restingGreeting, deformGreeting, drawCheekBlush, drawSmileMouth, GREETING_DURATION } from './greeting-motion.js';
export class ParangBreathing {
  constructor(element, { period = 4200, expansion = 0.035, lift = 0.009, fps = 60 } = {}) {
    if (!(element instanceof HTMLElement)) throw new TypeError('A model container is required.');
    if (![period, expansion, lift, fps].every(Number.isFinite) || period <= 0 || fps <= 0 || expansion < 0 || lift < 0) throw new RangeError('Invalid breathing options.');
    this.element = element;
    this.image = element.querySelector('img');
    this.speech = element.querySelector('.speech');
    this.touchBlush = 0;
    this.canvas = element.querySelector('canvas');
    if (!this.image || !this.canvas) throw new TypeError('The container must contain an img and a canvas.');
    this.blushLayer = document.createElement('canvas');
    this.blushLayer.setAttribute('aria-hidden', 'true');
    this.blushLayer.className = 'blush-overlay';
    this.blushContext = this.blushLayer.getContext('2d');
    element.append(this.blushLayer);
    this.context = null;
    this.mesh = null;
    this.options = { period, expansion, lift, fps };
    this.frame = 0;
    this.elapsed = 0;
    this.lastActivity = 0;
    this.lastDraw = 0;
    this.lastTime = null;
    this.visible = true;
    this.running = true;
    this.destroyed = false;
    this.ready = false;
    this.press = 0;
    this.velocity = 0;
    this.drag = [0, 0];
    this.dragVelocity = [0, 0];
    this.dragTarget = [0, 0];
    this.point = [0.51, 0.53];
    this.pointer = null;
    this.down = false;
    this.breath = 0;
    this.softness = 1;
    this.pressure = 1;
    this.held = 0;
    this.memory = 0;
    this.ripple = 0;
    this.rippleAge = 0;
    this.action = null;
    this.reaction = null;
    this.gesture = null;
    this.pose = { squash: 0, lift: 0, tilt: 0, wave: 0 };
    this.greeting = restingGreeting();
    this.autoRelease = 0;
    this.lastStretch = 0;
    this.pixelRatio = 0;
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this.motionQuery.matches;
    this.abort = new AbortController();
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.tick = this.tick.bind(this);
    this.onVisibility = () => { if (document.hidden) this.pause(); else this.start(); };
    this.onLoad = () => {
      if (this.destroyed || !this.image.naturalWidth || this.ready) return;
      if (!this.texture) {
        this.texture = characterTexture(this.image);
        this.element.append(this.texture);
      }
      try { this.mesh = new MeshRenderer(this.canvas, this.texture); }
      catch {
        this.mesh = null;
        const old = this.canvas;
        this.canvas = old.cloneNode(); old.replaceWith(this.canvas);
        this.context = this.canvas.getContext('2d');
        this.options.fps = Math.min(30, this.options.fps);
      }
      if (!this.mesh && !this.context) return;
      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault(); this.pause(); delete this.element.dataset.ready;
      }, { signal: this.abort.signal });
      this.canvas.addEventListener('webglcontextrestored', () => {
        this.ready = false; this.onLoad(); this.start();
      }, { signal: this.abort.signal, once: true });
      this.ready = true;
      this.resize();
      this.draw(0);
      this.element.dataset.ready = 'true';
      this.schedule();
    };
    this.image.addEventListener('load', this.onLoad);
    document.addEventListener('visibilitychange', this.onVisibility);
    const listen = (target, name, fn) => target.addEventListener(name, fn, { signal: this.abort.signal });
    listen(this.motionQuery, 'change', (e) => { this.reduced = e.matches || Boolean(this.calm); });
    const position = (e) => { const r = element.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    listen(element, 'pointerdown', (e) => {
      element.dataset.pointerFocus = 'true';
      if (this.pointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const [x, y] = position(e);
      if (x < 0.24 || x > 0.86 || y < 0.19 || y > 0.94) return;
      e.preventDefault();
      element.focus({ preventScroll: true });
      this.pointer = e.pointerId;
      element.setPointerCapture(e.pointerId);
      this.squeeze(x, y);
      this.gesture = new TouchGesture([x, y], e.timeStamp);
      this.pressure = e.pointerType === 'pen' ? Math.max(.3, e.pressure * 1.4) : 1;
    });
    listen(element, 'pointermove', (e) => {
      if (!this.down || this.pointer !== e.pointerId) return;
      this.moveTouch(position(e), e.timeStamp);
      if (e.pointerType === 'pen') this.pressure = Math.max(.3, e.pressure * 1.4);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(element, name, (e) => { if (e.pointerId === this.pointer) this.release(name !== 'pointerup'); });
    }
    listen(element, 'keydown', (e) => {
      delete element.dataset.pointerFocus;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) this.squeeze(0.51, 0.53); }
    });
    listen(element, 'keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.release(); } });
    listen(element, 'blur', () => { delete element.dataset.pointerFocus; this.release(true); });
    listen(window, 'blur', () => this.pause());
    listen(window, 'focus', () => this.start());
    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(element);
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (!this.visible) this.release();
        this.schedule();
      });
      this.observer.observe(element);
    }
    if (this.image.complete) this.onLoad();
  }

  moveTouch(p, time) {
    const kind = this.gesture?.move(p, time);
    if (kind) {
      if (this.reaction?.type !== kind) {
        this.reaction = { type: kind, start: this.elapsed, until: this.elapsed + 900 };
        this.say(kind === 'pet' ? '손길이 포근해… ♡' : '히히, 간지러워!');
        this.emit('wave', .45);
      }
      this.reaction.until = this.elapsed + 900;
      this.dragTarget = [0, 0];
      return;
    }
    this.dragTarget = p.map((v, i) => Math.tanh((v - this.point[i]) * 4) * .12);
    const stretch = Math.hypot(...this.dragTarget);
    if (Math.abs(stretch - this.lastStretch) > .035) {
      this.lastStretch = stretch;
      this.emit('stretch', Math.min(1, stretch * 5));
    }
  }

  start() { if (!this.destroyed) { this.running = true; this.schedule(); } }
  pause() { this.release(true); this.wake(); this.reaction = null; this.action = null; this.autoRelease = 0; this.touchBlush = 0; this.say(''); this.pose = { squash: 0, lift: 0, tilt: 0, wave: 0 }; this.greeting = restingGreeting(); this.blushContext?.clearRect(0,0,this.width,this.height); this.running = false; this.schedule(); }
  say(text) { if (this.speech) this.speech.textContent = text; }
  wake(animate = false) {
    const sleeping = this.element.dataset.sleeping;
    this.reaction = null;
    this.lastActivity = this.elapsed;
    this.greeting = restingGreeting();
    if (this.element.dataset.sleeping) {
      delete this.element.dataset.sleeping;
      this.say('');
    }
    if (animate && sleeping) {
      this.reaction = { type: 'wake', start: this.elapsed, until: this.elapsed + 2200 };
      this.say('음… 왔구나! ♡');
    }
  }
  emit(type, strength = 1) { this.element.dispatchEvent(new CustomEvent('parang-interaction', { detail: { type, strength } })); }
  setCalm(value) { this.calm = value; this.reduced = value || this.motionQuery.matches; }
  play(type) {
    if (!this.ready || !this.running || this.destroyed || this.down || this.action) return false;
    if (type === 'squish') { this.squeeze(); this.autoRelease = this.elapsed + 700; return true; }
    if (!['jump', 'wave'].includes(type)) return false;
    this.wake();
    this.action = { type, start: this.elapsed, landed: false };
    this.say(type === 'wave' ? '너랑 노는 게 제일 좋아 ♡' : '');
    this.emit(type);
    return true;
  }
  squeeze(x = 0.51, y = 0.53) {
    if (!this.ready || this.destroyed || !this.running) return;
    this.wake(true);
    this.gesture = null;
    this.point = [x, y];
    this.action = null;
    if (!this.reaction) this.say('');
    this.touchBlush = Math.max(this.touchBlush || 0, .3);
    this.autoRelease = 0;
    this.held = 0;
    this.lastStretch = 0;
    this.pressure = 1;
    this.down = true;
    this.dragTarget = [0, 0];
    this.element.dataset.pressed = 'true';
    this.emit('press');
  }
  release(silent = false) {
    this.gesture = null;
    if (silent && this.reaction) { this.reaction = null; this.say(''); }
    const wasDown = this.down;
    const pointer = this.pointer;
    this.down = false;
    this.pointer = null;
    if (pointer !== null && this.element.hasPointerCapture(pointer)) this.element.releasePointerCapture(pointer);
    if (wasDown) {
      this.lastActivity = this.elapsed;
      this.ripple = Math.min(1, Math.max(.2, this.press) + Math.hypot(...this.drag) * 2);
      this.rippleAge = 0;
      if (!silent) this.emit('release', this.ripple);
    }
    this.autoRelease = 0;
    this.dragTarget = [0, 0];
    delete this.element.dataset.pressed;
  }
  resize() {
    if (!this.ready || this.destroyed) return;
    const bounds = this.element.getBoundingClientRect();
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.min(2048, Math.round(bounds.width * this.pixelRatio)));
    const h = Math.max(1, Math.round(w * this.image.naturalHeight / this.image.naturalWidth));
    if (w === this.width && h === this.height) return;
    this.width = this.canvas.width = w;
    this.height = this.canvas.height = h;
    this.blushLayer.width = w;
    this.blushLayer.height = h;
    if (this.context) {
      this.context.imageSmoothingEnabled = true;
      this.context.imageSmoothingQuality = 'high';
    }
    this.draw(this.breath);
  }
  destroy() {
    this.pause();
    this.destroyed = true;
    this.observer?.disconnect();
    this.resizer.disconnect();
    this.abort.abort();
    this.mesh?.destroy();
    this.blushLayer.remove();
    this.image.removeEventListener('load', this.onLoad);
    document.removeEventListener('visibilitychange', this.onVisibility);
    delete this.element.dataset.ready;
  }

  schedule() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = null;
    this.lastDraw = 0;
    if (!this.destroyed && this.ready && this.running && this.visible && !document.hidden) {
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  tick(time) {
    const elapsed = this.lastTime === null ? 0 : Math.min(time - this.lastTime, 250);
    this.elapsed += elapsed;
    this.lastTime = time;
    // Small integration steps keep the spring stable even on slower devices.
    let remaining = Math.min(elapsed / 1000, 0.1);
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 120);
      this.held = this.down ? this.held + dt : 0;
      this.touchBlush = (this.touchBlush || 0) + ((this.down ? 1 : 0) - (this.touchBlush || 0)) * (1 - Math.exp(-dt * (this.down ? 8 : 2.4)));
      if (this.touchBlush < .001) this.touchBlush = 0;
      this.rippleAge += dt;
      const k = this.reduced ? 180 : [145, 95,  65][this.softness], damping = this.reduced ? 29 : [14, 10, 8][this.softness];
      const gentle = this.reaction && ['pet', 'tickle'].includes(this.reaction.type);
      const target = this.down ? (gentle ? .10 : this.pressure * (.75 + .25 * (1 - Math.exp(-this.held * 3)))) : 0;
      this.velocity += ((target - this.press) * k - this.velocity * damping) * dt;
      this.press += this.velocity * dt;
      this.memory += ((this.down ? this.press * .23 : 0) - this.memory) * (this.down ? 4 : [5, 3, 1.8][this.softness]) * dt;
      for (let i = 0; i < 2; i++) {
        this.dragVelocity[i] += ((this.dragTarget[i] - this.drag[i]) * k - this.dragVelocity[i] * damping) * dt;
        this.drag[i] += this.dragVelocity[i] * dt;
      }
      remaining -= dt;
    }
    if (this.autoRelease && this.elapsed >= this.autoRelease) this.release();
    this.updatePose();
    if (time - this.lastDraw >= 1000 / this.options.fps) {
      this.lastDraw = time;
      if (this.pixelRatio !== Math.min(window.devicePixelRatio || 1, 2)) this.resize();
      this.breath = (0.5 - 0.5 * Math.cos(this.elapsed * Math.PI * 2 / this.options.period)) * (1 - Math.min(1, Math.max(0, this.press)) * 0.85);
      if (this.reduced) this.breath *= .2;
      this.draw(this.breath);
    }
    this.frame = requestAnimationFrame(this.tick);
  }

  updatePose() {
    const pose = this.pose = { squash: 0, lift: 0, tilt: 0, wave: 0 };
    this.greeting = restingGreeting();
    // Count idle time only after the current press or animation finishes.
    if (this.down || this.action || this.reaction) this.lastActivity = this.elapsed;
    if (this.reaction && !this.action) {
      const r = this.reaction;
      if (this.elapsed < r.until) {
        const strength = Math.min(1, (r.until-this.elapsed)/450);
        this.greeting = reactionPose(r.type, (this.elapsed-r.start)/1000, strength, this.reduced);
        pose.squash = this.greeting.squash;
        return;
      }
      this.reaction = null; this.say('');
    }
    if (!this.action) {
      this.greeting = sleepyPose(this.elapsed - (this.lastActivity ?? 0), this.reduced);
      if (this.greeting.blink > 0 && !this.element.dataset.sleeping) {
        this.element.dataset.sleeping = 'true';
        this.say('졸려… Zzz');
      }
      return;
    }
    const t = (this.elapsed - this.action.start) / 1000;
    const jumping = this.action.type === 'jump';
    if (jumping) {
      if (t < .28) pose.squash = .14 * Math.sin(t / .28 * Math.PI / 2);
      else if (t < .86) {
        const p = (t - .28) / .58;
        pose.lift = .155 * 4 * p * (1 - p);
        pose.squash = .14 * Math.exp(-p * 25) - .075 * Math.sin(Math.PI * p);
        pose.tilt = .022 * Math.sin(Math.PI * 2 * p);
      } else {
        if (!this.action.landed) { this.action.landed = true; this.emit('land'); }
        const p = t - .86;
        pose.squash = .16 * Math.exp(-p * 7) * Math.sin(p * 24);
      }
      if (t > 1.8) this.action = null;
    } else {
      this.greeting = greetingPose(t, this.reduced);
      pose.tilt = this.greeting.tilt;
      pose.squash = this.greeting.squash;
      if (t >= GREETING_DURATION) { this.action = null; this.say(''); }
    }
    if (this.reduced && jumping) for (const key of Object.keys(pose)) pose[key] *= .18;
  }

  deform(x, y, breath) {
    const mask = Math.exp(-(((x - 0.51) / 0.40) ** 4) - (((y - 0.55) / 0.60) ** 4));
    const chest = Math.exp(-(((y - 0.59) / 0.24) ** 4) - (((x - 0.51) / 0.27) ** 6));
    const bx = (x - 0.51) * this.options.expansion * breath * chest;
    const by = -this.options.lift * breath * mask * Math.max(0, Math.min(1, (0.89 - y) / 0.5));
    const [px, py] = this.point;
    const local = Math.exp(-((x - px) ** 2 + ((y - py) * 0.9) ** 2) / 0.05);
    const press = Math.max(-.25, Math.min(1.25, this.press + this.memory)) * (this.reduced ? .45 : 1);
    const drag = this.drag.map(value => Math.max(-.12, Math.min(.12, value)) * (this.reduced ? .5 : 1));
    const distance = Math.hypot(x - px, y - py);
    const wave = this.reduced ? 0 : this.ripple * .012 * Math.exp(-this.rippleAge * 5) * Math.sin(distance * 32 - this.rippleAge * 23);
    const sx = ((x - .51) * press * .27 + (px - x) * local * press * .20 + drag[0] * local + (x - px) * wave) * mask;
    const sy = ((.92 - y) * press * .17 + (py - y) * local * press * .20 + drag[1] * local + wave) * mask;
    const { squash, lift, tilt } = this.pose;
    // Broad envelopes move the existing pixels; no face, color or silhouette is redrawn.
    // Pin the image border while keeping the character's full body airborne.
    // Linear top ramp stays monotone even at the maximum jump height.
    const body = Math.max(0, Math.min(1, y / .34, (1 - y) / .055));
    const side = Math.max(0, Math.min(1, x / .2, (1 - x) / .16));
    const [gx, gy] = deformGreeting(x, y, this.greeting, this.image ? this.image.naturalWidth / this.image.naturalHeight : 1327 / 1186);
    return [(gx + bx + sx + ((x - .51) * squash - (y - .88) * tilt) * body * side) * this.width,
      (gy + by + sy + ((.92 - y) * squash - lift + (x - .51) * tilt) * body) * this.height];
  }

  draw(breath) {
    if (this.blushContext) {
      drawCheekBlush(this.blushContext, this, breath);
      drawSmileMouth(this.blushContext, this, breath);
    }
    if (this.mesh) { this.mesh.draw(this, breath); return; }
    const ctx = this.context;
    const { width: w, height: h } = this;
    ctx.clearRect(0, 0, w, h);
    if (!this.action && !this.greeting.blink && breath + Math.abs(this.press) + this.memory + Math.abs(this.drag[0]) + Math.abs(this.drag[1]) + this.ripple * Math.exp(-this.rippleAge * 5) < 0.001) {
      ctx.drawImage(this.texture, 0, 0, w, h); return;
    }
    const nx = this.action?.type === 'wave' ? 48 : 28, ny = this.action?.type === 'wave' ? 44 : 26;
    const points = Array.from({ length: ny + 1 }, (_, y) =>
      Array.from({ length: nx + 1 }, (_, x) => this.deform(x / nx, y / ny, breath)));
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const a = [x * w / nx, y * h / ny], b = [(x + 1) * w / nx, y * h / ny];
        const c = [x * w / nx, (y + 1) * h / ny], d = [(x + 1) * w / nx, (y + 1) * h / ny];
        this.triangle(a, b, c, points[y][x], points[y][x + 1], points[y + 1][x]);
        this.triangle(b, d, c, points[y][x + 1], points[y + 1][x + 1], points[y + 1][x]);
      }
    }
  }

  triangle(a, b, c, A, B, C) {
    const [ax, ay] = a, [bx, by] = b, [cx, cy] = c;
    const den = ax * (by - cy) + bx * (cy - ay) + cx * (ay - by);
    const m = (A[0] * (by - cy) + B[0] * (cy - ay) + C[0] * (ay - by)) / den;
    const n = (A[1] * (by - cy) + B[1] * (cy - ay) + C[1] * (ay - by)) / den;
    const o = (A[0] * (cx - bx) + B[0] * (ax - cx) + C[0] * (bx - ax)) / den;
    const q = (A[1] * (cx - bx) + B[1] * (ax - cx) + C[1] * (bx - ax)) / den;
    const ctx = this.context;
    ctx.save();
    ctx.beginPath();
    // Expand each clip edge by a physical pixel, including thin triangles.
    // This prevents the undeformed underlay peeking through around the silhouette.
    const ab = Math.hypot(A[0]-B[0], A[1]-B[1]);
    const bc = Math.hypot(B[0]-C[0], B[1]-C[1]);
    const ca = Math.hypot(C[0]-A[0], C[1]-A[1]);
    const perimeter = ab + bc + ca;
    const mx = (bc*A[0] + ca*B[0] + ab*C[0]) / perimeter;
    const my = (bc*A[1] + ca*B[1] + ab*C[1]) / perimeter;
    const radius = Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0])) / perimeter;
    const overlap = .75 / Math.max(.01, radius);
    [A, B, C].forEach((point, i) => {
      const x = point[0] + (point[0] - mx) * overlap, y = point[1] + (point[1] - my) * overlap;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.transform(m, n, o, q, A[0] - m * ax - o * ay, A[1] - n * ax - q * ay);
    ctx.drawImage(this.texture, 0, 0, this.width, this.height);
    ctx.restore();
  }
}
