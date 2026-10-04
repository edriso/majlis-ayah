import { ChevronLeft } from 'lucide-react';
import { useId } from 'react';
import { arabic, ordinal } from '@/data/arabic';
import { reciterById } from '@/data/reciters';
import {
  MAX_READERS,
  readerName,
  type Config,
  type TurnChange,
} from '@/halaqa/state';
import type { Mode } from '@/halaqa/schedule';
import { Choice } from './Choice';
import { ReciterAvatar } from './ReciterAvatar';

/**
 * The shape of the circle: how many sit in it and what they are called, how
 * the pages pass between them, how much each reads, and what moves the turn
 * on. The same form on the start screen and in the settings, so a halaqa is
 * set up and changed in one vocabulary.
 */
export function HalaqaForm({
  config,
  onChange,
  onPickReciter,
}: {
  config: Config;
  onChange: (config: Config) => void;
  onPickReciter: () => void;
}) {
  const id = useId();
  const count = config.readers.length;
  const set = (patch: Partial<Config>) => onChange({ ...config, ...patch });
  const reciter = reciterById(config.reciter);

  const setCount = (n: number) => {
    // Names typed for a seat that is taken away come back if it is restored
    // in the same visit, because the array is cut and padded, never cleared.
    const readers = [...config.readers];
    while (readers.length < n) readers.push('');
    set({ readers: readers.slice(0, n) });
  };

  return (
    <div className="halaqa-form">
      <Choice<number>
        legend="عدد القرّاء"
        variant="seats"
        value={count}
        onChange={setCount}
        options={Array.from({ length: MAX_READERS }, (_, i) => ({
          value: i + 1,
          label: <Seats n={i + 1} />,
          ariaLabel: ['قارئ واحد', 'قارئان', 'ثلاثة قرّاء'][i],
        }))}
      />

      <div className="reader-names">
        {config.readers.map((name, i) => (
          <div className="field reader-name" key={i}>
            <label className="field-label-small" htmlFor={`${id}-r${i}`}>
              القارئ {ordinal(i + 1)}
            </label>
            <input
              id={`${id}-r${i}`}
              className="input"
              type="text"
              autoComplete="off"
              maxLength={40}
              placeholder={readerName({ ...config, readers: [] }, i)}
              value={name}
              onChange={(e) => {
                const readers = [...config.readers];
                readers[i] = e.target.value;
                set({ readers });
              }}
            />
          </div>
        ))}
        <p className="field-note">الأسماء اختيارية.</p>
      </div>

      {count > 1 && (
        <Choice<Mode>
          legend="طريقة القراءة"
          variant="cards"
          value={config.mode}
          onChange={(mode) => set({ mode })}
          options={[
            {
              value: 'continue',
              label: 'التتابع',
              hint: 'يقرأ كل قارئ الصفحة التالية.',
            },
            {
              value: 'repeat',
              label: 'تكرار الصفحة',
              hint: 'يقرأ الجميع الصفحة نفسها ثم ننتقل.',
            },
          ]}
        />
      )}

      <Choice<number>
        legend="صفحات كل دور"
        value={config.pagesPerTurn}
        onChange={(pagesPerTurn) => set({ pagesPerTurn })}
        options={[1, 2, 3].map((n) => ({
          value: n,
          label: arabic(n),
          ariaLabel: ['صفحة واحدة', 'صفحتان', 'ثلاث صفحات'][n - 1],
        }))}
      />

      <Choice<TurnChange>
        legend="الانتقال إلى القارئ التالي"
        variant="cards"
        value={config.turnChange}
        onChange={(turnChange) => set({ turnChange })}
        options={[
          {
            value: 'manual',
            label: 'يدوي',
            hint: 'يضغط القارئ «تمّ» حين ينتهي.',
          },
          {
            value: 'reciter',
            label: 'بتوقيت قارئ',
            hint: 'ينتقل الدور بعد مدة تلاوة القارئ للصفحة.',
          },
        ]}
      />

      <button type="button" className="reciter-button" onClick={onPickReciter}>
        <ReciterAvatar reciter={reciter} size={40} />
        <span className="reciter-text">
          <span className="reciter-caption">
            {config.turnChange === 'reciter' ? 'التوقيت والاستماع' : 'الاستماع'}
          </span>
          <span className="reciter-name">{reciter.name}</span>
        </span>
        <ChevronLeft size={18} aria-hidden="true" />
        <span className="visually-hidden">، تغيير القارئ</span>
      </button>
    </div>
  );
}

/** The reader-count choice drawn as seats around a small circle. */
function Seats({ n }: { n: number }) {
  const angles = { 1: [90], 2: [0, 180], 3: [30, -90, 150] }[n] ?? [];
  return (
    <svg viewBox="0 0 40 40" className="seats-figure" aria-hidden="true">
      <circle cx="20" cy="20" r="11" className="seats-ring" />
      {angles.map((a) => (
        <circle
          key={a}
          cx={20 + 11 * Math.cos((a * Math.PI) / 180)}
          cy={20 + 11 * Math.sin((a * Math.PI) / 180)}
          r="4"
          className="seats-seat"
        />
      ))}
      <text x="20" y="21" className="seats-count">
        {arabic(n)}
      </text>
    </svg>
  );
}
