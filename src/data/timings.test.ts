import { describe, expect, it } from 'vitest';
import { PAGE_COUNT, type Page } from './mushaf';
import { paceLabel, reciters } from './reciters';
import { averagePage, pageDuration, type Timings } from './timings';

const timings = import.meta.glob<Timings>('./timings/*.json', {
  eager: true,
  import: 'default',
});
const pages = import.meta.glob<Page>('./pages/*.json', {
  eager: true,
  import: 'default',
});
const load = (id: string) => timings[`./timings/${id}.json`];
const page = (n: number) => pages[`./pages/${n}.json`];

describe.each(reciters.map((r) => [r.id, r]))('%s', (id, reciter) => {
  const t = load(id);

  it('is listed at the pace his recording actually has', () => {
    expect(reciter.secondsPerPage).toBeCloseTo(averagePage(t) / 1000, -0.5);
  });

  it('times every page', () => {
    expect(t.pages).toHaveLength(PAGE_COUNT);
    for (let p = 1; p <= PAGE_COUNT; p++) {
      const ms = pageDuration(t, p);
      // The shortest page is the opening of al-Baqarah, the longest a full
      // page read at a teaching pace; anything outside this is a bad cut.
      expect(ms, `page ${p}`).toBeGreaterThan(15_000);
      expect(ms, `page ${p}`).toBeLessThan(8 * 60_000);
    }
  });

  it('plays the surahs actually on each page', () => {
    for (const p of [1, 2, 50, 293, 534, 604])
      expect(t.pages[p - 1].map(([s]) => s)).toEqual(page(p).surahs);
  });

  it('has a believable average page', () => {
    const avg = averagePage(t);
    expect(avg).toBeGreaterThan(60_000);
    expect(avg).toBeLessThan(6 * 60_000);
  });

  it('plays from an https address with the surah in it', () => {
    expect(t.audio).toMatch(/^https:\/\/.+\{n\}\.mp3$/);
  });
});

it('lists the reciters from the most deliberate to the swiftest', () => {
  const paces = reciters.map((r) => r.secondsPerPage);
  expect(paces).toEqual([...paces].sort((a, b) => b - a));
});

it('bands the paces the way a halaqa speaks of them', () => {
  expect(paceLabel(284)).toBe('متأنٍّ جدًّا');
  expect(paceLabel(183)).toBe('متأنٍّ');
  expect(paceLabel(151)).toBe('معتدل');
  expect(paceLabel(108)).toBe('سريع');
});
