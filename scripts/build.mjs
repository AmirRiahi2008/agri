import { mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const assets = path.join(root, 'dist/assets');
await mkdir(path.join(assets, 'vendor'), { recursive: true });
await mkdir(path.join(assets, 'fonts'), { recursive: true });
const vendor = {
  'alpine.js': 'alpinejs/dist/cdn.min.js',
  'focus.js': '@alpinejs/focus/dist/cdn.min.js',
  'motion.js': 'motion/dist/motion.js',
  'lucide.js': 'lucide/dist/umd/lucide.min.js',
  'leaflet.js': 'leaflet/dist/leaflet.js',
  'leaflet.css': 'leaflet/dist/leaflet.css',
  'gesture.js': 'leaflet-gesture-handling/dist/leaflet-gesture-handling.min.js',
  'gesture.css': 'leaflet-gesture-handling/dist/leaflet-gesture-handling.min.css',
  'qrcode.js': 'qrcode-generator/qrcode.js',
};
for (const [name, source] of Object.entries(vendor)) {
  await copyFile(path.join(root, 'node_modules', source), path.join(assets, 'vendor', name));
}
const fonts = path.join(root, 'node_modules/@fontsource/vazirmatn/files');
for (const name of await readdir(fonts)) {
  if (/vazirmatn-(arabic|latin)-(400|500|600|700|800)-normal\.woff2$/.test(name)) {
    await copyFile(path.join(fonts, name), path.join(assets, 'fonts', name));
  }
}
execFileSync(process.execPath, [path.join(root, 'node_modules/@tailwindcss/cli/dist/index.mjs'), '-i', 'src/styles.css', '-o', 'dist/assets/styles.css', '--minify'], { stdio: 'inherit' });
for (const file of ['index.html', 'assets/app.js', 'assets/project-data.js', 'assets/project-map.js', 'assets/farm.svg', 'assets/logo.png']) {
  await stat(path.join(root, 'dist', file));
}
console.log('Static site built. Fonts and all JavaScript libraries are local.');
