/* The reciters whose pace a turn can be timed by, and whose recording of a
   page can be played. Each is a Quran.com recitation (`qdc`), because that
   source carries per-ayah timestamps and per-word segments for whole surah
   files, which is what lets a page be measured and played on its own.
   `npm run build:timings` turns them into src/data/timings/<id>.json.

   Ordered from the most deliberate to the swiftest: a halaqa reading at a
   teaching pace wants the top of the list.

   `photo` is a file in public/reciters, cropped from Wikimedia Commons; NOTICE
   names the source and licence of each. A reciter with no freely licensed
   photo shows his initial instead, which is why the field is optional. */

export type Reciter = {
  id: string;
  /** Quran.com recitation id. */
  qdc: number;
  name: string;
  /** Where there is only room for one name. */
  short: string;
  /** Style of the recording, shown under the name. */
  style: string;
  photo?: string;
};

export const reciters: readonly Reciter[] = [
  {
    id: 'husary-muallim',
    qdc: 12,
    name: 'محمود خليل الحصري',
    short: 'الحصري',
    style: 'المصحف المعلّم',
    photo: 'husary.webp',
  },
  {
    id: 'minshawi',
    qdc: 9,
    name: 'محمد صديق المنشاوي',
    short: 'المنشاوي',
    style: 'مرتّل',
    photo: 'minshawi.webp',
  },
  {
    id: 'husary',
    qdc: 6,
    name: 'محمود خليل الحصري',
    short: 'الحصري',
    style: 'مرتّل',
    photo: 'husary.webp',
  },
  {
    id: 'abdulbasit',
    qdc: 2,
    name: 'عبد الباسط عبد الصمد',
    short: 'عبد الباسط',
    style: 'مرتّل',
    photo: 'abdulbasit.webp',
  },
  {
    id: 'alafasy',
    qdc: 7,
    name: 'مشاري راشد العفاسي',
    short: 'العفاسي',
    style: 'مرتّل',
    photo: 'alafasy.webp',
  },
  {
    id: 'rifai',
    qdc: 5,
    name: 'هاني الرفاعي',
    short: 'الرفاعي',
    style: 'مرتّل',
  },
  {
    id: 'shatri',
    qdc: 4,
    name: 'أبو بكر الشاطري',
    short: 'الشاطري',
    style: 'مرتّل',
  },
  {
    id: 'dosari',
    qdc: 97,
    name: 'ياسر الدوسري',
    short: 'الدوسري',
    style: 'مرتّل',
    photo: 'dosari.webp',
  },
  {
    id: 'sudais',
    qdc: 3,
    name: 'عبد الرحمن السديس',
    short: 'السديس',
    style: 'مرتّل',
    photo: 'sudais.webp',
  },
  {
    id: 'shuraim',
    qdc: 10,
    name: 'سعود الشريم',
    short: 'الشريم',
    style: 'مرتّل',
    photo: 'shuraim.webp',
  },
];

export const defaultReciter = 'husary';

export function reciterById(id: string): Reciter {
  return reciters.find((r) => r.id === id) ?? reciters[2];
}
