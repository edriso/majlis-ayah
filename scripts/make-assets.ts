/* Draws the app icons and the share card in headless Chrome, once.

     node scripts/make-assets.ts

   Writes public/icon-192.png, icon-512.png, icon-maskable-512.png,
   apple-touch-icon.png and og.png. Uses the Chrome installed on the machine
   and macOS's `sips`
   (CHROME=/path/to/chrome to point elsewhere), so the repository carries no
   browser dependency for a job done once. The fonts come from Google Fonts,
   as they do in the app. */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const work = mkdtempSync(join(tmpdir(), 'majlis-ayah-assets-'));
const mark = readFileSync('public/favicon.svg', 'utf8')
  .replace(/<rect[^>]*\/>/, '')
  .replace('<svg ', '<svg width="100%" height="100%" ');

const fonts =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@600&family=IBM+Plex+Sans+Arabic:wght@500&display=block">';

const ground = `
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgb(255 222 160 / 0.14), transparent 70%),
    #2a0f14;`;

function shoot(name: string, width: number, height: number, body: string) {
  const html = join(work, `${name}.html`);
  writeFileSync(
    html,
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">${fonts}<style>
      html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
      body{${ground};display:grid;place-items:center;font-family:'IBM Plex Sans Arabic',sans-serif}
    </style></head><body>${body}</body></html>`,
  );
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    '--virtual-time-budget=5000',
    `--screenshot=${join(process.cwd(), 'public', name)}`,
    `file://${html}`,
  ]);
  console.log(`public/${name}`);
}

const icon = (size: number, scale: number) =>
  `<div style="width:${size * scale}px;height:${size * scale}px">${mark}</div>`;

/* Chrome will not open a headless window much smaller than 500px, so the
   small icons are drawn at 512 and scaled down with `sips` (macOS). */
function scaled(name: string, size: number, from: string) {
  execFileSync('sips', [
    '-z',
    String(size),
    String(size),
    from,
    '--out',
    `public/${name}`,
  ]);
  console.log(`public/${name}`);
}

shoot('icon-512.png', 512, 512, icon(512, 0.84));
scaled('icon-192.png', 192, 'public/icon-512.png');
// A maskable icon is cropped to a circle of 80% by some launchers, so the
// mark keeps to the middle 60%.
shoot('icon-maskable-512.png', 512, 512, icon(512, 0.6));
shoot('apple-touch-icon.png', 512, 512, icon(512, 0.78));
scaled('apple-touch-icon.png', 180, 'public/apple-touch-icon.png');
shoot(
  'og.png',
  1200,
  630,
  `<div style="display:grid;justify-items:center;gap:18px;color:#d9b469;text-align:center">
     <div style="width:150px;height:150px">${mark}</div>
     <div style="font:600 112px/1.1 'Reem Kufi',sans-serif">مجلس آية</div>
     <div style="font:500 38px/1.5 'IBM Plex Sans Arabic',sans-serif;color:#f4ecdc">اقرؤوا القرآن معًا، دورًا بعد دور.</div>
   </div>`,
);
