/**
 * Gera os ícones do PWA a partir do lótus em SVG com npm run generate-icons
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BACKGROUND = '#121b21';
const publicDir = path.join(__dirname, '..', 'public');
const outDir = path.join(publicDir, 'icons');

const lotusSvg = fs.readFileSync(path.join(publicDir, 'sattva-lotus.svg'), 'utf8');
const viewBox = lotusSvg.match(/viewBox="([^"]+)"/)[1];
const lotusPaths = (lotusSvg.match(/<path\b[^>]*\/>/g) ?? []).join('');

/**
 * Monta um SVG quadrado: fundo + lotus centralizado
 */
function iconSvg(size, { scale, radius }) {
  const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);
  const width = size * scale;
  const height = (width * vbHeight) / vbWidth;
  const x = (size - width) / 2;
  const y = (size - height) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${size * radius}" fill="${BACKGROUND}"/>
    <svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}">${lotusPaths}</svg>
  </svg>`;
}

async function write(file, size, options) {
  await sharp(Buffer.from(iconSvg(size, options)))
    .png()
    .toFile(path.join(outDir, file));
}

(async () => {
  try {
    await fs.promises.mkdir(outDir, { recursive: true });

    for (const size of [16, 32, 72, 96, 128, 144, 152, 192, 384, 512]) {
      const scale = size <= 32 ? 0.9 : 0.7;
      await write(`icon-${size}x${size}.png`, size, { scale, radius: 0.22 });
    }

    for (const size of [192, 512]) {
      await write(`icon-${size}x${size}-maskable.png`, size, { scale: 0.56, radius: 0 });
    }

    await write('icon-180x180.png', 180, { scale: 0.66, radius: 0 });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
