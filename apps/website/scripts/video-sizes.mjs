// Records each video's size for the Worker (static assets don't tell it the length, and range answers need it).
import { readdirSync, statSync, writeFileSync } from 'node:fs';
const dir = new URL('../public/video/', import.meta.url);
const sizes = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.mp4')).map((f) => [`/video/${f}`, statSync(new URL(f, dir)).size]));
writeFileSync(new URL('../worker/video-sizes.json', import.meta.url), JSON.stringify(sizes, null, 1) + '\n');
console.log('video sizes:', sizes);
