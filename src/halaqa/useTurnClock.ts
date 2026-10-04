import { useEffect, useRef, useState } from 'react';

type Clock = { key: string; left: number | null; paused: boolean };

/**
 * The countdown for a turn timed by a reciter's pace.
 *
 * A clock belongs to one turn (`turnKey`): a new turn starts a fresh, running
 * clock, which is what the next reader expects whether or not the last one
 * paused. `duration` is null until the reciter's timings have loaded, and the
 * clock waits for it rather than counting down from nothing.
 *
 * Time is measured between ticks rather than counted in ticks, because a
 * browser slows timers in a background tab to once a second or less, and a
 * halaqa held over a video call has the call in front.
 */
export function useTurnClock({
  enabled,
  duration,
  turnKey,
  onExpire,
}: {
  enabled: boolean;
  duration: number | null;
  turnKey: string;
  onExpire: () => void;
}) {
  const [clock, setClock] = useState<Clock>({
    key: turnKey,
    left: duration,
    paused: false,
  });

  // Reset during render rather than in an effect, so the first frame of a
  // new turn already shows its own time instead of the last turn's zero.
  if (clock.key !== turnKey || (clock.left === null && duration !== null))
    setClock({
      key: turnKey,
      left: duration,
      paused: clock.key === turnKey && clock.paused,
    });

  const running =
    enabled && !clock.paused && clock.left !== null && clock.left > 0;

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;
      last = now;
      setClock((c) =>
        c.left === null ? c : { ...c, left: Math.max(0, c.left - elapsed) },
      );
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  const expired = enabled && clock.key === turnKey && clock.left === 0;
  useEffect(() => {
    if (expired) expire.current();
  }, [expired]);

  return {
    left: clock.key === turnKey ? clock.left : duration,
    total: duration,
    paused: clock.paused,
    toggle: () => setClock((c) => ({ ...c, paused: !c.paused })),
  };
}
