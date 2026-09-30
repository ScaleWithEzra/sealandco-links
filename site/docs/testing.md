# Testing

Run these commands from `site/` after cloning the repository:

```sh
npm install
npm test
npx playwright install chromium
npm run verify
npm run verify:mobile
```

`npm test` checks the generated HTML, links, metadata, and local assets without starting a server or launching a browser. `npm run verify` starts its own temporary local server, runs the interaction and responsive checks in headless Chromium, and writes the report and screenshots to `shots/`.

Playwright uses its managed Chromium by default. To use an installed Chromium or Chrome binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to that binary's path when running `npm run verify`. `npm run verify:mobile` checks that all six links fit without scrolling at 402×667 (Instagram-sized), 402×874 (with a simulated 100px Safari toolbar), 320×568, and 375×600. It saves viewport captures in `shots/`. Below 520px tall, the layout allows scrolling rather than clipping links. The browser check also loads `index.html` directly through `file://` and tests the no-JavaScript page.

Use `npm run build` after changing `links.json`. Use `npm run build:public` to assemble the deployment allowlist in `public/`.
