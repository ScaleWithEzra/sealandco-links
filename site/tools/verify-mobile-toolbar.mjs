import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
try {
  const page = await browser.newPage({viewport:{width:402,height:874},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await page.goto(pathToFileURL(resolve(fileURLToPath(new URL('..', import.meta.url)),'index.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  const result = await page.evaluate(()=>{
    window.scrollTo(0,document.documentElement.scrollHeight);
    const socials=document.querySelector('.icons').getBoundingClientRect();
    return {scrollY,contentHeight:document.documentElement.scrollHeight,socialsBottom:socials.bottom,clearance:innerHeight-100-socials.bottom};
  });
  console.log(JSON.stringify(result));
  if(result.clearance<16) throw new Error(`Social links remain under the mobile browser bar: ${result.clearance.toFixed(1)}px clearance`);
} finally { await browser.close(); }
