const page = document.getElementById('page');

function enhancePress(anchor) {
  let timer = 0;
  let origin = null, cancelled = false;
  const release = () => anchor.classList.remove('pressed');
  anchor.addEventListener('pointerdown', e => { if (e.button === 0) { origin = [e.clientX, e.clientY]; cancelled = false; anchor.classList.add('pressed'); } });
  anchor.addEventListener('pointermove', e => { if (origin && Math.hypot(e.clientX - origin[0], e.clientY - origin[1]) > 12) { cancelled = true; release(); } });
  anchor.addEventListener('pointercancel', () => { origin = null; cancelled = true; release(); });
  anchor.addEventListener('pointerleave', e => { if (e.buttons) { cancelled = true; release(); } });
  anchor.addEventListener('pointerup', () => { origin = null; release(); });
  anchor.addEventListener('blur', release);
  anchor.addEventListener('click', e => {
    if (cancelled && e.detail > 0) { e.preventDefault(); release(); return; }
    if (!e.detail || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || anchor.target === '_blank') return;
    e.preventDefault(); clearTimeout(timer); release();
    // Let the card spring back before leaving. The anchor still handles
    // keyboard, copy-link, modifier clicks, and the plain HTML fallback.
    timer = setTimeout(() => { location.assign(anchor.href); }, 120);
  });
}

// Content is generated from links.json at build time so file previews and
// JavaScript-free browsers use exactly the same working anchors.
page.querySelectorAll('a').forEach(enhancePress);
page.dataset.linksReady = 'true';
window.addEventListener('pageshow', () => page.querySelectorAll('.pressed').forEach(a => a.classList.remove('pressed')));

// Keep the desktop device at the original 402×874 design scale, fitting short
// laptop windows without changing the phone layout or shrinking mobile pages.
function fitDesktopDevice() {
  const scale = Math.min(1, Math.max(.5, (window.innerHeight - 64) / 895));
  document.documentElement.style.setProperty('--device-scale', String(scale));
}
fitDesktopDevice();
window.addEventListener('resize', fitDesktopDevice);
