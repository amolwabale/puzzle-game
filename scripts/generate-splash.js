#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const svgPath = path.join(projectRoot, 'assets', 'sliding-puzzle-icon.svg');
if (!fs.existsSync(svgPath)) {
  console.error('SVG not found:', svgPath);
  process.exit(1);
}

const resBase = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

const drawableSizes = {
  'drawable-hdpi': 320,
  'drawable-xhdpi': 480,
  'drawable-xxhdpi': 720,
  'drawable-xxxhdpi': 960,
};

async function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, {recursive: true});
}

async function generate() {
  for (const [folder, size] of Object.entries(drawableSizes)) {
    const outDir = path.join(resBase, folder);
    await ensureDir(outDir);
    const outPath = path.join(outDir, 'bootsplash_logo.png');
    console.log('Generating', outPath, size);
    await sharp(svgPath).resize(size, null).png().toFile(outPath);
  }
  
  // Also create a large density-independent copy so themes can reference a single drawable
  // that scales consistently across devices without density selection issues.
  const nodpiSize = 2000;
  const nodpiDir = path.join(resBase, 'drawable-nodpi');
  await ensureDir(nodpiDir);
  const nodpiOut = path.join(nodpiDir, 'bootsplash_logo.png');
  console.log('Generating', nodpiOut, nodpiSize);
  await sharp(svgPath).resize(nodpiSize, null).png().toFile(nodpiOut);
  console.log('Splash generation complete.');
}

generate().catch(e => { console.error(e); process.exit(2); });
