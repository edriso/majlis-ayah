# AGENTS.md

Notes for anyone, human or AI, working on Majlis Ayah.

## What this app is

Majlis Ayah (`مجلس آية`) recreates a Quran halaqa in a mosque: one to three
readers sit in a circle and take turns reading the Madani Mushaf, page by
page. It is a static web app. There is no server, no database, no accounts
and no analytics; everything a reader does stays in their browser.

There are two screens and no router:

- **The start screen** (`SetupScreen`). Where to start (surah, juz or page),
  how many readers and their names, continue or repeat, pages per turn,
  manual or reciter-timed turns. A halaqa left open is offered first, as one
  card.
- **The reading screen** (`ReadingScreen`). The Mushaf page, the circle, the
  reading order, and one primary button that passes the turn on.

The brief the app was built from asks for this order of importance on every
screen, and every decision should protect it: **1. the Quran, 2. the current
reader, 3. the next reader, 4. progress, 5. everything else.** When unsure
whether to add an element, leave it out. No points, streaks, badges, charts
or statistics: the only number about the sitting is how many pages were read.

The interface is Arabic only and right to left. Code, comments and these
documents are in English.

## Commands

```sh
npm install
npm run dev        # local server
npm test           # vitest, no watch
npm run lint       # oxlint over src and scripts (type-aware)
npm run format     # oxfmt
npm run build      # tsc, then vite build
npm run preview    # serve the built app
```

Run `npm test`, `npm run lint`, `npx oxfmt --check` and `npm run build`
before you commit. All four must pass; the GitHub Pages workflow runs the same
four and deploys `main`.

Three commands regenerate something committed. You will rarely need them;
each script's header says what it does and why.

```sh
npm run build:mushaf     # src/data/pages/*.json and src/data/mushaf.json
npm run build:timings    # src/data/timings/*.json (after build:mushaf)
node scripts/make-assets.ts   # icons and share card, in headless Chrome
```

Both data scripts cache every API response under `.cache/` (ignored by git)
and take `--offline` to rebuild from that cache alone.

## Where things are

```
src/
  App.tsx             the shell: which screen, the theme on <html>
  data/               the Mushaf index and pages, reciters, timings, Arabic
  halaqa/             the halaqa itself: who reads what (see its AGENTS.md)
  mushaf/             drawing a Mushaf page (see its AGENTS.md)
  components/         the screens and their parts
  hooks/              small browser hooks: wake lock, media queries
  styles/             tokens, base, and one stylesheet per area
scripts/              offline tools that build the committed data
public/               icons, share card, manifest, service worker, photos
docs/CONTRIBUTING.md  the walk-through for a first change
LICENSE               0BSD: everything written here, no conditions
NOTICE                what is only redistributed, and on whose terms
```

`src/halaqa` and `src/data` are plain functions apart from the files named
`use*.ts`, so they are tested without a browser. Keep it that way.

## Rules you must not break

**Never alter the Quran.** The pages in `src/data/pages/` are generated and
the glyph codes and text in them are the Mushaf. Do not hand-edit them, do not
"fix" a word, and do not reflow a page. `src/data/mushaf.test.ts` checks that
all 6,236 ayat are present once each and in order, that every page has 15
lines (8 on pages 1 and 2), that every surah has its header and basmala, and
that the fifteen prostrations are marked. If it fails, you broke something.

**The page is a page.** The Mushaf is never set as flowing text. Each page is
drawn on its own lines in its own font, every line justified edge to edge as
the print is; see `src/mushaf/AGENTS.md`.

**Do not send user data anywhere.** The halaqa (names, page, settings) lives
in `localStorage` under one key and nowhere else.

**The storage key is a contract.** It is `majlis-ayah:v1`, read by
`src/halaqa/storage.ts` and again by the inline script in `index.html` that
paints the theme before the bundle loads. Renaming it strands every saved
halaqa unless the first read adopts the old key. Whatever is read back goes
through `sanitizeState()`, which never trusts it.

**Nothing may assume the site's path.** GitHub Pages serves the app under
`/majlis-ayah/`. `vite.config.ts` takes `base` from `VITE_BASE_PATH`, which the
workflow takes from `actions/configure-pages`. So:

- In `index.html`, every path goes through `%BASE_URL%`. A hand-written
  `/favicon.svg` looks for the file at the domain root.
- In `public/manifest.webmanifest`, every path is relative (`"."`,
  `"icon-192.png"`): Vite copies that file without reading it.
- In code, public files are reached through `import.meta.env.BASE_URL`, as the
  reciter photos and the service worker are.
- The share card is the one absolute address: `%SHARE_CARD%` in `index.html`,
  filled from `VITE_SITE_URL`. A link scraper will not resolve a relative one.
- Never write the repository's name into code, a script or a test.

**Third-party material goes in NOTICE in the same pass.** Everything written
here is 0BSD, so do not add licence headers or credit lines. The Mushaf data,
the timings and the photographs are the opposite case; NOTICE says what each
is and on what terms. A new photo, font, dataset or audio source gets its entry
when it arrives. The photo of `dosari.webp` is CC BY-SA 4.0, and so is any
crop of it.

## Data

Built once by scripts, committed, never fetched from an API at run time.

