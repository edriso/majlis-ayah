/* Every page of the Madani Mushaf is set in a font of its own, in which each
   word is one glyph drawn as the King Fahd Complex printed it. That is what
   makes the page look like the printed Mushaf and not like text in an Arabic
   font. Quran.com serves the 604 fonts with `access-control-allow-origin: *`
   and a year-long cache, so a page font is fetched once per device.

   The fonts are not in this repository; see NOTICE. */

const FONT_URL = (p: number) =>
  `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${p}.woff2`;

export const pageFontFamily = (p: number) => `qpc-v2-p${p}`;

const loading = new Map<number, Promise<void>>();

/**
 * Loads a page's font and resolves once text can be drawn in it. Safe to call
 * as often as a render likes: each page is fetched once, and a failure is
 * forgotten so the next call retries, which is what a reader whose connection
 * came back expects.
 */
export function loadPageFont(p: number): Promise<void> {
  let pending = loading.get(p);
  if (!pending) {
    const face = new FontFace(pageFontFamily(p), `url(${FONT_URL(p)})`, {
      display: 'block',
    });
    pending = face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
    pending.catch(() => loading.delete(p));
    loading.set(p, pending);
  }
  return pending;
}

export const isPageFontReady = (p: number) =>
  typeof document !== 'undefined' &&
  document.fonts?.check?.(`16px ${pageFontFamily(p)}`) === true &&
  loading.has(p);
