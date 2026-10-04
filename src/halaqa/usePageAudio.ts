import { useEffect, useRef, useState } from 'react';
import { loadTimings, pageStretches, surahAudioUrl } from '@/data/timings';

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Plays a reciter's recitation of one Mushaf page: the stretch of his surah
 * recording that covers it, or two stretches where the page holds the end of
 * one surah and the start of the next. It is the halaqa's model reading, to
 * listen to before reading a page or to check a word after.
 *
 * Playback stops when the page changes, so the reciter never carries on over
 * the next reader.
 */
export function usePageAudio(reciter: string, page: number) {
  const [state, setState] = useState<{ key: string; status: AudioStatus }>({
    key: '',
    status: 'idle',
  });
  const key = `${reciter}:${page}`;
  const audio = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0);

  const stop = () => {
    run.current++;
    audio.current?.pause();
    setState({ key, status: 'idle' });
  };

  useEffect(
    () => () => {
      run.current++;
      audio.current?.pause();
    },
    [key],
  );

  const play = async () => {
    const id = ++run.current;
    setState({ key, status: 'loading' });
    try {
      const timings = await loadTimings(reciter);
      const el = (audio.current ??= new Audio());
      el.preload = 'auto';
      for (const [surah, from, to] of pageStretches(timings, page)) {
        if (id !== run.current) return;
        await playStretch(el, surahAudioUrl(timings, surah), from, to, () => {
          if (id === run.current) setState({ key, status: 'playing' });
          return id === run.current;
        });
      }
      if (id === run.current) setState({ key, status: 'idle' });
    } catch {
      if (id === run.current) setState({ key, status: 'error' });
    }
  };

  return {
    status: state.key === key ? state.status : ('idle' as AudioStatus),
    play,
    stop,
  };
}

/** Plays `url` from `from` to `to` milliseconds, resolving at the end or as
    soon as `alive()` says this playback was replaced. */
function playStretch(
  el: HTMLAudioElement,
  url: string,
  from: number,
  to: number,
  alive: () => boolean,
) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('error', onError);
      el.removeEventListener('pause', onPause);
    };
    const onTime = () => {
      if (!alive()) {
        cleanup();
        resolve();
      } else if (el.currentTime * 1000 >= to) {
        cleanup();
        el.pause();
        resolve();
      }
    };
    const onEnd = () => {
      cleanup();
      resolve();
    };
    const onPause = () => {
      if (!alive()) {
        cleanup();
        resolve();
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error(`could not play ${url}`));
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('error', onError);
    el.addEventListener('pause', onPause);
    if (!el.src.endsWith(url)) el.src = url;
    el.currentTime = from / 1000;
    el.play().then(
      () => alive(),
      (e) => {
        cleanup();
        reject(e);
      },
    );
  });
}
