import { Check } from 'lucide-react';
import { clock } from '@/data/arabic';
import { pagesLabel } from '@/halaqa/labels';
import {
  pagesOf,
  round,
  roundOf,
  upcoming,
  type Anchor,
  type Plan,
} from '@/halaqa/schedule';
import { readerName, type Config } from '@/halaqa/state';

/**
 * Who reads now and who reads next, and nothing more. In continue mode that
 * is the turn just read, the turn being read and the next two; in repeat
 * mode it is everyone against the page this round is on, ticked as they
 * finish, and the page the circle moves to after.
 */
export function ReadingOrder({
  config,
  plan,
  anchor,
  turn,
  left,
}: {
  config: Config;
  plan: Plan;
  anchor: Anchor;
  turn: number;
  /** Milliseconds left in a timed turn. */
  left: number | null;
}) {
  if (plan.mode === 'repeat') {
    const seats = round(plan, anchor, turn);
    const pages = seats[0].pages;
    const nextPages = pagesOf(
      plan,
      anchor,
      (roundOf(plan, turn) + 1) * plan.readers,
    );
    return (
      <section className="order" aria-labelledby="order-title">
        <h2 id="order-title" className="order-title">
          {pagesLabel(pages)} <span className="order-mode">· تكرار</span>
        </h2>
        <ol className="order-list">
          {seats.map((s) => (
            <li
              key={s.turn}
              className="order-row"
              data-state={s.state}
              aria-current={s.state === 'now' ? 'step' : undefined}
            >
              <span className="order-icon" aria-hidden="true">
                {s.state === 'done' ? (
                  <Check size={16} strokeWidth={2.4} />
                ) : s.state === 'now' ? (
                  '←'
                ) : (
                  '○'
                )}
              </span>
              <span className="order-name">{readerName(config, s.reader)}</span>
              <span className="order-detail">
                {s.state === 'now'
                  ? left !== null
                    ? `يقرأ · ${clock(left)}`
                    : 'يقرأ الآن'
                  : s.state === 'done'
                    ? 'قرأ'
                    : s.state === 'skipped'
                      ? 'لم يقرأها'
                      : 'ينتظر'}
              </span>
            </li>
          ))}
        </ol>
        {nextPages.length ? (
          <p className="order-after">ثم {pagesLabel(nextPages)}</p>
        ) : (
          <p className="order-after">وبها يُختم المصحف</p>
        )}
      </section>
    );
  }

  const seats = upcoming(plan, anchor, turn);
  return (
    <section className="order" aria-labelledby="order-title">
      <h2 id="order-title" className="order-title">
        ترتيب القراءة
      </h2>
      <ol className="order-list">
        {seats.map((s) => {
          const state =
            s.turn < turn ? 'done' : s.turn === turn ? 'now' : 'waiting';
          const label =
            s.turn === turn
              ? 'الآن'
              : s.turn === turn + 1
                ? 'التالي'
                : s.turn > turn
                  ? 'بعده'
                  : '';
          return (
            <li
              key={s.turn}
              className="order-row"
              data-state={state}
              aria-current={state === 'now' ? 'step' : undefined}
            >
              <span className="order-icon" aria-hidden="true">
                {state === 'done' ? (
                  <Check size={16} strokeWidth={2.4} />
                ) : null}
              </span>
              <span className="order-when">{label}</span>
              <span className="order-name">{readerName(config, s.reader)}</span>
              <span className="order-detail">
                {pagesLabel(s.pages)}
                {state === 'now' && left !== null ? ` · ${clock(left)}` : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
