import { arabic } from '@/data/arabic';

/**
 * A turn's pages as a label: «الصفحة ٢٤», «الصفحتان ٢٤ و٢٥»,
 * «الصفحات ٢٤–٢٦». A turn cut short by the end of the Mushaf can hold fewer
 * pages than the halaqa reads per turn, so this reads the pages themselves.
 */
export function pagesLabel(pages: readonly number[]) {
  if (pages.length === 0) return '';
  if (pages.length === 1) return `الصفحة ${arabic(pages[0])}`;
  if (pages.length === 2)
    return `الصفحتان ${arabic(pages[0])} و${arabic(pages[1])}`;
  return `الصفحات ${arabic(pages[0])}–${arabic(pages[pages.length - 1])}`;
}

/** The same, short enough for a seat in the circle: «ص ٢٤» or «ص ٢٤–٢٥». */
export function pagesShort(pages: readonly number[]) {
  if (pages.length === 0) return '';
  if (pages.length === 1) return `ص ${arabic(pages[0])}`;
  return `ص ${arabic(pages[0])}–${arabic(pages[pages.length - 1])}`;
}

/** The initial a seat shows: a named reader's first letter, or the seat's
    number for an unnamed one, since «أ» for «أنت» says nothing. */
export function seatMark(name: string, i: number) {
  const first = name.trim().at(0);
  return first ?? arabic(i + 1);
}
