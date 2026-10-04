import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { arabic } from '@/data/arabic';
import { surahOfPage } from '@/data/mushaf';
import { reciterById } from '@/data/reciters';
import { loadTimings, recitationOf, type Timings } from '@/data/timings';
import { Player, type Meta, type PlayerStatus } from './player';

/** The app's one player, on the app's one audio element. */
export const player = new Player(() => new Audio());

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

/** What the lock screen and a headset show for a recitation. */
function metaFor(reciter: string, page: number): Meta {
  const r = reciterById(reciter);
  return {
    title: `سورة ${surahOfPage(page).name} · الصفحة ${arabic(page)}`,
    artist: r.name,
    artwork: r.photo
      ? new URL(`${import.meta.env.BASE_URL}reciters/${r.photo}`, location.href)
          .href
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
}) {
  const state = usePlayer();
  const t = reciter ? timings[reciter] : undefined;
  const key = reciter ? `turn:${turnKey}:${reciter}` : '';
  const pagesKey = pages.join(',');

  // The latest callbacks and page, read when the recitation starts and as
  // it goes, without making either restart it.
  const latest = useRef({ page, onPage, onDone });
  useEffect(() => {
    latest.current = { page, onPage, onDone };
  });

  useEffect(() => {
    if (!reciter || !t) return;
    const start = latest.current.page;
    player.play(key, recitationOf(t, pagesKey.split(',').map(Number)), {
      start,
      onPage: (p) => latest.current.onPage(p),
      onDone: () => latest.current.onDone(),
      meta: metaFor(reciter, start),
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
 * hear before reading it or to check a word after. It stops when the turn
 * or the page changes, so the reciter never carries on over the next
 * reader.
 */
export function useListen({
  reciter,
  turnKey,
  page,
  timings,
}: {
  reciter: string;
  turnKey: string;
  page: number;
  timings: Record<string, Timings | null>;
}) {
  const state = usePlayer();
  const key = `listen:${turnKey}:${reciter}:${page}`;
  useEffect(() => () => player.stop(key), [key]);

  const raw = state.key === key ? state.status : 'idle';
  // Refused or finished, the button is simply ready to play again.
  const status: PlayerStatus =
    raw === 'blocked' || raw === 'ended' || raw === 'paused' ? 'idle' : raw;

  const play = () => {
    const go = (t: Timings) =>
      player.play(key, recitationOf(t, [page]), {
        meta: metaFor(reciter, page),
      });
    const t = timings[reciter];
    if (t) go(t);
    else loadTimings(reciter).then(go, () => {});
  };

  return { status, play, stop: () => player.stop(key) };
}
