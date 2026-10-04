import { useId, type ReactNode } from 'react';

export type Option<T extends string | number> = {
  value: T;
  label: ReactNode;
  /** A second line under the label, for choices that need a word of why. */
  hint?: ReactNode;
  /** The name a screen reader hears, where the label is only a numeral. */
  ariaLabel?: string;
};

/**
 * A set of mutually exclusive options, drawn as buttons and built from native
 * radio inputs, so arrow keys move between them and a screen reader announces
 * "1 of 3, selected" with nothing written to make it so.
 */
export function Choice<T extends string | number>({
  legend,
  hideLegend = false,
  options,
  value,
  onChange,
  variant = 'pills',
}: {
  legend: string;
  hideLegend?: boolean;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `pills` for short labels in a row, `cards` for options with a hint. */
  variant?: 'pills' | 'cards';
}) {
  const name = useId();
  return (
    <fieldset className={`choice choice-${variant}`}>
      <legend className={hideLegend ? 'visually-hidden' : 'field-label'}>
        {legend}
      </legend>
      <div className="choice-options">
        {options.map((o) => (
          <label
            key={String(o.value)}
            className="choice-option"
            data-checked={o.value === value || undefined}
          >
            <input
              type="radio"
              name={name}
              value={String(o.value)}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              aria-label={o.ariaLabel}
            />
            <span className="choice-label">{o.label}</span>
            {o.hint ? <span className="choice-hint">{o.hint}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
