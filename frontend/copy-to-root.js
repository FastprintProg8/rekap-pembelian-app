import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

console.log('Menyalin hasil build dist ke root project...');

// Salin dist/index.html -> root/index.html
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  fs.copyFileSync(path.join(distDir, 'index.html'), path.join(rootDir, 'index.html'));
}

// Salin dist/manifest.webmanifest -> root/manifest.webmanifest
if (fs.existsSync(path.join(distDir, 'manifest.webmanifest'))) {
  fs.copyFileSync(path.join(distDir, 'manifest.webmanifest'), path.join(rootDir, 'manifest.webmanifest'));
}

// Salin dist/sw.js -> root/sw.js
if (fs.existsSync(path.join(distDir, 'sw.js'))) {
  fs.copyFileSync(path.join(distDir, 'sw.js'), path.join(rootDir, 'sw.js'));
}

// Salin dist/assets -> root/assets
const distAssets = path.join(distDir, 'assets');
const rootAssets = path.join(rootDir, 'assets');
if (fs.existsSync(distAssets)) {
  fs.cpSync(distAssets, rootAssets, { recursive: true, force: true });
}

// Salin backend/api.php -> root/api.php
const backendApi = path.join(rootDir, 'backend', 'api.php');
const rootApi = path.join(rootDir, 'api.php');
if (fs.existsSync(backendApi)) {
  fs.copyFileSync(backendApi, rootApi);
}

console.log('Berhasil! File root (index.html, assets, api.php) sudah otomatis diperbarui.');

