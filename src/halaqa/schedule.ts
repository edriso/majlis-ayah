/* Who reads which pages, worked out from nothing but a turn number.

   A halaqa is a circle of one to three readers taking turns. Turn `t` belongs
   to reader `t % readers`, always, so the circle goes round in the order it
   was set up and wraps back to the first reader. What a turn covers depends
   on the mode:

     continue  every turn reads the pages after the last turn's
               (reader 1: 20, reader 2: 21, reader 3: 22, reader 1: 23 …)
     repeat    every reader reads the same pages before the circle moves on
               (reader 1: 20, reader 2: 20, reader 3: 20, reader 1: 21 …)

   Both are counted from an anchor, a turn whose first page is known. Starting
   a halaqa anchors turn 0 at the chosen page; jumping to another page, or
   changing the settings mid-way, re-anchors the current turn at its new page,
   so the turns before it keep the pages they were read on and every turn
   after follows on from the new one. Nothing else is stored. */

import { PAGE_COUNT } from '@/data/mushaf';

export type Mode = 'continue' | 'repeat';

export type Plan = {
  readers: number;
  mode: Mode;
  pagesPerTurn: number;
};

export type Anchor = { turn: number; page: number };

export const readerOf = (plan: Plan, turn: number) =>
  ((turn % plan.readers) + plan.readers) % plan.readers;

/** Which round of the circle a turn falls in; in repeat mode, a round is
    everyone reading the same pages once. */
export const roundOf = (plan: Plan, turn: number) =>
  Math.floor(turn / plan.readers);

/**
 * The first page a turn reads. May fall outside 1 to 604: past the end is
 * how the end of the Mushaf shows itself, and the caller decides what to do
 * with a turn there (see `isPastEnd`).
 */
export function firstPageOf(plan: Plan, anchor: Anchor, turn: number) {
  const steps =
    plan.mode === 'continue'
      ? turn - anchor.turn
      : roundOf(plan, turn) - roundOf(plan, anchor.turn);
  return anchor.page + steps * plan.pagesPerTurn;
}

/** The pages a turn reads, cut short at the last page of the Mushaf. */
export function pagesOf(plan: Plan, anchor: Anchor, turn: number): number[] {
  const first = firstPageOf(plan, anchor, turn);
  const pages: number[] = [];
  for (let p = first; p < first + plan.pagesPerTurn; p++)
    if (p >= 1 && p <= PAGE_COUNT) pages.push(p);
  return pages;
}

/** A turn with nothing left to read: the Mushaf has been completed. */
export const isPastEnd = (plan: Plan, anchor: Anchor, turn: number) =>
  firstPageOf(plan, anchor, turn) > PAGE_COUNT;

/** A turn that would begin before the first page, which cannot be stepped
    back to. */
export const isBeforeStart = (plan: Plan, anchor: Anchor, turn: number) =>
  firstPageOf(plan, anchor, turn) + plan.pagesPerTurn - 1 < 1;

/**
 * Re-anchors a halaqa so that `turn` begins on `page`. Used for a jump, for
 * stepping one page past the current turn, and when the settings change
 * mid-way. In repeat mode the anchor is the turn itself, so whoever has
 * already read in this round keeps the pages they read.
 */
export const anchorAt = (turn: number, page: number): Anchor => ({
  turn,
  page,
});

export type Seat = {
  turn: number;
  reader: number;
  pages: number[];
};

/**
 * The order panel for continue mode: the turn just finished, the one being
 * read, and the next two, which is enough to answer "who reads next?" without
 * turning into a timetable.
 */
export function upcoming(plan: Plan, anchor: Anchor, turn: number): Seat[] {
  const seats: Seat[] = [];
  for (let t = turn - 1; t <= turn + 2; t++) {
    // A turn before the anchor was read on pages that no longer follow from
    // it, so it is not shown as though it had been.
    if (t < 0 || t < anchor.turn) continue;
    const pages = pagesOf(plan, anchor, t);
    if (pages.length === 0) continue;
    seats.push({ turn: t, reader: readerOf(plan, t), pages });
  }
  return seats;
}

export type RoundSeat = Seat & {
  state: 'done' | 'now' | 'waiting' | 'skipped';
};

/**
 * The round panel for repeat mode: every reader against the pages this round
 * is on. A reader whose turn in this round came before the anchor did not
 * read these pages (the halaqa jumped here after them), so they are shown as
 * skipped rather than ticked.
 */
export function round(plan: Plan, anchor: Anchor, turn: number): RoundSeat[] {
  const start = roundOf(plan, turn) * plan.readers;
  return Array.from({ length: plan.readers }, (_, i) => {
    const t = start + i;
    const state =
      t === turn
        ? 'now'
        : t > turn
          ? 'waiting'
          : t < anchor.turn
            ? 'skipped'
            : 'done';
    return { turn: t, reader: i, pages: pagesOf(plan, anchor, t), state };
  });
}

/** Whether finishing this turn completes a round, which in repeat mode is
    when the circle moves on to new pages. */
export const endsRound = (plan: Plan, turn: number) =>
  readerOf(plan, turn) === plan.readers - 1;
