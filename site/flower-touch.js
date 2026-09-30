(() => {
  'use strict';
  const page = document.querySelector('.page');
  const hero = page?.querySelector('.hero');
  if (!hero) return;

  const photo = new Image();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'flower-overlay';
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  page.insertBefore(canvas, hero);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { canvas.remove(); return; }
  const flowers = [
    { name: 'Pink', x: 365, y: 205, rx: 182, ry: 157, root: 750 },
    { name: 'Blue', x: 704, y: 323, rx: 159, ry: 162, root: 735 },
    { name: 'Cream', x: 295, y: 505, rx: 173, ry: 150, root: 752 },
    { name: 'Coral', x: 632, y: 647, rx: 173, ry: 145, root: 832 }
  ].map(f => ({ ...f, dx: 0, dy: 0, vx: 0, vy: 0, tx: 0, ty: 0 }));
  let ready = false, frame = 0, last = 0, active = null, scale = 1;
  let sourceWidth = 941, sourceHeight = 1672;

  // Keep the original photograph visible until a complete deformed frame exists.
  // The overlay replaces the whole photo, so moving petals have no static duplicate.
  function size() {
    if (!ready) return;
    scale = page.clientWidth / sourceWidth;
    const ratio = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.round(page.clientWidth * ratio);
    canvas.height = Math.round(canvas.width * sourceHeight / sourceWidth);
    canvas.style.aspectRatio = `${sourceWidth} / ${sourceHeight}`;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (const f of flowers) {
      f.button.style.top = `${(f.y - f.ry) * scale}px`;
      f.button.style.height = `${2 * f.ry * scale}px`;
    }
    if (!canvas.hidden) render();
  }

  function displaced(x, y) {
    let dx = 0, dy = 0;
    for (const f of flowers) {
      if (Math.abs(f.dx) + Math.abs(f.dy) < .001) continue;
      const nx = (x - f.x) / (f.rx * 1.45);
      const top = f.y - f.ry * 1.35;
      if (Math.abs(nx) >= 1 || y <= top || y >= f.root) continue;
      const ny = (y - f.y) / (y < f.y ? f.y - top : f.root - f.y);
      // A compact smooth field moves the head most, tapering to exactly zero
      // around the patch and at the flower's planted root.
      const weight = Math.pow(1 - nx * nx, 2) * Math.pow(1 - ny * ny, 2);
      dx += f.dx * weight;
      dy += f.dy * weight;
    }
    return [x + dx, y + dy];
  }

  function triangle(a, b, c, da, db, dc) {
    const det = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const m11 = ((db[0] - da[0]) * (c[1] - a[1]) - (dc[0] - da[0]) * (b[1] - a[1])) / det;
    const m12 = ((db[1] - da[1]) * (c[1] - a[1]) - (dc[1] - da[1]) * (b[1] - a[1])) / det;
    const m21 = ((dc[0] - da[0]) * (b[0] - a[0]) - (db[0] - da[0]) * (c[0] - a[0])) / det;
    const m22 = ((dc[1] - da[1]) * (b[0] - a[0]) - (db[1] - da[1]) * (c[0] - a[0])) / det;
    ctx.save();
    // A fraction of a source pixel overlap prevents antialiased mesh seams.
    const center = [(da[0] + db[0] + dc[0]) / 3, (da[1] + db[1] + dc[1]) / 3];
    ctx.beginPath();
    [da, db, dc].forEach((p, i) => {
      const ox = p[0] - center[0], oy = p[1] - center[1];
      const length = Math.hypot(ox, oy) || 1;
      const x = p[0] + ox / length * .45, y = p[1] + oy / length * .45;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.clip();
    ctx.transform(m11, m12, m21, m22, da[0] - m11 * a[0] - m21 * a[1], da[1] - m12 * a[0] - m22 * a[1]);
    // Restrict sampling to this cell instead of repeatedly drawing the full photo.
    const x = Math.max(0, Math.min(a[0], b[0], c[0]) - 2);
    const y = Math.max(0, Math.min(a[1], b[1], c[1]) - 2);
    const w = Math.min(sourceWidth - x, Math.max(a[0], b[0], c[0]) - x + 2);
    const h = Math.min(sourceHeight - y, Math.max(a[1], b[1], c[1]) - y + 2);
    ctx.drawImage(photo, x, y, w, h, x, y, w, h);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(canvas.width / sourceWidth, 0, 0, canvas.height / sourceHeight, 0, 0);
    ctx.drawImage(photo, 0, 0);
    const moving = flowers.filter(f => Math.abs(f.dx) + Math.abs(f.dy) > .001);
    if (!moving.length) return;
    const left = Math.max(0, Math.floor(Math.min(...moving.map(f => f.x - f.rx * 1.45)) / 32) * 32);
    const right = Math.min(sourceWidth, Math.ceil(Math.max(...moving.map(f => f.x + f.rx * 1.45)) / 32) * 32);
    const top = Math.max(0, Math.floor(Math.min(...moving.map(f => f.y - f.ry * 1.35)) / 32) * 32);
    const bottom = Math.min(sourceHeight, Math.ceil(Math.max(...moving.map(f => f.root)) / 32) * 32);
    for (let y = top; y < bottom; y += 32) for (let x = left; x < right; x += 32) {
      const a = [x, y], b = [Math.min(x + 32, right), y];
      const c = [b[0], Math.min(y + 32, bottom)], d = [x, c[1]];
      const da = displaced(...a), db = displaced(...b), dc = displaced(...c), dd = displaced(...d);
      triangle(a, b, c, da, db, dc); triangle(a, c, d, da, dc, dd);
    }
  }

  function tick(time) {
    frame = 0;
    const dt = Math.min((time - (last || time - 16)) / 1000, .032);
    last = time;
    let moving = false;
    for (const f of flowers) {
      if (reduced.matches) { f.dx = f.tx; f.dy = f.ty; f.vx = f.vy = 0; }
      else {
        f.vx += ((f.tx - f.dx) * 220 - f.vx * 23) * dt;
        f.vy += ((f.ty - f.dy) * 220 - f.vy * 23) * dt;
        f.dx += f.vx * dt; f.dy += f.vy * dt;
      }
      if (Math.abs(f.dx - f.tx) + Math.abs(f.dy - f.ty) + Math.abs(f.vx) + Math.abs(f.vy) > .08) moving = true;
    }
    const offset = flowers.some(f => Math.abs(f.dx) + Math.abs(f.dy) > .025);
    if (offset) { render(); canvas.hidden = false; }
    else canvas.hidden = true;
    if (moving) frame = requestAnimationFrame(tick);
    else last = 0;
  }
  function wake() { if (ready && !frame) frame = requestAnimationFrame(tick); }
  function release(allowTap = false) {
    if (!active) return;
    if (allowTap === true && !reduced.matches && Math.abs(active.f.dx) + Math.abs(active.f.dy) < .05) {
      active.f.vx = 75 / scale;
      active.f.vy = -25 / scale;
    }
    active.f.tx = active.f.ty = 0;
    active.f.button.classList.remove('is-dragging');
    active = null; wake();
  }
  for (const f of flowers) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'flower-hit';
    button.setAttribute('aria-label', `Gently bend the ${f.name.toLowerCase()} flower`);
    button.style.left = `${(f.x - f.rx) / sourceWidth * 100}%`;
    button.style.width = `${f.rx * 2 / sourceWidth * 100}%`;
    button.style.touchAction = 'none';
    button.disabled = true;
    f.button = button; hero.appendChild(button);
    button.addEventListener('pointerdown', e => {
      if (!ready || e.button !== 0 || active) return;
      active = { f, id: e.pointerId, x: e.clientX, y: e.clientY };
      button.setPointerCapture(e.pointerId); button.classList.add('is-dragging');
      f.tx = (reduced.matches ? 1 : 3) / scale; f.ty = -1 / scale;
      wake();
    });
    button.addEventListener('pointermove', e => {
      if (!active || active.id !== e.pointerId || active.f !== f) return;
      const dx = e.clientX - active.x, dy = e.clientY - active.y;
      const limit = reduced.matches ? 2 : 8;
      const distance = Math.hypot(dx, dy);
      const factor = distance ? Math.min(distance * .32, limit) / distance / scale : 0;
      f.tx = dx * factor; f.ty = dy * factor; wake();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, e => {
      if (active?.id === e.pointerId && active.f === f) release(type === 'pointerup');
    });
    button.addEventListener('click', e => {
      if (e.detail !== 0 || !ready) return;
      if (reduced.matches) {
        f.tx = 1 / scale; wake();
        setTimeout(() => { f.tx = 0; wake(); }, 100);
      } else { f.vx = 95 / scale; f.vy = -35 / scale; wake(); }
    });
  }
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  new ResizeObserver(size).observe(page);
  photo.onload = () => {
    sourceWidth = photo.naturalWidth; sourceHeight = photo.naturalHeight;
    ready = true; size(); flowers.forEach(f => { f.button.disabled = false; });
    page.dataset.flowersReady = 'true';
  };
  photo.onerror = () => { flowers.forEach(f => f.button.remove()); canvas.remove(); };
  photo.src = new URL('./assets/scene.jpg', document.baseURI).href;
})();
