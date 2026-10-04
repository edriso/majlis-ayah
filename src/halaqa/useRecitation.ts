import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { arabic } from '@/data/arabic';
import { surahOfPage } from '@/data/mushaf';
import { reciterById } from '@/data/reciters';
import { loadTimings, recitationOf, type Timings } from '@/data/timings';
import { Player, type Meta, type PlayerStatus } from './player';

/** The app's one player for the halaqa's recitations, on the one audio
    element every recitation plays on (see player.ts). */
export const player = new Player(() => new Audio());

/** A second player, only for hearing a reciter before choosing him. It is
    only ever started by a tap, so it needs none of the first one's
    unlocking, and it keeps off the lock screen. */
const sampler = new Player(() => new Audio(), { session: false });

export function usePlayer() {
  return useSyncExternalStore(
    player.subscribe,
    player.getState,
    player.getState,
  );
}

/**
 * Each reciter's timings, loaded as soon as he is named: the halaqa's own
 * reciter and every reciter seated in the circle. A file is a few
 * kilobytes, and loading it before his turn means his recitation can start
 * in the same moment as the turn. `null` is a file that would not load
 * (offline before it was ever cached); `retry` asks again.
 */
export function useTimings(ids: readonly string[]) {
  const [loaded, setLoaded] = useState<Record<string, Timings | null>>({});
  const [attempt, setAttempt] = useState(0);
  const key = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    let live = true;
    for (const id of key.split(',').filter(Boolean))
      loadTimings(id).then(
        (t) => live && setLoaded((l) => (l[id] === t ? l : { ...l, [id]: t })),
        () => live && setLoaded((l) => ({ ...l, [id]: null })),
      );
    return () => {
      live = false;
    };
  }, [key, attempt]);
  return { timings: loaded, retry: () => setAttempt((a) => a + 1) };
}

/** What the lock screen and a headset show for a recitation: the photo
    only where the reader has photos shown. */
function metaFor(reciter: string, page: number, showPhoto: boolean): Meta {
  const r = reciterById(reciter);
  return {
    title: `سورة ${surahOfPage(page).name} · الصفحة ${arabic(page)}`,
    artist: r.name,
    artwork:
      r.photo && showPhoto
        ? new URL(
            `${import.meta.env.BASE_URL}reciters/${r.photo}`,
            location.href,
          ).href
        : undefined,
  };
}

/**
 * A seated reciter's turn: his recitation of the turn's pages, started when
 * the turn comes to him and stopped when it leaves him, however it leaves.
 *
 * The page on screen follows the recitation (`onPage`), and the recitation
 * follows the page: a reader who turns back a page mid-turn hears it again
 * from its start. When the last page ends, `onDone` passes the turn on.
 *
 * `turnKey` names the turn and the pages it covers; a new one is a new
 * recitation from the start.
 */
export function useReciterTurn({
  reciter,
  turnKey,
  pages,
  page,
  timings,
  onPage,
  onDone,
  onRetry,
  showPhoto,
}: {
  /** The reciter whose turn it is, or null on a reader's turn. */
  reciter: string | null;
  turnKey: string;
  pages: readonly number[];
  page: number;
  timings: Record<string, Timings | null>;
  onPage: (page: number) => void;
  onDone: () => void;
  /** Asks for timings that would not load. */
  onRetry: () => void;
  showPhoto: boolean;
}) {
  const state = usePlayer();
  const t = reciter ? timings[reciter] : undefined;
  const key = reciter ? `turn:${turnKey}:${reciter}` : '';
  const pagesKey = pages.join(',');

  // The latest callbacks and page, read when the recitation starts and as
  // it goes, without making either restart it.
  const latest = useRef({ page, onPage, onDone, showPhoto });
  useEffect(() => {
    latest.current = { page, onPage, onDone, showPhoto };
  });

  useEffect(() => {
    if (!reciter || !t) return;
    const start = latest.current.page;
    player.play(key, recitationOf(t, pagesKey.split(',').map(Number)), {
      start,
      onPage: (p) => latest.current.onPage(p),
      onDone: () => latest.current.onDone(),
      meta: metaFor(reciter, start, latest.current.showPhoto),
    });
    return () => player.stop(key);
  }, [key, reciter, t, pagesKey]);

  useEffect(() => {
    const s = player.getState();
    if (key && s.key === key && s.page !== page && s.status !== 'ended')
      player.seekPage(page);
  }, [key, page]);

  const mine = key !== '' && state.key === key;
  const status: PlayerStatus = !reciter
    ? 'idle'
    : t === null
      ? 'error'
      : mine
        ? state.status
        : 'loading';

  return {
    status,
    /** Milliseconds left in the turn, once its recitation is known. */
    left: mine ? Math.max(0, state.total - state.played) : null,
    total: mine ? state.total : null,
    /** Pause, carry on, start after the browser asked for a tap, or try
        again after a failure. */
    toggle: () => {
      if (t === null) onRetry();
      else if (status === 'playing' || status === 'loading') player.pause();
      else if (mine) player.resume();
    },
  };
}

