import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const shots = resolve(root, 'shots');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});

const scenarios = [
  { name: 'instagram', width: 402, height: 667, obstruction: 0, minHero: 300, screenshot: 'instagram-compact.png' },
  { name: 'safari', width: 402, height: 874, obstruction: 100, minHero: 300, screenshot: 'safari-no-scroll.png' },
  { name: 'small-phone', width: 320, height: 568, obstruction: 0, minHero: 245, screenshot: 'small-phone-compact.png' },
  { name: 'short-phone', width: 375, height: 600, obstruction: 0, minHero: 270, screenshot: 'short-phone-compact.png' },
];

try {
  await mkdir(shots, { recursive: true });
  for (const scenario of scenarios) {
    const page = await browser.newPage({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    try {
      await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(() => {
        const bounds = element => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: rect.height };
        };
        const anchors = [...document.querySelectorAll('.links a, .icons a')];
        const links = anchors.map(bounds);
        const reachable = anchors.every(anchor => {
          const rect = anchor.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return hit === anchor || anchor.contains(hit);
        });
        window.scrollTo(0, 1000);
        return {
          viewportHeight: innerHeight,
          scrollHeight: document.documentElement.scrollHeight,
          scrollY,
          heroHeight: bounds(document.querySelector('.hero')).height,
          links,
          reachable,
        };
      });
      await page.screenshot({ path: resolve(shots, scenario.screenshot) });
      const usableBottom = scenario.height - scenario.obstruction - 12;
      console.log(`${scenario.name}: ${JSON.stringify({
        viewport: `${scenario.width}x${scenario.height}`,
        scrollHeight: result.scrollHeight,
        scrollY: result.scrollY,
        heroHeight: result.heroHeight,
        finalLinkBottom: result.links.at(-1)?.bottom,
        usableBottom,
      })}`);
      if (result.scrollHeight > scenario.height + 1 || result.scrollY > 1) {
        throw new Error(`${scenario.name} scrolls instead of fitting the viewport`);
      }
      if (result.heroHeight < scenario.minHero) {
        throw new Error(`${scenario.name} cuts too much of the flower scene`);
      }
      if (result.links.length !== 6 || result.links.some(link => link.top < 0 || link.bottom > usableBottom)) {
        throw new Error(`${scenario.name} does not show every link above browser chrome`);
      }
      if (result.links.some(link => link.height < 44)) {
        throw new Error(`${scenario.name} has a link shorter than the 44px touch target`);
      }
      if (!result.reachable) {
        throw new Error(`${scenario.name} has a link obscured by another page element`);
      }
    } finally {
      await page.close();
    }
  }
  console.log('All four no-scroll mobile layouts pass.');
} finally {
  await browser.close();
}
