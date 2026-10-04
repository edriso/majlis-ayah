/* Builds how long each reciter takes over each Mushaf page, once.

     node scripts/build-timings.ts            fetch what is missing, then build
     node scripts/build-timings.ts --offline  build from .cache only

   Run `npm run build:mushaf` first: the page layout decides where a page
   begins and ends, and this script only measures it.

   Writes src/data/timings/<reciter>.json. For every page it holds the stretch
   (or stretches, where a page holds the end of one surah and the start of the
   next) of that reciter's surah recording that covers the page:

     pages[p - 1] = [[surah, fromMs, toMs], …]

   That one table gives both features that need a reciter. Reciter timing
   (`توقيت القارئ`) adds the stretches up into the length of a turn, and the
   listen button plays exactly those stretches of the surah file.

   The source is Quran.com's per-surah recordings with per-ayah timestamps.
   The Madani Mushaf ends every page on the end of an ayah, so a page is
   always a run of whole ayat and its length is theirs, with no ayah to cut
   in two. The script checks that rather than assuming it. */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { reciters } from '../src/data/reciters.ts';

const API = 'https://api.qurancdn.com/api/qdc/audio/reciters';
const CACHE = '.cache/quran-com/audio';
const OUT = 'src/data/timings';
const offline = process.argv.includes('--offline');

type VerseTiming = {
  verse_key: string;
  timestamp_from: number;
  timestamp_to: number;
};
type AudioFile = { audio_url: string; verse_timings: VerseTiming[] };
type PageLine = { t: string; w?: [string, string][] };

async function chapter(qdc: number, n: number): Promise<AudioFile> {
  const path = `${CACHE}/${qdc}/${n}.json`;
  if (!existsSync(path)) {
    if (offline)
      throw new Error(`${path} is not cached and --offline was given`);
    const url = `${API}/${qdc}/audio_files?chapter=${n}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    await mkdir(`${CACHE}/${qdc}`, { recursive: true });
    await writeFile(path, await res.text());
  }
  const { audio_files } = JSON.parse(await readFile(path, 'utf8')) as {
    audio_files: AudioFile[];
  };
  return audio_files[0];
}

/* Where each ayah's words sit: for every verse, the page of each of its
   words in order, the end-of-ayah marker included as the last. */
const pagesOfWords = new Map<string, number[]>();
const pageCount = (await readdir('src/data/pages')).length;
for (let p = 1; p <= pageCount; p++) {
  const { lines } = JSON.parse(
    await readFile(`src/data/pages/${p}.json`, 'utf8'),
  ) as { lines: PageLine[] };
  for (const line of lines)
    for (const [, key] of line.w ?? []) {
      const list = pagesOfWords.get(key) ?? [];
      list.push(p);
      pagesOfWords.set(key, list);
    }
}

await mkdir(OUT, { recursive: true });

for (const reciter of reciters) {
  const pages: [number, number, number][][] = Array.from(
    { length: pageCount },
    () => [],
  );
  let urlTemplate = '';

  const add = (page: number, surah: number, from: number, to: number) => {
    const list = pages[page - 1];
    const last = list[list.length - 1];
    // Consecutive ayat of one surah on one page are one stretch of its file.
    if (last && last[0] === surah) last[2] = Math.max(last[2], to);
    else list.push([surah, from, to]);
  };

  for (let n = 1; n <= 114; n++) {
    const file = await chapter(reciter.qdc, n);
    const template = file.audio_url.replace(/\/\d+\.mp3$/, '/{n}.mp3');
    if (!template.includes('{n}') || (urlTemplate && template !== urlTemplate))
      throw new Error(`${reciter.id}: unexpected audio url ${file.audio_url}`);
    urlTemplate = template;

    for (const v of file.verse_timings) {
      const wordPages = pagesOfWords.get(v.verse_key);
      if (!wordPages) throw new Error(`${v.verse_key} is not in the mushaf`);
      if (new Set(wordPages).size !== 1)
        throw new Error(`${v.verse_key} runs over a page break`);
      add(wordPages[0], n, v.timestamp_from, v.timestamp_to);
    }
  }

  const empty = pages.findIndex((list) => list.length === 0);
  if (empty !== -1)
    throw new Error(`${reciter.id}: page ${empty + 1} is empty`);

  await writeFile(
    `${OUT}/${reciter.id}.json`,
    JSON.stringify({
      source: `Quran.com recitation ${reciter.qdc}, ${API}/${reciter.qdc}/audio_files. Built by scripts/build-timings.ts.`,
      audio: urlTemplate,
      pages,
    }),
  );
  const total = pages.flat().reduce((s, [, a, b]) => s + (b - a), 0);
  console.log(
    `${reciter.id}: ${(total / 3_600_000).toFixed(1)} h over ${pageCount} pages`,
  );
}
