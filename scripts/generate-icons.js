const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public', 'sattva.png');
const outDir = path.join(__dirname, '..', 'public', 'icons');
const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

(async () => {
  try {
    await fs.promises.mkdir(outDir, { recursive: true });

    for (const size of sizes) {
      const outPath = path.join(outDir, `icon-${size}x${size}.png`);
      await sharp(src)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outPath);
    }

    for (const size of [192, 512]) {
      const srcPath = path.join(outDir, `icon-${size}x${size}.png`);
      const maskPath = path.join(outDir, `icon-${size}x${size}-maskable.png`);
      await sharp(srcPath).toFile(maskPath);
    }


  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
