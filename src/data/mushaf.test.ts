import { describe, expect, it } from 'vitest';
import { BASMALA_GLYPHS } from '@/mushaf/MushafPage';
import {
  juzOfPage,
  juzStarts,
  PAGE_COUNT,
  rubLabel,
  surahOfPage,
  surahs,
  type Page,
} from './mushaf';

const files = import.meta.glob<Page>('./pages/*.json', {
  eager: true,
  import: 'default',
});
const pages: Page[] = Array.from(
  { length: PAGE_COUNT },
  (_, i) => files[`./pages/${i + 1}.json`],
);

describe('the Mushaf', () => {
  it('has exactly 604 pages', () => {
    expect(Object.keys(files)).toHaveLength(PAGE_COUNT);
    expect(pages.map((p) => p.page)).toEqual(
      Array.from({ length: PAGE_COUNT }, (_, i) => i + 1),
    );
  });

  it('sets every page on 15 lines, and the opening two on 8', () => {
    for (const p of pages)
      expect(p.lines, `page ${p.page}`).toHaveLength(p.page <= 2 ? 8 : 15);
  });

  it('holds all 6,236 ayat once each, in order, each ending in its mark', () => {
    const order: string[] = [];
    for (const p of pages)
      for (const l of p.lines)
        if (l.t === 'text')
          for (const [, key] of l.w)
            if (order[order.length - 1] !== key) order.push(key);
    expect(order).toHaveLength(6236);
    expect(new Set(order).size).toBe(6236);
    expect(order[0]).toBe('1:1');
    expect(order[order.length - 1]).toBe('114:6');
    for (const s of surahs)
      expect(order.filter((k) => k.startsWith(`${s.n}:`))).toHaveLength(s.ayat);
  });

  it('ends every page on a whole ayah, as the Madani print does', () => {
    const pageOf = new Map<string, number>();
    for (const p of pages)
      for (const l of p.lines)
        if (l.t === 'text')
          for (const [, key] of l.w) {
            expect(pageOf.get(key) ?? p.page, key).toBe(p.page);
            pageOf.set(key, p.page);
          }
  });

  it('opens every surah with a header, and all but two with a basmala', () => {
    const lines = pages.flatMap((p) => p.lines);
    const headers = lines.flatMap((l, i) => (l.t === 'surah' ? [i] : []));
    expect(headers).toHaveLength(114);
    for (const i of headers) {
      const s = (lines[i] as { s: number }).s;
      const next = lines[i + 1];
      if (s === 1 || s === 9) expect(next.t, `surah ${s}`).toBe('text');
      else expect(next.t, `surah ${s}`).toBe('basmala');
    }
  });

  it('draws the basmala with al-Fatihah’s own glyphs from page 1', () => {
    const first = pages[0].lines[1];
    expect(first.t).toBe('text');
    if (first.t === 'text')
      expect(first.w.slice(0, 4).map(([code]) => code)).toEqual(BASMALA_GLYPHS);
  });

  it('knows where each surah and juz begins', () => {
    expect(surahs).toHaveLength(114);
    expect(surahs[1]).toMatchObject({ name: 'البقرة', page: 2, ayat: 286 });
    expect(surahs[17].page).toBe(293);
    expect(surahs[113].page).toBe(604);
    expect(juzStarts[0]).toBe(1);
    expect(juzStarts[29]).toBe(582);
    expect(juzStarts).toEqual([...juzStarts].sort((a, b) => a - b));
    expect(surahOfPage(24).name).toBe('البقرة');
    expect(juzOfPage(604)).toBe(30);
  });

  it('marks the fifteen prostrations of recitation', () => {
    const sajdah = pages.flatMap((p) => p.sajdah ?? []);
    expect(sajdah).toHaveLength(15);
    expect(sajdah).toContain('7:206');
    expect(sajdah).toContain('96:19');
  });

  it('names hizb quarters as the margin does', () => {
    expect(rubLabel(1)).toBe('الحزب ١');
    expect(rubLabel(2)).toBe('ربع الحزب ١');
    expect(rubLabel(7)).toBe('نصف الحزب ٢');
    expect(rubLabel(240)).toBe('ثلاثة أرباع الحزب ٦٠');
  });
});