/**
 * «استمع»: the halaqa's reciter reciting the open page, for a reader to
 * hear before reading it or to check a word after. It pauses and resumes
 * like any recording, and stops when the turn or the page changes, so the
 * reciter never carries on over the next reader.
 *
 * If his timings are still loading when it is pressed, the button says so,
 * and a recitation that arrives after the page or the turn has moved on, or
 * after a second press, is dropped rather than played over whoever reads
 * next.
 */
export function useListen({
  reciter,
  turnKey,
  page,
  timings,
  showPhoto,
}: {
  reciter: string;
  turnKey: string;
  page: number;
  timings: Record<string, Timings | null>;
  showPhoto: boolean;
}) {
  const state = usePlayer();
  const key = `listen:${turnKey}:${reciter}:${page}`;
  const [pending, setPending] = useState<{
    key: string;
    status: 'loading' | 'error';
  } | null>(null);
  const live = useRef(key);
  const attempt = useRef(0);
  useEffect(() => {
    live.current = key;
    return () => player.stop(key);
  }, [key]);

  const raw = state.key === key ? state.status : 'idle';
  const status: PlayerStatus =
    pending?.key === key
      ? pending.status
      : raw === 'blocked' || raw === 'ended'
        ? 'idle'
        : raw;

  const start = () => {
    const mine = ++attempt.current;
    const go = (t: Timings) => {
      if (live.current !== key || attempt.current !== mine) return;
      setPending(null);
      player.play(key, recitationOf(t, [page]), {
        meta: metaFor(reciter, page, showPhoto),
      });
    };
    const t = timings[reciter];
    if (t) return go(t);
    setPending({ key, status: 'loading' });
    loadTimings(reciter).then(go, () => {
      if (live.current === key && attempt.current === mine)
        setPending({ key, status: 'error' });
    });
  };

  /** Pauses it if it is sounding, and says whether it was. */
  const pause = () => {
    if (pending?.key === key && pending.status === 'loading') {
      attempt.current++;
      setPending(null);
      return false;
    }
    if (raw !== 'playing' && raw !== 'loading') return false;
    player.pause();
    return true;
  };
  const resume = () => {
    if (raw === 'paused') player.resume();
  };

  return {
    status,
    pause,
    resume,
    toggle: () => {
      if (status === 'playing' || status === 'loading') pause();
      else if (status === 'paused') resume();
      else start();
    },
  };
}

/**
 * A reciter's voice, heard before he is chosen: his al-Fatiha, which every
 * reader knows, so the voices and their pace are heard side by side on the
 * same words. One at a time: a second press stops it, another reciter's
 * press replaces it, closing the list ends it, and the halaqa's own
 * recitation pauses while it plays and stops it if it starts again.
 */
export function useSample(timings: Record<string, Timings | null>) {
  const state = useSyncExternalStore(
    sampler.subscribe,
    sampler.getState,
    sampler.getState,
  );
  const main = usePlayer();
  useEffect(() => () => sampler.stop(), []);
  useEffect(() => {
    if (main.status === 'playing') sampler.stop();
  }, [main.status]);

  const phase = (id: string) =>
    state.key === `sample:${id}` &&
    (state.status === 'playing' || state.status === 'loading')
      ? state.status
      : undefined;

  return {
    phase,
    toggle: (id: string) => {
      if (phase(id)) return sampler.stop();
      const t = timings[id];
      if (!t) return;
      player.pause();
      sampler.play(`sample:${id}`, recitationOf(t, [1]));
    },
  };
}
