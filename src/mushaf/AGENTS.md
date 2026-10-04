# src/mushaf

Drawing one page of the Madani Mushaf.

| File             | What it is                                              |
| ---------------- | ------------------------------------------------------- |
| `MushafPage.tsx` | the page: running head, 15 lines, folio                 |
| `usePage.ts`     | loads a page's data and font together, and prefetches  |
| `fonts.ts`       | one `FontFace` per page, from Quran.com's font host     |

## Why glyphs and not text

Each of the 604 pages has a font of its own, made by the King Fahd Complex, in
which every word of that page is a single glyph drawn as it was printed. The
page data stores each word as its glyph code, so a line is a row of glyphs.
That is the only way a browser shows the Mushaf the way a reader knows it:
the same words on the same lines, the same ligatures and marks. Text in an
Arabic font, however good, reflows and breaks lines in other places.

The glyph codes are private-use characters, meaningless to a screen reader or
to any other font. So every line also carries its Uthmani text (`x`), hidden
from sight in glyph mode and announced by screen readers; and if a page's
font cannot load, the same text becomes the page, set in Amiri Quran on the
same fifteen lines. A page always reads.

## Layout rules

- Every line is the same height and justified edge to edge (`space-between`),
  as the print is. A surah header or a basmala takes exactly one line's room.
- Pages 1 and 2 are the opening spread: eight lines, centred on the page.
- Everything is sized in `cqi`, a share of the page's own width, so the page is
  one fixed shape at any size. Its height over its width is `--page-height`
  in `tokens.css`, and `mushaf.css` itemises what it adds up from. Change a
  size inside the page and update both, or the layout around it will be wrong.
- The basmala is al-Fatihah's first four glyphs from page 1's font
  (`BASMALA_GLYPHS`), so it is the Mushaf's own basmala everywhere. The test
  checks those codes against page 1.
- The surah header is drawn here (a framed cartouche with the name in Amiri),
  not taken from a font.

## Loading

`usePage` renders nothing but a skeleton until both the page's JSON chunk and
its font are in, so codes never flash as boxes. Once a page is drawn it
fetches the next turn's pages and the pages either side, which is why «تمّ»
is instant. Fonts are cached by the browser for a year and by the service
worker for good.
