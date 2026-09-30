import './build.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const publicFiles=['index.html','style.css','app.js','flower-touch.js','manifest.webmanifest','assets/iphone-17-pro.css','assets/scene.jpg','assets/pile.png','assets/share-card.png','assets/flower-32.png','assets/flower-192.png','assets/flower-512.png','assets/apple-touch-icon.png','assets/cursor-grab.svg','assets/cursor-grabbing.svg','assets/cursor-point.svg','assets/fonts/Fraunces-Variable.ttf','assets/fonts/Manrope-Latin-Variable.woff2','assets/fonts/Fraunces-OFL.txt','assets/fonts/Manrope-OFL.txt'];
await fs.rm(path.join(root,'public'),{recursive:true,force:true});
for(const file of publicFiles){const to=path.join(root,'public',file);await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(path.join(root,file),to);}
await fs.writeFile(path.join(root,'public/vercel.json'),JSON.stringify({framework:null,buildCommand:null,installCommand:null},null,2)+'\n');
console.log(`Prepared ${publicFiles.length} public files plus hosting configuration.`);