- **Mushaf pages** (`scripts/build-mushaf.ts`): the Quran.com API's word-level
  data for the King Fahd Complex Madani Mushaf of 1421H, the layout whose page
  fonts Quran.com serves as "v2". The API's `page_number` and `line_number`
  are that layout; `v1_page` is the older print and disagrees on 361 words, so
  never mix them. `by_page` pages by the older print, which is why words are
  gathered from every response and placed by their own page number.
  - The API leaves out the lines that hold a surah header or a basmala. The
    script infers them: a run of empty lines belongs to the surah that starts
    right after it, header then basmala (only a header for al-Fatihah and
    at-Tawbah). The run can end one page and the surah start the next, as on
    page 341. The script throws if any page comes out wrong.
  - Prostrations are read from the ۩ in the ayah's text, not from the API's
    `sajdah_number`, which leaves out al-Hajj 77. The print marks fifteen.
  - The Madani Mushaf ends every page on a whole ayah. Code relies on that
    (timings never cut an ayah) and the tests check it.
- **Timings** (`scripts/build-timings.ts`): per-ayah timestamps of whole-surah
  recordings, from Quran.com's `qdc` audio API. For each reciter and page, the
  stretch (or two stretches, where a page holds two surahs) of the surah file
  that covers it. One table serves both reciter-timed turns (summed into a
  duration) and listening (the surah file played from one timestamp to the
  other, see `usePageAudio.ts`).
- **Page fonts** are fetched at run time from `static.qurancdn.com`, which
  answers with `access-control-allow-origin: *` and a year-long cache. They
  are not in the repository. See `src/mushaf/fonts.ts`.
- **Reciters** are listed in `src/data/reciters.ts`, ordered from the most
  deliberate to the swiftest. Adding one: add the entry with its Quran.com
  `qdc` id, run `npm run build:timings`, and add a photo only if a freely
  licensed one exists (and its NOTICE entry); otherwise the avatar shows his
  initial. `timings.test.ts` checks every page of every reciter.

## Style

- Copy shown to the user is Arabic. Names in code are English.
- Comments say **why**, not what. If a line looks odd, explain the reason.
- Numbers shown to the user use Arabic-Indic digits through `arabic()` in
  `src/data/arabic.ts`, and counted nouns go through `counted()` and its
  helpers (`pagesCount`, …), never `${n} صفحات` by hand: the noun after a
  number changes with the number (صفحتان، ٣ صفحات، ١١ صفحة).
- A field that takes a number is never `type="number"`: it throws away ٢٤,
  which is what an Arabic keyboard types. Use `type="text"` with
  `inputMode="numeric"` and read it back through `digits()`.
- Do not add a dependency unless there is no reasonable way around it. The app
  ships React, Base UI's dialog and lucide icons, and nothing else.
- The linter runs the React Compiler rules. It rejects impure calls during
  render (`Date.now()`), reading refs during render, and `setState` straight
  from an effect body. Restructure instead of silencing it.

## Accessibility

- Every touch target is at least 44 by 44 pixels. Every control has an
  accessible name; `app.test.tsx` fails on any button, input, select or link
  without one, on both screens.
- Choices are native radio inputs styled as buttons (`Choice.tsx`), so arrow
  keys and screen readers work with nothing added. Keep new choices on it.
- Text meets WCAG AA in all three themes. The table at the head of
  `src/styles/tokens.css` is enforced by `src/styles/contrast.test.ts`, which
  recomputes it from the colours actually declared. Do not fade text with
  `opacity`; use `--muted`, which is chosen to pass.
- Each Mushaf line carries its Uthmani text, hidden from sight, for screen
  readers: the glyphs are private-use code points that mean nothing to them.
- Whose turn it is lives in an `<output>` that a screen reader announces when
  the turn moves.
- `prefers-reduced-motion` stills every transition and animation.

## Keyboard

Keys live in one effect in `ReadingScreen.tsx`.

| Key     | What it does                                           |
| ------- | ------------------------------------------------------ |
| `←`     | the primary action: next page in the turn, or «تمّ»    |
| `→`     | back: previous page in the turn, or the previous reader |
| `Space` | pause or resume a timed turn, when no button has focus  |

Left is forward because a right-to-left book turns that way. Arrows are used
rather than letters because a single-letter shortcut must be remappable to
pass WCAG 2.1.4, and arrows are exempt. A focused button owns Space and Enter,
a field owns every key, and an open sheet owns the keyboard, so the handler
steps aside for all three. If you add a key, add it to the handler, the
`aria-keyshortcuts` of its button, the list in `SettingsPanel.tsx`, and the
README.

## Layout

The reading screen has three bands (`src/styles/reading.css`): phone under
760px (the page and the turn; the circle opens in a sheet), tablet to 1099px
(the page and a narrow side column), desktop from 1100px (circle, page, order,
sized by the chosen view).

The Mushaf page is sized by width alone. Everything inside it is in `cqi`, so
it is a fixed shape, `--page-height` times its width, declared in
`tokens.css` and itemised in `mushaf.css`. The layout gives it a height to fit
(`--stage-h`) and the page takes `min(column, stage-h / page-height)`. Change
anything inside the page and you must update `--page-height`, or the page will
overflow or float in its frame.

Measured in Chrome: no horizontal overflow from 320px up, in both manual and
timed turns. The action bar is the widest thing on a phone; `.reading-quran`
has an explicit `minmax(0, 1fr)` track so it can never push the page wider
than the screen, which it once did.

## Offline

`public/sw.js` is a hand-written service worker, registered only in
production: the page network-first, hashed assets and page fonts cache-first,
recitations never cached. Bump its `VERSION` to drop every cache it made.
