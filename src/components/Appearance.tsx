import type { Photos, Prefs, Theme, View } from '@/halaqa/state';
import { Choice } from './Choice';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'burgundy', label: 'عنّابي' },
  { value: 'green', label: 'أخضر' },
  { value: 'blue', label: 'أزرق' },
  { value: 'sand', label: 'رملي' },
];

/**
 * How the app looks: its colour, how the reciters' photographs appear, and
 * on a wide screen which part of the reading screen gets the room. The same
 * fields in the settings of a halaqa and behind the gear on the start
 * screen, where the photographs are first seen.
 */
export function AppearanceFields({
  prefs,
  onChange,
  withView = false,
}: {
  prefs: Prefs;
  onChange: (prefs: Partial<Prefs>) => void;
  /** The reading screen's layout, which only a wide screen has. */
  withView?: boolean;
}) {
  return (
    <>
      <Choice<Theme>
        legend="اللون"
        value={prefs.theme}
        onChange={(theme) => onChange({ theme })}
        options={THEMES.map((t) => ({
          value: t.value,
          label: (
            <>
              <span
                className="swatch"
                data-swatch={t.value}
                aria-hidden="true"
              />
              {t.label}
            </>
          ),
        }))}
      />
      <div className="field">
        <Choice<Photos>
          legend="صور القرّاء"
          value={prefs.photos}
          onChange={(photos) => onChange({ photos })}
          options={[
            { value: 'show', label: 'ظاهرة' },
            { value: 'blur', label: 'مموّهة' },
            { value: 'hide', label: 'مخفية' },
          ]}
        />
        <p className="field-note">
          إن مُوِّهت لم تُعرف الوجوه، وإن أُخفيت لم تُحمَّل أصلًا، ويظهر مكانها الحرف الأول
          من اسم القارئ.
        </p>
      </div>
      {withView ? (
        <Choice<View>
          legend="العرض"
          value={prefs.view}
          onChange={(view) => onChange({ view })}
          options={[
            { value: 'quran', label: 'المصحف' },
            { value: 'balanced', label: 'متوازن' },
            { value: 'halaqa', label: 'الحلقة' },
          ]}
        />
      ) : null}
    </>
  );
}
