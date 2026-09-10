// Rasterize logo.svg into the extension icon PNGs.
// Requires sharp:  pnpm add -D sharp && node scripts/gen-icons.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(root, 'logo.svg'));
const outDir = resolve(root, 'public/icon');
mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 96, 128];
for (const size of sizes) {
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(outDir, `${size}.png`));
  console.log(`wrote public/icon/${size}.png`);
}
