# src/halaqa

Who reads which page, and everything that changes it. No React here except
the files named `use*.ts`.

| File              | What it is                                                    |
| ----------------- | ------------------------------------------------------------- |
| `schedule.ts`     | pure functions: a turn number in, a reader and pages out      |
| `state.ts`        | the whole halaqa as one value, the reducer, `sanitizeState()` |
| `storage.ts`      | `localStorage`, one key, never throws                         |
| `labels.ts`       | «الصفحة ٢٤»، «الصفحتان ٢٤ و٢٥»، «ص ٢٤»                          |
| `useHalaqa.ts`    | the reducer, saved after every change                         |
| `useTurnClock.ts` | the countdown of a reciter-timed turn                         |
| `usePageAudio.ts` | plays a reciter's recitation of one page                      |

## The model

Nothing about the past is stored. A halaqa is:

- `turn`, a counter that only ever goes up by «تمّ» and down by «القارئ
  السابق». The reader is always `turn % readers`, so the circle goes round in
  the order it was set up.
- `anchor`, one turn whose first page is known. Every other turn's pages are
  counted from it:
  - continue: `anchor.page + (turn - anchor.turn) * pagesPerTurn`
  - repeat: the same, counted in rounds (`floor(turn / readers)`) instead of
    turns, so everyone in a round reads the same pages.
- `pageInTurn`, which of a multi-page turn's pages is open.
- `pagesRead`, the one number about the sitting that is shown.

Starting anchors turn 0 at the chosen page. **Jumping re-anchors the current
turn** at its new page, and so does stepping one page past the end of a turn
(the whole circle moves one page on) and changing the circle's shape in the
settings. Re-anchoring keeps the turn number, so the same reader keeps the
turn and nobody loses their place.

Two consequences that look like bugs and are not:

- In continue mode, the order panel never shows a turn from before the anchor
  as "read": those pages no longer follow from the current ones.
- In repeat mode, a reader whose turn in the current round came before the
  anchor is shown as `skipped` («لم يقرأها»), not ticked: the halaqa jumped
  here after they read.

Changing the number of readers, the mode or the pages per turn moves the turn
counter to a fresh round (`(round + 1) * readers + reader`) so the modulo still
names the same reader, clamped to the last seat if their seat was removed.
Renaming a reader, or changing the reciter or the turn change, changes nothing
about the schedule.

## The end of the Mushaf

`pagesOf()` cuts a turn short at page 604, and a turn with no pages left
means the Mushaf is complete (`isComplete()`); the reading screen shows the
khatm card instead of a page, and «ختمة جديدة من الفاتحة» re-anchors the
current turn at page 1. «القارئ السابق» refuses a turn that would begin before
page 1 (`isBeforeStart()`).

## Timed turns

`useTurnClock` belongs to one turn at a time (`turnKey`): a new turn starts a
fresh, running clock whether or not the last one was paused. It measures time
between ticks rather than counting ticks, because a background tab slows
timers, and a halaqa over a video call has the call in front. When it reaches
zero it calls `onExpire`, which is the same `finishTurn` the button calls.

The turn's length is the reciter's duration over exactly the turn's pages
(`pagesDuration()`), so a turn of two pages is timed by two pages, and a
turn cut short at page 604 by what is left.

## Saved state

`sanitizeState()` is the only way stored data comes back in. It repairs
rather than rejects: an unknown theme becomes burgundy, a page out of range
becomes 1, an anchor after the turn becomes turn 0. `state.test.ts` has a
round trip and a hostile value; add to it whenever `State` changes shape.
