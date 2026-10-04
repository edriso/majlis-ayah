import { describe, expect, it } from 'vitest';
import {
  endsRound,
  isBeforeStart,
  isPastEnd,
  pagesOf,
  readerOf,
  round,
  type Plan,
} from './schedule';

const start = { turn: 0, page: 20 };

describe('continue mode', () => {
  const plan: Plan = { readers: 3, mode: 'continue', pagesPerTurn: 1 };

  it('gives every turn the page after the last, round the circle', () => {
    const turns = [0, 1, 2, 3, 4, 5].map((t) => [
      readerOf(plan, t),
      pagesOf(plan, start, t),
    ]);
    expect(turns).toEqual([
      [0, [20]],
      [1, [21]],
      [2, [22]],
      [0, [23]],
      [1, [24]],
      [2, [25]],
    ]);
  });

  it('reads several pages a turn', () => {
    const two = { ...plan, pagesPerTurn: 2 };
    expect([0, 1, 2].map((t) => pagesOf(two, start, t))).toEqual([
      [20, 21],
      [22, 23],
      [24, 25],
    ]);
  });

  it('cuts the last turn short at page 604, and knows when it is over', () => {
    const three = { ...plan, pagesPerTurn: 3 };
    const end = { turn: 0, page: 602 };
    expect(pagesOf(three, end, 0)).toEqual([602, 603, 604]);
    expect(pagesOf(three, end, 1)).toEqual([]);
    expect(isPastEnd(three, end, 1)).toBe(true);
    const near = { turn: 0, page: 603 };
    expect(pagesOf(three, near, 0)).toEqual([603, 604]);
  });

  it('cannot step back before page 1', () => {
    expect(isBeforeStart(plan, { turn: 1, page: 1 }, 0)).toBe(true);
    expect(isBeforeStart(plan, { turn: 1, page: 2 }, 0)).toBe(false);
  });
});

describe('repeat mode', () => {
  const plan: Plan = { readers: 3, mode: 'repeat', pagesPerTurn: 1 };

  it('has everyone read the same page before moving on', () => {
    const turns = [0, 1, 2, 3, 4, 5].map((t) => [
      readerOf(plan, t),
      pagesOf(plan, start, t)[0],
    ]);
    expect(turns).toEqual([
      [0, 20],
      [1, 20],
      [2, 20],
      [0, 21],
      [1, 21],
      [2, 21],
    ]);
  });

  it('ends a round on the last reader', () => {
    expect([0, 1, 2, 3].map((t) => endsRound(plan, t))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('marks who has read in this round', () => {
    expect(round(plan, start, 1).map((s) => s.state)).toEqual([
      'done',
      'now',
      'waiting',
    ]);
  });

  it('does not tick a reader who read before the halaqa jumped here', () => {
    const jumped = { turn: 1, page: 50 };
    expect(round(plan, jumped, 1).map((s) => s.state)).toEqual([
      'skipped',
      'now',
      'waiting',
    ]);
    expect(pagesOf(plan, jumped, 3)).toEqual([51]);
  });
});

it('wraps a single reader back to themself', () => {
  const plan: Plan = { readers: 1, mode: 'continue', pagesPerTurn: 1 };
  expect([0, 1, 2].map((t) => readerOf(plan, t))).toEqual([0, 0, 0]);
  expect(pagesOf(plan, start, 2)).toEqual([22]);
});
