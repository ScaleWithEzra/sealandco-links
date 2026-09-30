import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await fs.readFile(path.join(root, 'links.json'), 'utf8'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const nameParts = config.name.trim().split(/\s+/);
const surname = nameParts.pop();
const displayName = `${nameParts.length ? escape(nameParts.join(' ')) + ' ' : ''}<span class="surname">${escape(surname)}</span>`;
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
const icons = {
  Instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  Threads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 7.5C18.4 4 16 2.5 12.3 2.5 6.4 2.5 3.5 6 3.5 12s2.9 9.5 8.8 9.5c4.4 0 7.6-2.6 7.6-6.1 0-3.4-2.8-5.2-6.6-5.2-3 0-4.6 1.3-4.6 3.2s1.5 3 3.4 3c2.9 0 4.2-2.3 4.2-5.7 0-3.1-1.4-4.7-3.9-4.7-1.7 0-2.9.7-3.6 1.8"/></svg>',
  GitHub: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.07c-3.1.67-3.75-1.31-3.75-1.31-.5-1.28-1.23-1.62-1.23-1.62-1-.68.08-.67.08-.67 1.11.08 1.7 1.14 1.7 1.14.98 1.69 2.59 1.2 3.22.92.1-.72.38-1.21.7-1.49-2.48-.28-5.08-1.24-5.08-5.5 0-1.22.43-2.22 1.14-3-.11-.28-.5-1.42.11-2.95 0 0 .93-.3 3.05 1.14A10.6 10.6 0 0 1 12 6.21c.94 0 1.88.13 2.77.37 2.12-1.44 3.05-1.14 3.05-1.14.61 1.53.22 2.67.11 2.95.71.78 1.14 1.78 1.14 3 0 4.27-2.61 5.22-5.1 5.5.4.35.76 1.03.76 2.08v3.02c0 .3.2.64.77.53A11.1 11.1 0 0 0 12 .9Z"/></svg>',
  LinkedIn: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.8 3.2a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM3 9h3.6v12H3Zm6 0h3.5v1.6c.7-1.2 1.9-1.9 3.6-1.9 3.7 0 4.5 2.4 4.5 5.6V21H17v-6c0-1.5-.3-2.9-1.9-2.9-1.7 0-2.5 1.2-2.5 3V21H9Z"/></svg>',
  X: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 3 16 18h-4L4 3h4l12 18M20 3 4 21"/></svg>',
};
const valid = entry => typeof entry.href === 'string' && entry.href.trim();
const rows = config.rows.filter(valid).map(row => `<a class="pillow row" href="${escape(row.href)}"><span><span class="label">${escape(row.title)}</span><span class="sub">${escape(row.sub)}</span></span>${arrow}</a>`).join('\n');
const socials = config.icons.filter(valid).map(icon => `<a class="pillow icon" href="${escape(icon.href)}" aria-label="${escape(icon.name)}" title="${escape(icon.name)}">${icons[icon.name] ?? arrow}</a>`).join('\n');
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escape(config.name)}</title>
<meta name="description" content="${escape(config.role)}">
<meta name="theme-color" content="#482038">
<meta property="og:type" content="website">
<meta property="og:title" content="${escape(config.name)}">
<meta property="og:description" content="${escape(config.role)}">
<meta property="og:url" content="${escape(config.plannedUrl)}/">
<meta property="og:image" content="${escape(config.plannedUrl)}/assets/scene.jpg">
<link rel="canonical" href="${escape(config.plannedUrl)}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(config.name)}">
<meta name="twitter:description" content="${escape(config.role)}">
<link rel="icon" href="assets/flower.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/iphone-17-pro.css" media="(min-width:700px)">
<link rel="stylesheet" href="style.css">
</head><body>
<div class="ip17 desktop-device">
<i class="device-chrome ip17-btn ip17-action" aria-hidden="true"></i><i class="device-chrome ip17-btn ip17-vol-up" aria-hidden="true"></i><i class="device-chrome ip17-btn ip17-vol-down" aria-hidden="true"></i><i class="device-chrome ip17-btn ip17-power" aria-hidden="true"></i><i class="device-chrome ip17-btn ip17-camera" aria-hidden="true"></i>
<div class="ip17-bezel"><div class="ip17-screen">
<main class="page" id="page">
<div class="hero"></div>
<div class="content">
<header class="profile"><h1>${displayName}</h1><p class="role">${escape(config.role)}</p></header>
<nav class="links" aria-label="My links">${rows}</nav>
<nav class="icons" aria-label="Social links">${socials}</nav>
</div>
</main>
<div class="device-chrome ip17-status" aria-hidden="true"><span class="ip17-time">9:41</span><span class="ip17-icons"><svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="5" y="5.5" width="3" height="6.5" rx=".8"/><rect x="10" y="3" width="3" height="9" rx=".8"/><rect x="15" y="0" width="3" height="12" rx=".8"/></svg><svg viewBox="0 0 16 12" width="16" height="12"><path d="M.1 3.7a11.2 11.2 0 0 1 15.8 0L13.7 6A8 8 0 0 0 2.3 6ZM3.4 7a6.5 6.5 0 0 1 9.2 0l-2.2 2.2a3.4 3.4 0 0 0-4.8 0ZM8 11.6l-1.3-1.3a1.8 1.8 0 0 1 2.6 0Z"/></svg><svg viewBox="0 0 27 13" width="27" height="13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="18" height="9" rx="2.3"/><path d="M25 4.4c.9.3 1.5 1.1 1.5 2.1s-.6 1.8-1.5 2.1z" fill-opacity=".45"/></svg></span></div>
<i class="device-chrome ip17-island" aria-hidden="true"></i><i class="device-chrome ip17-home" aria-hidden="true"></i>
</div></div></div>
<script src="app.js" defer></script>
<script src="flower-touch.js" defer></script>
</body></html>\n`;
await fs.writeFile(path.join(root, 'index.html'), html);
console.log(`Built plain HTML: ${config.rows.filter(valid).length} rows, ${config.icons.filter(valid).length} icon links.`);
