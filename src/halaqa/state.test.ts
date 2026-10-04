import { describe, expect, it } from 'vitest';
import {
  currentPage,
  currentPages,
  defaultConfig,
  initialState,
  isComplete,
  readerName,
  reduce,
  sanitizeState,
  turnPhrase,
  type Action,
  type Config,
  type State,
} from './state';
import { readerOf } from './schedule';

const run = (config: Partial<Config>, ...actions: Action[]) =>
  actions.reduce(
    reduce,
    reduce(initialState, {
      type: 'start',
      config: { ...defaultConfig, ...config },
    }),
  );

const where = (s: State) => {
  const session = s.session!;
  return {
    page: currentPage(session),
    reader: session.turn % session.config.readers.length,
  };
};

describe('a halaqa', () => {
  it('runs the example session from the brief', () => {
    // Al-Baqarah from page 2, three readers, continue, one page each.
    let s = run({ startPage: 2 });
    const seen = [where(s)];
    for (let i = 0; i < 3; i++) {
      s = reduce(s, { type: 'finishTurn' });
      seen.push(where(s));
    }
    expect(seen).toEqual([
      { page: 2, reader: 0 },
      { page: 3, reader: 1 },
      { page: 4, reader: 2 },
      { page: 5, reader: 0 },
    ]);
    expect(s.session!.pagesRead).toBe(3);
  });

  it('steps through a turn of two pages before passing it on', () => {
    let s = run({ startPage: 20, pagesPerTurn: 2 });
    expect(currentPages(s.session!)).toEqual([20, 21]);
    s = reduce(s, { type: 'nextPage' });
    expect(where(s)).toEqual({ page: 21, reader: 0 });
    s = reduce(s, { type: 'finishTurn' });
    expect(where(s)).toEqual({ page: 22, reader: 1 });
  });

  it('counts a repeated page once, when the round completes', () => {
    let s = run({ startPage: 24, mode: 'repeat' });
    s = reduce(s, { type: 'finishTurn' });
    s = reduce(s, { type: 'finishTurn' });
    expect(s.session!.pagesRead).toBe(0);
    s = reduce(s, { type: 'finishTurn' });
    expect(s.session!.pagesRead).toBe(1);
    expect(where(s)).toEqual({ page: 25, reader: 0 });
  });

  it('goes back to the previous reader and un-counts their pages', () => {
    let s = run({ startPage: 10 }, { type: 'finishTurn' });
    s = reduce(s, { type: 'previousTurn' });
    expect(where(s)).toEqual({ page: 10, reader: 0 });
    expect(s.session!.pagesRead).toBe(0);
    expect(reduce(s, { type: 'previousTurn' })).toBe(s);
  });

  it('moves the whole circle one page on past the end of a turn', () => {
    let s = run({ startPage: 10 });
    s = reduce(s, { type: 'nextPage' });
    expect(where(s)).toEqual({ page: 11, reader: 0 });
    s = reduce(s, { type: 'finishTurn' });
    expect(where(s)).toEqual({ page: 12, reader: 1 });
  });

  it('jumps to a page with the same reader', () => {
    let s = run({ startPage: 10 }, { type: 'finishTurn' });
    s = reduce(s, { type: 'goToPage', page: 300 });
    expect(where(s)).toEqual({ page: 300, reader: 1 });
    s = reduce(s, { type: 'finishTurn' });
    expect(where(s)).toEqual({ page: 301, reader: 2 });
  });

  it('keeps the page and the reader when the circle changes shape', () => {
    let s = run({ startPage: 10 }, { type: 'finishTurn' });
    const config = { ...s.session!.config, mode: 'repeat' as const, pagesPerTurn: 2 };
    s = reduce(s, { type: 'configure', config });
    expect(where(s)).toEqual({ page: 11, reader: 1 });
    expect(currentPages(s.session!)).toEqual([11, 12]);
    // Two readers now: reader 3 is gone, so a reader beyond the circle
    // falls back to the last seat.
    s = reduce(s, { type: 'configure', config: { ...config, readers: ['', ''] } });
    expect(readerOf({ readers: 2, mode: 'repeat', pagesPerTurn: 2 }, s.session!.turn)).toBe(1);
  });

  it('completes the Mushaf, then starts a new khatma from al-Fatihah', () => {
    let s = run({ startPage: 604, readers: [''] }, { type: 'finishTurn' });
    expect(isComplete(s.session!)).toBe(true);
    expect(reduce(s, { type: 'finishTurn' })).toBe(s);
    s = reduce(s, { type: 'restartMushaf' });
    expect(where(s)).toEqual({ page: 1, reader: 0 });
  });

  it('ends', () => {
    expect(run({}, { type: 'end' }).session).toBeNull();
  });
});

describe('reader names', () => {
  const config = { ...defaultConfig, readers: ['', 'عمر', ''] };
  it('defaults the first seat to the person holding the device', () => {
    expect(readerName(config, 0)).toBe('أنت');
    expect(turnPhrase(config, 0)).toBe('دورك');
  });
  it('uses a given name', () => {
    expect(turnPhrase(config, 1)).toBe('دور عمر');
  });
  it('numbers the rest', () => {
    expect(readerName(config, 2)).toBe('القارئ الثالث');
  });
});

describe('a saved halaqa', () => {
  it('survives a round trip', () => {
    const s = run({ startPage: 77 }, { type: 'finishTurn' });
    expect(sanitizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('is repaired, never trusted', () => {
    const s = sanitizeState({
      prefs: { theme: 'neon', view: 7 },
      config: { readers: 'x', pagesPerTurn: 9, startPage: 9000 },
      session: { turn: -3, anchor: { turn: 5, page: 0 }, config: {} },
    });
    expect(s.prefs).toEqual({ theme: 'burgundy', view: 'balanced' });
    expect(s.config.pagesPerTurn).toBe(1);
    expect(s.config.startPage).toBe(1);
    expect(s.session!.turn).toBe(0);
    expect(s.session!.anchor).toEqual({ turn: 0, page: 1 });
  });

  it('starts fresh from nothing', () => {
    expect(sanitizeState(null)).toEqual(initialState);
  });
});
