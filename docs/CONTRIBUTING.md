# Working on Majlis Ayah

This is the on-ramp. It assumes you know React and have never seen this
repository, and it does not assume you read Arabic. [AGENTS.md](../AGENTS.md)
is the reference behind it; read this for *where*, and that for *why*.

## In one minute

A few people want to read the Quran together the way a mosque halaqa does:
one reads a page aloud while the others follow, then the next reader takes
the next page (or, in repeat mode, the same page). This app keeps the circle
for them: it shows the page, whose turn it is and who is next, and one button
passes the turn on.

There is no server. The app is a static page, the Mushaf pages are JSON files
in the repository, and the halaqa is saved in `localStorage`.

## Get it running

```sh
npm install
npm run dev
```

Before you commit, all of these must pass. CI runs the same.

```sh
npm test
npm run lint
npx oxfmt --check     # npm run format fixes it
npm run build
```

## Where to go for what

| You want to change…                        | Open                                          |
| ------------------------------------------ | --------------------------------------------- |
| who reads which page, continue / repeat    | `src/halaqa/schedule.ts`, `src/halaqa/state.ts` |
| what the start screen asks                 | `src/components/SetupScreen.tsx`, `HalaqaForm.tsx` |
| the reading screen, the main button        | `src/components/ReadingScreen.tsx`            |
| the circle of readers                      | `src/components/HalaqaCircle.tsx`             |
| the "now / next / then" list               | `src/components/ReadingOrder.tsx`             |
| the settings drawer                        | `src/components/SettingsPanel.tsx`            |
| how a Mushaf page is drawn                 | `src/mushaf/MushafPage.tsx`, `styles/mushaf.css` |
| the reciters                               | `src/data/reciters.ts`, then `npm run build:timings` |
| colours and themes                         | `src/styles/tokens.css` (contrast is tested)  |
| layout per screen size and view            | `src/styles/reading.css`                      |
| Arabic numbers and counted nouns           | `src/data/arabic.ts`                          |

## A first change, end to end

Say you want a fourth reader.

1. `MAX_READERS` in `src/halaqa/state.ts` is the limit; `sanitizeConfig()`
   cuts stored readers to it.
2. The circle needs seat angles for four in `SEAT_ANGLES`
   (`HalaqaCircle.tsx`), and the reader-count choice an option and a drawing
   (`HalaqaForm.tsx`, `Seats`).
3. Add a case to `src/halaqa/schedule.test.ts` for four readers in both
   modes, and run `npm test`.
4. Look at it on a phone width (390px) and at 1440px, in all three views.
5. Update the README's feature list, which is in Arabic. If you do not write
   Arabic, say so in the pull request and someone will.

## Things that will bite you

- **The Mushaf data is generated.** Never edit `src/data/pages/*.json` by
  hand; change `scripts/build-mushaf.ts` and rebuild. The tests check every
  ayah.
- **Sizes inside the page are tied together.** Change a line height in
  `mushaf.css` and you must update `--page-height` in `tokens.css`.
- **Paths.** The site lives under a sub-path on GitHub Pages; use
  `%BASE_URL%` in `index.html` and `import.meta.env.BASE_URL` in code.
- **Arabic numerals.** Use `arabic()` and the counters in `arabic.ts`, never
  a number pasted into a string.
- **A new third-party file** (photo, font, data) needs its line in `NOTICE`.
