/* Asks the audio host for every surah file of every reciter, the way the
   app will ask for it, so a file the timings name but the host does not
   serve is found here and not in a halaqa.

     node scripts/check-audio.ts

   It reads the committed timings and fetches one byte of each file, nothing
   more. Run it after `npm run build:timings`, and whenever a recitation
   will not play: a host can move or drop a file with nothing here changing,
   which is why this is a check to run and not a test. */

import { readFile } from 'node:fs/promises';
import { surahFile } from '../src/data/audio.ts';
import { reciters } from '../src/data/reciters.ts';

// A few at a time: quick, without hammering a free host.
const AT_ONCE = 8;

async function serves(url: string) {
  const res = await fetch(url, { headers: { range: 'bytes=0-0' } });
  await res.body?.cancel();
  const type = res.headers.get('content-type') ?? '';
  return res.ok && type.startsWith('audio/') ? null : `${res.status} ${url}`;
}

const failures: string[] = [];
for (const reciter of reciters) {
  const { audio } = JSON.parse(
    await readFile(`src/data/timings/${reciter.id}.json`, 'utf8'),
  ) as { audio: string };
  const urls = Array.from({ length: 114 }, (_, i) => surahFile(audio, i + 1));
  let missing = 0;
  for (let i = 0; i < urls.length; i += AT_ONCE)
    for (const failure of await Promise.all(
      urls.slice(i, i + AT_ONCE).map(serves),
    ))
      if (failure) {
        failures.push(`${reciter.id}: ${failure}`);
        missing++;
      }
  console.log(`${reciter.id}: ${urls.length - missing} of 114 surahs served`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
