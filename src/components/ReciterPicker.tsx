import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clock } from '@/data/arabic';
import { reciters } from '@/data/reciters';
import { averagePage, loadTimings } from '@/data/timings';
import { ReciterAvatar } from './ReciterAvatar';

/**
 * The reciters, each with his pace over an average page, which is what the
 * choice decides when turns are timed: «نحو ١:٥٠ للصفحة».
 */
export function ReciterPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const paces = usePaces();
  return (
    <fieldset className="reciter-list">
      <legend className="visually-hidden">القارئ</legend>
      {reciters.map((r) => {
        const checked = r.id === value;
        const pace = paces[r.id];
        return (
          <label
            key={r.id}
            className="reciter-row"
            data-checked={checked || undefined}
          >
            <input
              type="radio"
              name="reciter"
              value={r.id}
              checked={checked}
              onChange={() => onChange(r.id)}
            />
            <ReciterAvatar reciter={r} size={48} />
            <span className="reciter-text">
              <span className="reciter-name">{r.name}</span>
              <span className="reciter-meta">
                {r.style}
                {pace ? ` · نحو ${clock(pace)} للصفحة` : ''}
              </span>
            </span>
            <span className="reciter-check" aria-hidden="true">
              {checked ? <Check size={18} /> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Every reciter's average page, loaded once the list opens. Each file is a
    few kilobytes and is needed anyway the moment one is picked. */
function usePaces() {
  const [paces, setPaces] = useState<Record<string, number>>({});
  useEffect(() => {
    let live = true;
    for (const r of reciters)
      loadTimings(r.id).then(
        (t) => live && setPaces((p) => ({ ...p, [r.id]: averagePage(t) })),
        () => {},
      );
    return () => {
      live = false;
    };
  }, []);
  return paces;
}
