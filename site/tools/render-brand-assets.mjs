import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'links.json'), 'utf8'));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(new URL('./brand-assets.html', import.meta.url).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(({ name, role, url }) => {
    document.querySelector('.share-copy h1').textContent = name;
    document.querySelector('.share-copy .role').textContent = role;
    document.querySelector('.url').textContent = new URL(url).host;
  }, { name: config.name, role: config.role, url: config.plannedUrl });
  await page.locator('.share-card').screenshot({ path: path.join(root, 'assets/share-card.png') });
  for (const [size, name] of [[32, 'flower-32.png'], [180, 'apple-touch-icon.png'], [192, 'flower-192.png'], [512, 'flower-512.png']]) {
    await page.locator('.app-icon').evaluate((icon, size) => {
      icon.style.width = `${size}px`;
      icon.style.height = `${size}px`;
      icon.style.borderRadius = size === 32 ? '20%' : '0';
    }, size);
    await page.locator('.app-icon').screenshot({ path: path.join(root, `assets/${name}`), omitBackground: true });
  }
  console.log('Rendered share card and flower icons at 32, 180, 192 and 512px.');
} finally {
  await browser.close();
}
