/* How long a reciter takes over each page, and which stretch of his surah
   recording covers it. Built by scripts/build-timings.ts from Quran.com's
   per-ayah timestamps, one small file per reciter, loaded only when a halaqa
   is timed by that reciter or listens to him. */

import { surahFile } from './audio';
import { PAGE_COUNT } from './mushaf';

/** [surah, fromMs, toMs]: a stretch of the reciter's recording of that surah. */
export type Stretch = [surah: number, from: number, to: number];

/** A stretch of a recording to play, and the page it recites. */
export type Segment = {
  url: string;
  /** Milliseconds into the recording. */
  from: number;
  to: number;
  page: number;
};

export type Timings = {
  /** The surah file's address, with `{n}` or `{nnn}` for the surah
      number (see audio.ts). */
  audio: string;
  pages: Stretch[][];
};

const modules = import.meta.glob<{ default: Timings }>('./timings/*.json');
const cache = new Map<string, Promise<Timings>>();

export function loadTimings(reciter: string): Promise<Timings> {
  let pending = cache.get(reciter);
  if (!pending) {
    const load = modules[`./timings/${reciter}.json`];
    if (!load) return Promise.reject(new Error(`no timings for ${reciter}`));
    pending = load().then((m) => m.default);
    pending.catch(() => cache.delete(reciter));
    cache.set(reciter, pending);
  }
  return pending;
}

export const pageStretches = (t: Timings, page: number): Stretch[] =>
  t.pages[page - 1] ?? [];

/** Milliseconds the reciter takes over a page. */
export const pageDuration = (t: Timings, page: number) =>
  pageStretches(t, page).reduce((sum, [, from, to]) => sum + (to - from), 0);

/** Milliseconds over several pages, as a turn of more than one page is. */
export const pagesDuration = (t: Timings, pages: readonly number[]) =>
  pages.reduce((sum, p) => sum + pageDuration(t, p), 0);

/** The reciter's average page, for the picker: «نحو ١:٤٠ للصفحة». */
export const averagePage = (t: Timings) =>
  t.pages.reduce((s, _, i) => s + pageDuration(t, i + 1), 0) / PAGE_COUNT;

export const surahAudioUrl = (t: Timings, surah: number) =>
  surahFile(t.audio, surah);

/** A reciter's recitation of some pages, as the stretches to play in order:
    one per page, or two where a page holds the end of one surah and the
    start of the next. */
export const recitationOf = (t: Timings, pages: readonly number[]): Segment[] =>
  pages.flatMap((page) =>
    pageStretches(t, page).map(([surah, from, to]) => ({
      url: surahAudioUrl(t, surah),
      from,
      to,
      page,
    })),
  );
