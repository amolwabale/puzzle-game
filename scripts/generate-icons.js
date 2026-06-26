#!/usr/bin/env node
/*
Generates Android mipmap PNGs from assets/sliding-puzzle-icon.svg using sharp.
Run: npm run generate-icons (install sharp first: npm i --save-dev sharp)
*/
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const svgPath = path.join(projectRoot, 'assets', 'sliding-puzzle-icon.svg');
if (!fs.existsSync(svgPath)) {
  console.error('SVG not found:', svgPath);
  process.exit(1);
}

const outBase = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, {recursive: true});
}

async function generate() {
  for (const [folder, size] of Object.entries(sizes)) {
    const outDir = path.join(outBase, folder);
    await ensureDir(outDir);
    const outPath = path.join(outDir, 'ic_launcher.png');
    console.log('Generating', outPath, size);
    await sharp(svgPath).resize(size, size).png().toFile(outPath);
    // also generate round variant
    const outRound = path.join(outDir, 'ic_launcher_round.png');
    await sharp(svgPath).resize(size, size).png().toFile(outRound);

    // also write a foreground copy for adaptive icon referencing
    const fg = path.join(outDir, 'ic_launcher_foreground.png');
    await sharp(svgPath).resize(size, size).png().toFile(fg);
  }

  // create mipmap-anydpi-v26 adaptive XML
  const anydpi = path.join(outBase, 'mipmap-anydpi-v26');
  await ensureDir(anydpi);
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">\n  <background android:drawable=\"@color/ic_launcher_background\"/>\n  <foreground android:drawable=\"@mipmap/ic_launcher_foreground\"/>\n</adaptive-icon>\n`;
  fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), xml);
  fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), xml);

  // create res/values/colors.xml with background color
  const valuesDir = path.join(outBase, 'values');
  await ensureDir(valuesDir);
  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name=\"ic_launcher_background\">#071133</color>\n</resources>\n`;
  fs.writeFileSync(path.join(valuesDir, 'colors.xml'), colorsXml);

  console.log('Icon generation complete.');
}

generate().catch(e => { console.error(e); process.exit(2); });
