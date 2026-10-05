/* A reciter's recordings are one file per surah, and his timings keep one
   address for all of them with the surah number as a placeholder. Quran.com
   names some reciters' files by the bare number (68.mp3) and others by
   three digits (068.mp3), so the placeholder says which: `{n}` or `{nnn}`.

   Kept apart from timings.ts so that scripts/build-timings.ts, which runs
   in Node without Vite, writes addresses with the same function the app
   reads them with. */

/** The address of a surah's file, from a reciter's address template. */
export const surahFile = (template: string, surah: number) =>
  template
    .replace('{nnn}', String(surah).padStart(3, '0'))
    .replace('{n}', String(surah));
