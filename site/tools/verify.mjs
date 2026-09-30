// Run from site/: npm test (source checks), npm run verify (Chrome and screenshots).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'shots');
const sourceOnly = process.argv.includes('--static');
const config = JSON.parse(await readFile(resolve(root, 'links.json'), 'utf8'));
const expected = [
  ...config.rows.filter(x => x.href?.trim()).map(x => ({ href: x.href, label: x.title, kind: 'row' })),
  ...config.icons.filter(x => x.href?.trim()).map(x => ({ href: x.href, label: x.name, kind: 'icon' })),
];
const requiredScreenshots = ['first-load.png', 'button-mid-press.png', 'flower-bent.png', 'desktop.png', 'narrow-phone.png', 'keyboard-focus.png'];
const report = { generatedAt: new Date().toISOString(), mode: sourceOnly ? 'source' : 'browser and source', checks: [], errors: [], screenshots: [], requiredScreenshots, measurements: {}, runtime: { completed: false, status: sourceOnly ? 'not run (--static)' : 'not started' } };
const assert = (yes, message) => { if (!yes) throw new Error(message); };
async function check(name, action) {
  const start = performance.now();
  try {
    const detail = await action();
    report.checks.push({ name, passed: true, durationMs: Math.round(performance.now() - start), detail });
    console.log('PASS ' + name);
  } catch (error) {
    report.checks.push({ name, passed: false, durationMs: Math.round(performance.now() - start), detail: error.stack || error.message });
    console.error('FAIL ' + name + ': ' + error.message.split('\n')[0]);
  }
}
const decode = value => value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, entity => {
  const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
  const key = entity.toLowerCase();
  if (key in named) return named[key];
  const hex = key.startsWith('&#x');
  return String.fromCodePoint(parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10));
});
const plain = value => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
function attrs(value) {
  return Object.fromEntries([...value.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4])]));
}
function verifyLinks(items) {
  assert(items.length === expected.length, 'Expected ' + expected.length + ' anchors, found ' + items.length);
  items.forEach((item, i) => {
    assert(item.href === expected[i].href, 'Link ' + i + ' href differs from config');
    assert(item.label === expected[i].label, 'Link ' + i + ' label differs from config');
    assert(item.kind === expected[i].kind, 'Link ' + i + ' class differs from config');
  });
  return items;
}
function staticLinks(html) {
  const items = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(([, raw, inside]) => {
    const at = attrs(raw);
    const label = inside.match(/<[^>]*class=["'][^"']*\blabel\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    const kind = /\brow\b/.test(at.class || '') ? 'row' : /\bicon\b/.test(at.class || '') ? 'icon' : 'unknown';
    return { href: at.href, label: at['aria-label'] || at.title || plain(label?.[1] || inside), kind };
  });
  return verifyLinks(items);
}
async function sourceChecks() {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const css = await readFile(resolve(root, 'style.css'), 'utf8');
  await check('Generated HTML matches configured links and order', () => staticLinks(html));
  await check('Name, metadata, and removed content', () => {
    assert(plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') === config.name, 'Title differs from config');
    assert(plain(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') === config.name, 'Visible name differs from config');
    const metas = [...html.matchAll(/<meta\b([^>]*)>/gi)].map(([, raw]) => attrs(raw));
    for (const [key, value] of [['description', config.role], ['og:title', config.name], ['og:description', config.role]]) {
      assert(metas.some(meta => (meta.name === key || meta.property === key) && meta.content === value), key + ' differs from config');
    }
    assert(!/<canvas\b/i.test(html), 'Canvas found');
    assert(!/\bportfolio\b|ezraseal\.dev/i.test(html), 'Portfolio found');
    assert(!/class=["'][^"']*\bpicture\b|class=["'][^"']*\bavatar\b/i.test(html), 'Avatar placeholder found');
    return { name: config.name, role: config.role, canvasCount: 0 };
  });
  await check('Flower icons and social image match the published metadata', async () => {
    const metas = [...html.matchAll(/<meta\b([^>]*)>/gi)].map(([, raw]) => attrs(raw));
    const value = key => metas.find(meta => meta.name === key || meta.property === key)?.content;
    const image = `${config.plannedUrl}/assets/share-card.png`;
    assert(value('og:image') === image && value('twitter:image') === image, 'Social previews do not use the share card');
    assert(value('twitter:card') === 'summary_large_image', 'Large social card missing');
    assert(value('og:image:width') === '1200' && value('og:image:height') === '630', 'Social image dimensions missing');
    assert(value('og:image:alt') && value('twitter:image:alt'), 'Social image description missing');
    const dimensions = async (file, width, height) => {
      const png = await readFile(resolve(root, 'assets', file));
      assert(png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `${file} is not PNG`);
      assert(png.readUInt32BE(16) === width && png.readUInt32BE(20) === height, `${file} has the wrong dimensions`);
    };
    await dimensions('share-card.png', 1200, 630);
    for (const [file, size] of [['flower-32.png',32],['apple-touch-icon.png',180],['flower-192.png',192],['flower-512.png',512]]) await dimensions(file, size, size);
    assert(/rel="icon" href="assets\/flower-32\.png"/.test(html), 'Browser favicon missing');
    assert(/rel="apple-touch-icon" href="assets\/apple-touch-icon\.png"/.test(html), 'Apple touch icon missing');
    const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'));
    assert(manifest.icons.length === 2 && manifest.icons.every(icon => icon.src.startsWith('assets/flower-')), 'Manifest icons missing');
    return { image, iconSizes: [32, 180, 192, 512] };
  });
  await check('Scene, fonts, styles and scripts are local', async () => {
    const refs = new Set(['assets/scene.jpg']);
    for (const [, tag, raw] of html.matchAll(/<(script|link|img)\b([^>]*)>/gi)) {
      const at = attrs(raw);
      if (at.src) refs.add(at.src);
      if (tag.toLowerCase() === 'link' && /^(?:stylesheet|icon|apple-touch-icon|manifest|preload)$/i.test(at.rel || '') && at.href) refs.add(at.href);
    }
    for (const [, path] of css.matchAll(/url\(\s*["']?([^)'"]+)["']?\s*\)/gi)) refs.add(path);
    for (const ref of refs) {
      assert(!/^(?:https?:)?\/\//i.test(ref), 'Remote asset: ' + ref);
      const file = resolve(root, ref);
      assert(file.startsWith(root + sep), 'Asset escapes site: ' + ref);
      assert((await stat(file)).isFile(), 'Missing asset: ' + ref);
    }
    const scene = await readFile(resolve(root, 'assets/scene.jpg'));
    assert(scene.length > 1000 && scene[0] === 255 && scene[1] === 216, 'scene.jpg is not a JPEG');
    assert(css.includes('scene.jpg'), 'CSS does not use scene.jpg');
    return { assets: [...refs], sceneBytes: scene.length };
  });
  await check('120ms release, reduced motion, and no runtime fetch', async () => {
    assert(/120ms|\.12s/.test(css) && /\.pressed|:active/.test(css), 'Press styles missing');
    assert(/prefers-reduced-motion/.test(css), 'Reduced-motion style missing');
    const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map(([, raw]) => attrs(raw).src).filter(Boolean);
    for (const script of scripts) {
      const source = await readFile(resolve(root, script), 'utf8');
      assert(!/\bfetch\s*\(/.test(source), script + ' uses runtime fetch');
    }
    return { scripts };
  });
}
async function startServer() {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (name === '/favicon.ico') { response.writeHead(204).end(); return; }
      const file = resolve(root, '.' + (name === '/' ? '/index.html' : name));
      if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      const content = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(content);
    } catch { response.writeHead(404).end('Not found'); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}
function observe(page, scenario) {
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ scenario, type: 'console', text: message.text() }); });
  page.on('pageerror', error => report.errors.push({ scenario, type: 'pageerror', text: error.message }));
}
async function openPage(browser, scenario, url, options = {}, setup) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, ...options });
  if (setup) await setup(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  observe(page, scenario);
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}
async function browserLinks(page) {
  return verifyLinks(await page.locator('a[href]').evaluateAll(anchors => anchors.map(a => ({
    href: a.getAttribute('href'),
    label: (a.getAttribute('aria-label') || a.getAttribute('title') || a.querySelector('.label')?.textContent || a.textContent).replace(/\s+/g, ' ').trim(),
    kind: a.classList.contains('row') ? 'row' : a.classList.contains('icon') ? 'icon' : 'unknown',
  }))));
}
async function state(page, width, interactive = true) {
  if (interactive) await page.waitForFunction(() => document.getElementById('page')?.dataset.flowersReady === 'true');
  const result = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    canvases: [...document.querySelectorAll('canvas')].map(canvas => ({ className: canvas.className, hidden: canvas.hidden })),
    flowerButtons: [...document.querySelectorAll('button.flower-hit')].map(button => { const b = button.getBoundingClientRect(); return { disabled: button.disabled, width: b.width, height: b.height }; }),
    avatarCount: document.querySelectorAll('.picture, .avatar, .profile img').length,
    name: document.querySelector('h1')?.textContent.trim(),
    fontStatus: document.fonts.status,
    headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
    anchors: [...document.querySelectorAll('a[href]')].map(a => { const b = a.getBoundingClientRect(); return { x: b.x, right: b.right, width: b.width, height: b.height }; }),
  }));
  assert(result.width === width && result.scrollWidth <= width, 'Horizontal overflow at ' + width + 'px');
  assert(result.avatarCount === 0, 'Avatar found');
  if (interactive) {
    assert(result.canvases.length === 1 && result.canvases[0].className === 'flower-overlay', 'Expected only the flower photo overlay canvas');
    assert(result.canvases[0].hidden, 'Flower overlay is active at rest');
    assert(result.flowerButtons.length === 4 && result.flowerButtons.every(b => !b.disabled && b.width >= 44 && b.height >= 44), 'Four usable 44px flower controls are required');
  } else assert(result.canvases.length === 0 && result.flowerButtons.length === 0, 'No-JavaScript view must keep the unmodified static photo');
  assert(result.name === config.name && result.fontStatus === 'loaded', 'Name or fonts missing');
  assert(result.anchors.every(a => a.x >= 0 && a.right <= width + .5 && a.width >= 44 && a.height >= 44), 'Link overflow or target under 44px at ' + width + 'px');
  return result;
}
async function scene(page) {
  const result = await page.evaluate(async () => {
    const image = new Image();
    image.src = new URL('assets/scene.jpg', document.baseURI).href;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, background: getComputedStyle(document.querySelector('.page'), '::before').backgroundImage };
  });
  assert(result.width > 100 && result.height > 100 && result.background.includes('scene.jpg'), 'Static scene missing or undecodable');
  return result;
}
async function shot(page, name, width, height, dpr) {
  const buffer = await page.screenshot({ path: resolve(shots, name), fullPage: false, animations: 'allow', scale: 'device' });
  const size = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  assert(size.width === width * dpr && size.height === height * dpr, name + ' has wrong dimensions');
  report.screenshots.push({ name, ...size, cssViewport: width + '×' + height, dpr });
  return size;
}
async function idleFrames(page, durationMs = 250) {
  return page.evaluate(async duration => {
    const original = window.requestAnimationFrame;
    let requested = 0;
    window.requestAnimationFrame = callback => { requested++; return original(callback); };
    try { await new Promise(resolve => setTimeout(resolve, duration)); }
    finally { window.requestAnimationFrame = original; }
    return { requested, overlayHidden: document.querySelector('canvas.flower-overlay')?.hidden };
  }, durationMs);
}
async function pixelDifference(page, before, after) {
  return page.evaluate(async images => {
    const decodePng = source => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = reject;
      image.src = 'data:image/png;base64,' + source;
    });
    const [first, second] = await Promise.all(images.map(decodePng));
    const canvas = document.createElement('canvas'); canvas.width = first.width; canvas.height = first.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(first, 0, 0); const a = context.getImageData(0, 0, canvas.width, canvas.height).data;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(second, 0, 0); const b = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let maximum = 0, total = 0;
    for (let i = 0; i < a.length; i += 4) for (let channel = 0; channel < 3; channel++) {
      const difference = Math.abs(a[i + channel] - b[i + channel]);
      maximum = Math.max(maximum, difference); total += difference;
    }
    return { maxChannelDifference: maximum, meanChannelDifference: +(total / (a.length * .75)).toFixed(3) };
  }, [before.toString('base64'), after.toString('base64')]);
}
async function navigate(browser, url, mode) {
  let requestedAt;
  const session = await openPage(browser, mode + ' navigation', url, {}, async context => {
    await context.route('https://**/*', async route => { requestedAt = performance.now(); await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>QA destination</title>' }); });
  });
  try {
    const anchor = session.page.locator('a.row').first();
    if (mode === 'keyboard') await anchor.focus();
    const start = performance.now();
    if (mode === 'keyboard') await session.page.keyboard.press('Enter'); else await anchor.click();
    await session.page.waitForURL(value => value.href === new URL(expected[0].href).href);
    const elapsed = +(requestedAt - start).toFixed(1);
    assert(Number.isFinite(elapsed), 'Destination not requested');
    if (mode === 'click') assert(elapsed >= 100, 'Click navigated before tactile press: ' + elapsed + 'ms');
    return { href: expected[0].href, activationToRequestMs: elapsed, intercepted: true };
  } finally { await session.context.close(); }
}
async function browserChecks(browser, url) {
  const main = await openPage(browser, 'phone', url);
  try {
    const page = main.page;
    await check('Phone links, static scene, fonts, target size and no overflow', async () => ({ links: await browserLinks(page), state: await state(page, 402), scene: await scene(page) }));
    await check('First-load 402×874 DPR3 screenshot', () => shot(page, 'first-load.png', 402, 874, 3));
    await check('Flowers stay still at rest and bend only while dragged', async () => {
      const overlay = page.locator('canvas.flower-overlay');
      const before = await page.screenshot({ animations: 'allow' });
      const idle = await idleFrames(page);
      assert(idle.requested === 0 && idle.overlayHidden, 'Flower renderer schedules frames while idle');
      const contentBefore = await page.screenshot({ clip: { x: 0, y: 550, width: 402, height: 324 }, animations: 'allow' });
      const control = page.locator('button.flower-hit').first(), box = await control.boundingBox();
      assert(box, 'First flower hit area has no bounds');
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      let contentDifference;
      await page.mouse.move(x, y); await page.mouse.down();
      try {
        await page.mouse.move(x + 42, y + 20, { steps: 10 });
        await page.waitForFunction(() => !document.querySelector('canvas.flower-overlay').hidden);
        const bent = await page.screenshot({ animations: 'allow' });
        assert(!before.equals(bent), 'Flower drag leaves pixels unchanged');
        const contentBent = await page.screenshot({ clip: { x: 0, y: 550, width: 402, height: 324 }, animations: 'allow' });
        contentDifference = await pixelDifference(page, contentBefore, contentBent);
        assert(contentDifference.maxChannelDifference <= 8 && contentDifference.meanChannelDifference < .7, 'Dragging a flower visibly changes the link/footer area: ' + JSON.stringify(contentDifference));
        await shot(page, 'flower-bent.png', 402, 874, 3);
      } finally { await page.mouse.up(); }
      await page.waitForFunction(() => document.querySelector('canvas.flower-overlay').hidden, null, { timeout: 5000 });
      return { flowerButtons: 4, idle, bentPixelsDiffer: true, contentDifference, returnedToStaticPhoto: true };
    });
    await check('Pointer press sinks, then drag away restores', async () => {
      const anchor = page.locator('a.row').first(), box = await anchor.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.waitForTimeout(160);
      const rest = await anchor.evaluate(a => ({ transform: getComputedStyle(a).transform, shadow: getComputedStyle(a).boxShadow }));
      await page.mouse.down();
      try {
        await page.waitForTimeout(145);
        await page.waitForFunction(resting => {
          const anchor = document.querySelector('a.row');
          const style = getComputedStyle(anchor);
          return anchor.classList.contains('pressed') && style.transform !== resting.transform && style.boxShadow !== resting.shadow && style.boxShadow.includes('inset');
        }, rest, { timeout: 1500 });
        const pressed = await anchor.evaluate(a => ({ transform: getComputedStyle(a).transform, shadow: getComputedStyle(a).boxShadow, classPressed: a.classList.contains('pressed') }));
        const target = await page.evaluate(({ x, y }) => ({ tag: document.elementFromPoint(x, y)?.tagName, className: document.elementFromPoint(x, y)?.getAttribute('class') }), { x, y });
        assert(pressed.transform !== rest.transform && pressed.shadow !== rest.shadow && pressed.shadow.includes('inset'), 'Press does not sink: ' + JSON.stringify({ rest, pressed, target }));
        await shot(page, 'button-mid-press.png', 402, 874, 3);
        await page.mouse.move(5, 850, { steps: 8 }); await page.waitForTimeout(150);
        assert(!await anchor.evaluate(a => a.classList.contains('pressed')), 'Drag outside leaves pressed class');
        return { rest, pressed, restored: true };
      } finally { await page.mouse.up(); }
    });
    await check('pointercancel clears press', async () => {
      const anchor = page.locator('a.row').first(), box = await anchor.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      try {
        await anchor.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
        assert(!await anchor.evaluate(a => a.classList.contains('pressed')), 'pointercancel left link pressed');
      } finally { await page.mouse.move(5, 850); await page.mouse.up(); }
    });
    await check('Flower pointercancel releases the photo deformation', async () => {
      const control = page.locator('button.flower-hit').first(), box = await control.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      try {
        await page.mouse.move(x + 40, y + 15, { steps: 8 });
        await control.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
        await page.waitForFunction(() => document.querySelector('canvas.flower-overlay').hidden, null, { timeout: 5000 });
      } finally { await page.mouse.up(); }
      return { settled: true };
    });
    await check('Keyboard order and visible focus', async () => {
      const first = page.locator('a[href]').first();
      await page.locator('button.flower-hit').first().focus();
      const flowers = [];
      for (let i = 0; i < 4; i++) {
        flowers.push(await page.evaluate(() => document.activeElement?.classList.contains('flower-hit')));
        await page.keyboard.press('Tab');
      }
      assert(flowers.every(Boolean) && await first.evaluate(a => a === document.activeElement), 'Flower controls do not precede links in keyboard order');
      const order = [];
      for (let i = 0; i < expected.length; i++) {
        order.push(await page.evaluate(() => document.activeElement?.getAttribute('href')));
        if (i < expected.length - 1) await page.keyboard.press('Tab');
      }
      assert(order.every((href, i) => href === expected[i].href), 'Keyboard order differs from config');
      await page.keyboard.press('Tab'); // wrap naturally to the first link
      await first.focus();
      const focus = await first.evaluate(a => ({ outline: getComputedStyle(a).outlineStyle, width: getComputedStyle(a).outlineWidth }));
      assert(focus.outline !== 'none' && parseFloat(focus.width) > 0, 'Focus ring missing');
      await shot(page, 'keyboard-focus.png', 402, 874, 3);
      return { flowerControls: flowers.length, order, focus };
    });
    await page.evaluate(() => document.activeElement?.blur());
    for (const size of [{ width: 1280, height: 1100, dpr: 3, name: 'desktop.png' }, { width: 320, height: 700, dpr: 3, name: 'narrow-phone.png' }]) {
      await check(size.width + 'px layout and screenshot', async () => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.evaluate(() => document.fonts.ready);
        const detail = await state(page, size.width);
        await browserLinks(page);
        if (size.width === 1280) {
          const visible = await page.evaluate(() => {
            const frame = document.querySelector('.page').getBoundingClientRect();
            return { frameBottom: frame.bottom, viewportBottom: innerHeight, links: [...document.querySelectorAll('a[href]')].map(a => a.getBoundingClientRect().bottom) };
          });
          assert(visible.links.every(bottom => bottom <= visible.frameBottom && bottom <= visible.viewportBottom), 'Desktop frame clips a row or social link: ' + JSON.stringify(visible));
          detail.desktopVerticalBounds = visible;
        }
        await shot(page, size.name, size.width, size.height, size.dpr);
        return detail;
      });
    }
  } finally { await main.context.close(); }
  await check('Released card springs back before navigation', async () => {
    const session = await openPage(browser, 'release animation', url, {}, async context => {
      await context.route('https://**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>QA destination</title>' }));
    });
    try {
      const { page } = session;
      const anchor = page.locator('a.row').first(), box = await anchor.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.waitForTimeout(180);
      await page.mouse.down();
      await page.waitForTimeout(100);
      assert(await anchor.evaluate(a => a.classList.contains('pressed')), 'Card did not press in');
      await page.mouse.up();
      const released = await anchor.evaluate(a => ({ pressed: a.classList.contains('pressed'), timing: getComputedStyle(a).transitionTimingFunction }));
      assert(!released.pressed, 'Card stays depressed after release: ' + JSON.stringify(released));
      assert(released.timing.includes('1.4'), 'Release does not use spring timing: ' + released.timing);
      await page.waitForURL(value => value.href === new URL(expected[0].href).href);
      return { releasedBeforeNavigation: true, springTiming: released.timing };
    } finally { await session.context.close(); }
  });
  await check('Click follows exact URL after 120ms release', () => navigate(browser, url, 'click'));
  await check('Keyboard Enter follows exact URL', () => navigate(browser, url, 'keyboard'));
  await check('No-JavaScript links and scene work', async () => {
    const session = await openPage(browser, 'no JavaScript', url, { javaScriptEnabled: false });
    try { return { links: await browserLinks(session.page), state: await state(session.page, 402, false), scene: await scene(session.page) }; }
    finally { await session.context.close(); }
  });
  await check('file:// links and scene work', async () => {
    const session = await openPage(browser, 'file URL', pathToFileURL(resolve(root, 'index.html')).href);
    try { return { links: await browserLinks(session.page), state: await state(session.page, 402), scene: await scene(session.page) }; }
    finally { await session.context.close(); }
  });
  await check('Reduced motion stops transition and idle change', async () => {
    const session = await openPage(browser, 'reduced motion', url, { reducedMotion: 'reduce' });
    try {
      const duration = await session.page.locator('a.row').first().evaluate(a => getComputedStyle(a).transitionDuration);
      assert(duration.split(',').every(x => parseFloat(x) === 0), 'Transition persists in reduced motion');
      await scene(session.page);
      await session.page.waitForTimeout(300);
      const idle = await idleFrames(session.page);
      assert(idle.requested === 0 && idle.overlayHidden, 'Reduced-motion flower renderer schedules idle frames');
      const flower = session.page.locator('button.flower-hit').first(), box = await flower.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await session.page.mouse.move(x, y); await session.page.mouse.down();
      try {
        await session.page.mouse.move(x + 38, y + 18, { steps: 4 });
        await session.page.waitForFunction(() => !document.querySelector('canvas.flower-overlay').hidden);
      } finally { await session.page.mouse.up(); }
      const released = performance.now();
      await session.page.waitForFunction(() => document.querySelector('canvas.flower-overlay').hidden);
      const returnMs = +(performance.now() - released).toFixed(1);
      assert(returnMs < 250, 'Reduced-motion flower did not return promptly: ' + returnMs + 'ms');
      return { duration, idle, flowerReturnMs: returnMs };
    } finally { await session.context.close(); }
  });
  await check('No browser console or page errors', () => assert(report.errors.length === 0, JSON.stringify(report.errors)));
  report.runtime = { completed: true, status: 'completed', note: 'Static scene has no continuous renderer; frame timing is inapplicable.' };
}

