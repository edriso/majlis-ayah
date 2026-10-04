import { useEffect, useState } from 'react';
import { loadedPage, loadPage, type Page } from '@/data/mushaf';
import { isPageFontReady, loadPageFont } from './fonts';

export type PageState =
  | { status: 'loading' }
  | { status: 'ready'; page: Page; font: 'glyphs' | 'text' };

type Loaded = { n: number; page: Page; font: 'glyphs' | 'text' };

/**
 * A Mushaf page and its font. The page is drawn only once both are in, so the
 * glyph codes never flash as boxes. If the font cannot load (offline on a
 * first visit, the font host down) the page is drawn from its readable text
 * instead, on the same fifteen lines, which is a page that still reads.
 *
 * The pages on either side are fetched as soon as this one is ready, which is
 * what makes «تمّ» feel instant: the next reader's page is already here.
 */
export function usePage(
  n: number,
  prefetch: readonly number[] = [],
): PageState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let live = true;
    loadPage(n)
      .then(async (page) => {
        const font = await loadPageFont(n).then(
          () => 'glyphs' as const,
          () => 'text' as const,
        );
        if (live) setLoaded({ n, page, font });
      })
      .catch(() => {
        // The page's own data failed, which only happens offline before the
        // chunk was ever cached. Stay on the loading state; the next render
        // with a new page number retries.
      });
    return () => {
      live = false;
    };
  }, [n]);

  const key = prefetch.join(',');
  useEffect(() => {
    if (loaded?.n !== n) return;
    for (const p of key.split(',').map(Number)) {
      if (!p) continue;
      loadPage(p).catch(() => {});
      loadPageFont(p).catch(() => {});
    }
  }, [loaded, n, key]);

  if (loaded && loaded.n === n)
    return { status: 'ready', page: loaded.page, font: loaded.font };
  // A page fetched ahead of time is drawn in the same frame as the turn
  // that asked for it, rather than after a frame of skeleton.
  const early = loadedPage(n);
  if (early && isPageFontReady(n))
    return { status: 'ready', page: early, font: 'glyphs' };
  return { status: 'loading' };
}
