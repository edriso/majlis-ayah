import { Check } from 'lucide-react';
import { arabic } from '@/data/arabic';
import { pagesShort, seatMark } from '@/halaqa/labels';
import {
  pagesOf,
  readerOf,
  round,
  type Anchor,
  type Plan,
} from '@/halaqa/schedule';
import { readerName, type Config } from '@/halaqa/state';

/** Where each seat sits, in degrees with 0 at the right and 90 at the foot.
    The first reader sits at the near right, where a right-to-left reader
    starts, and the turn travels round from there. */
const SEAT_ANGLES: Record<number, number[]> = {
  1: [90],
  2: [0, 180],
  3: [30, -90, 150],
};

/**
 * The readers sitting round the circle, the one reading lit in gold. A gold
 * mark travels the ring from seat to seat as the turn passes, always the same
 * way round, which is what makes the passing of a turn something you see
 * rather than something you read.
 *
 * In a turn timed by a reciter, the reader's own seat drains as the time
 * runs, so the clock is where the eye already is.
 */
export function HalaqaCircle({
  config,
  plan,
  anchor,
  turn,
  page,
  progress,
}: {
  config: Config;
  plan: Plan;
  anchor: Anchor;
  turn: number;
  page: number;
  /** The share of the turn's time left, 0 to 1, when the turn is timed. */
  progress: number | null;
}) {
  const n = plan.readers;
  const angles = SEAT_ANGLES[n];
  const active = readerOf(plan, turn);
  const next = readerOf(plan, turn + 1);
  // Cumulative, so the mark keeps turning the same way rather than spinning
  // back the long way when the circle wraps to the first reader.
  const markAngle = angles[0] - (turn * 360) / n;
  const roundSeats = plan.mode === 'repeat' ? round(plan, anchor, turn) : null;

  return (
    <figure className="halaqa-circle" data-readers={n}>
      <svg className="halaqa-ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="70" className="halaqa-ring-line" />
        <circle cx="100" cy="100" r="56" className="halaqa-ring-inner" />
        {n > 1 && (
          <g
            className="halaqa-mark"
            style={{ transform: `rotate(${markAngle}deg)` }}
          >
            {/* 44 degrees of the ring, centred on the reader's seat. */}
            <path
              d="M 164.9 73.8 A 70 70 0 0 1 164.9 126.2"
              className="halaqa-mark-arc"
            />
          </g>
        )}
      </svg>

      <div className="halaqa-center" aria-hidden="true">
        <span className="halaqa-center-label">
          {plan.mode === 'repeat' ? 'تكرار' : 'الصفحة'}
        </span>
        <span className="halaqa-center-page">{arabic(page)}</span>
      </div>

      <figcaption className="visually-hidden">
        الحلقة: {config.readers.map((_, i) => readerName(config, i)).join('، ')}
      </figcaption>

      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const isActive = i === active;
        const state = roundSeats?.[i].state;
        const status = isActive
          ? 'يقرأ الآن'
          : state === 'done'
            ? 'قرأ'
            : n > 1 && i === next
              ? 'التالي'
              : plan.mode === 'continue'
                ? pagesShort(pagesOf(plan, anchor, nextTurnOf(plan, turn, i)))
                : '';
        return (
          <div
            key={i}
            className="halaqa-seat"
            data-active={isActive || undefined}
            data-done={state === 'done' || undefined}
            data-top={Math.sin(rad) < -0.5 || undefined}
            style={{
              left: `${50 + 35 * Math.cos(rad)}%`,
              top: `${50 + 35 * Math.sin(rad)}%`,
            }}
          >
            <span className="seat-avatar">
              {isActive && progress !== null ? (
                <svg
                  className="seat-progress"
                  viewBox="0 0 36 36"
                  aria-hidden="true"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="16.5"
                    pathLength="100"
                    style={{ strokeDashoffset: 100 - progress * 100 }}
                  />
                </svg>
              ) : null}
              <span className="seat-mark" aria-hidden="true">
                {state === 'done' ? (
                  <Check size={18} strokeWidth={2.4} />
                ) : (
                  seatMark(config.readers[i] ?? '', i)
                )}
              </span>
            </span>
            <span className="seat-name">{readerName(config, i)}</span>
            {status ? <span className="seat-status">{status}</span> : null}
          </div>
        );
      })}
    </figure>
  );
}

/** The next turn, from this one on, that belongs to reader `i`. */
function nextTurnOf(plan: Plan, turn: number, i: number) {
  const offset = (i - readerOf(plan, turn) + plan.readers) % plan.readers;
  return turn + offset;
}