let browser, server;
try {
  await mkdir(shots, { recursive: true });
  await sourceChecks();
  if (!sourceOnly) {
    const local = await startServer(); server = local.server; report.url = local.url;
    await check('Playwright Chromium launches', async () => {
      const require = createRequire(import.meta.url);
      const { chromium } = require('playwright');
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
      return { version: browser.version(), browserSource: executablePath ? 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH' : 'Playwright-managed Chromium' };
    });
    if (browser) await browserChecks(browser, local.url);
    else report.runtime = { completed: false, status: 'blocked', reason: 'Chrome launch failed' };
  }
} catch (error) {
  report.checks.push({ name: 'Verification runner', passed: false, detail: error.stack || error.message });
  console.error(error.message.split('\n')[0]);
  if (!sourceOnly) report.runtime = { completed: false, status: 'incomplete', reason: error.message };
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(done => server.close(done));
  report.passed = report.checks.every(x => x.passed) && (sourceOnly || report.runtime.completed) && (sourceOnly || requiredScreenshots.every(name => report.screenshots.some(x => x.name === name)));
  const file = sourceOnly ? 'source-checks.json' : 'verification.json';
  await writeFile(resolve(shots, file), JSON.stringify(report, null, 2) + '\n');
  console.log(report.checks.filter(x => x.passed).length + '/' + report.checks.length + ' checks passed; site/shots/' + file);
  process.exitCode = report.passed ? 0 : 1;
}
