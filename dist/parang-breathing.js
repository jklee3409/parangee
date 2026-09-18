/** Framework-independent high-DPI breathing and squishy renderer. */
export class ParangBreathing {
  constructor(element, { period = 4200, expansion = 0.075, lift = 0.012, fps = 30 } = {}) {
    if (!(element instanceof HTMLElement)) throw new TypeError('A model container is required.');
    if (![period, expansion, lift, fps].every(Number.isFinite) || period <= 0 || fps <= 0 || expansion < 0 || lift < 0) throw new RangeError('Invalid breathing options.');
    this.element = element;
    this.image = element.querySelector('img');
    this.canvas = element.querySelector('canvas');
    if (!this.image || !this.canvas) throw new TypeError('The container must contain an img and a canvas.');
    this.context = this.canvas.getContext('2d');
    this.options = { period, expansion, lift, fps };
    this.frame = 0;
    this.elapsed = 0;
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
    this.pixelRatio = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.abort = new AbortController();
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.tick = this.tick.bind(this);
    this.onVisibility = () => { this.release(); this.schedule(); };
    this.onLoad = () => {
      if (this.destroyed || !this.context || !this.image.naturalWidth) return;
      this.ready = true;
      this.resize();
      this.draw(0);
      this.element.dataset.ready = 'true';
      this.schedule();
    };
    this.image.addEventListener('load', this.onLoad);
    document.addEventListener('visibilitychange', this.onVisibility);
    const listen = (target, name, fn) => target.addEventListener(name, fn, { signal: this.abort.signal });
    const position = (e) => { const r = element.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    listen(element, 'pointerdown', (e) => {
      if (this.pointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const [x, y] = position(e);
      if (x < 0.24 || x > 0.86 || y < 0.19 || y > 0.94) return;
      e.preventDefault();
      element.focus({ preventScroll: true });
      this.pointer = e.pointerId;
      element.setPointerCapture(e.pointerId);
      this.squeeze(x, y);
    });
    listen(element, 'pointermove', (e) => {
      if (!this.down || this.pointer !== e.pointerId) return;
      const p = position(e);
      this.dragTarget = p.map((v, i) => Math.max(-0.16, Math.min(0.16, (v - this.point[i]) * 0.8)));
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(element, name, (e) => { if (e.pointerId === this.pointer) this.release(); });
    }
    listen(element, 'keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) this.squeeze(0.51, 0.53); }
    });
    listen(element, 'keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.release(); } });
    listen(element, 'blur', () => this.release());
    listen(window, 'blur', () => this.release());
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

  start() { if (!this.destroyed) { this.running = true; this.schedule(); } }
  pause() { this.release(); this.running = false; this.schedule(); }
  squeeze(x = 0.51, y = 0.53) {
    if (!this.ready || this.destroyed || !this.running) return;
    this.point = [x, y];
    this.down = true;
    this.dragTarget = [0, 0];
    this.element.dataset.pressed = 'true';
  }
  release() {
    this.down = false;
    this.pointer = null;
    this.dragTarget = [0, 0];
    delete this.element.dataset.pressed;
  }
  resize() {
    if (!this.ready || this.destroyed) return;
    const bounds = this.element.getBoundingClientRect();
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.min(2048, Math.round(bounds.width * this.pixelRatio)));
    const h = Math.max(1, Math.round(w * this.image.naturalHeight / this.image.naturalWidth));
    if (w === this.width && h === this.height) return;
    this.width = this.canvas.width = w;
    this.height = this.canvas.height = h;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
    this.draw(this.breath);
  }
  destroy() {
    this.pause();
    this.destroyed = true;
    this.observer?.disconnect();
    this.resizer.disconnect();
    this.abort.abort();
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
      const k = this.reduced ? 200 : 110, damping = this.reduced ? 30 : 13;
      this.velocity += ((Number(this.down) - this.press) * k - this.velocity * damping) * dt;
      this.press += this.velocity * dt;
      for (let i = 0; i < 2; i++) {
        this.dragVelocity[i] += ((this.dragTarget[i] - this.drag[i]) * k - this.dragVelocity[i] * damping) * dt;
        this.drag[i] += this.dragVelocity[i] * dt;
      }
      remaining -= dt;
    }
    if (time - this.lastDraw >= 1000 / this.options.fps) {
      this.lastDraw = time;
      if (this.pixelRatio !== Math.min(window.devicePixelRatio || 1, 3)) this.resize();
      this.breath = (0.5 - 0.5 * Math.cos(this.elapsed * Math.PI * 2 / this.options.period)) * (1 - Math.min(1, Math.max(0, this.press)) * 0.85);
      this.draw(this.breath);
    }
    this.frame = requestAnimationFrame(this.tick);
  }

  deform(x, y, breath) {
    const mask = Math.exp(-(((x - 0.51) / 0.27) ** 6) - (((y - 0.55) / 0.40) ** 6));
    const chest = Math.exp(-(((y - 0.59) / 0.24) ** 4) - (((x - 0.51) / 0.27) ** 6));
    const bx = (x - 0.51) * this.options.expansion * breath * chest;
    const by = -this.options.lift * breath * mask * Math.max(0, Math.min(1, (0.89 - y) / 0.5));
    const [px, py] = this.point;
    const local = Math.exp(-((x - px) ** 2 + ((y - py) * 0.9) ** 2) / 0.025);
    const sx = ((x - 0.51) * this.press * 0.2 + (px - x) * local * this.press * 0.32 + this.drag[0] * local) * mask;
    const sy = ((0.9 - y) * this.press * 0.13 + (py - y) * local * this.press * 0.32 + this.drag[1] * local) * mask;
    return [(x + bx + sx) * this.width, (y + by + sy) * this.height];
  }

  draw(breath) {
    const ctx = this.context;
    const { width: w, height: h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.image, 0, 0, w, h);
    if (breath + Math.abs(this.press) + Math.abs(this.drag[0]) + Math.abs(this.drag[1]) < 0.001) return;
    const nx = 28, ny = 26;
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
    const mx = (A[0] + B[0] + C[0]) / 3, my = (A[1] + B[1] + C[1]) / 3;
    [A, B, C].forEach((point, i) => {
      const x = point[0] + (point[0] - mx) * 0.012, y = point[1] + (point[1] - my) * 0.012;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.transform(m, n, o, q, A[0] - m * ax - o * ay, A[1] - n * ax - q * ay);
    ctx.drawImage(this.image, 0, 0, this.width, this.height);
    ctx.restore();
  }
}
