import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const svg = await readFile('assets/icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await mkdir('assets/icons', { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const data = await page.evaluate(async ({ svg, size }) => {
      const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { svg, size });
    await writeFile(`assets/icons/icon${size}.png`, Buffer.from(data, 'base64'));
  }
} finally { await browser.close(); }
console.log('Ícones PNG gerados em assets/icons/.');
