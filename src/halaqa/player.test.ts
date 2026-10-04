import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Segment } from '@/data/timings';
import { Player, type Media } from './player';

/** An audio element that plays only when told: the test moves time. */
class FakeMedia extends EventTarget {
  src = '';
  currentTime = 0;
  readyState = 0;
  preload: HTMLMediaElement['preload'] = '';
  ended = false;
  paused = true;
  refuse: string | null = null;

  play() {
    if (this.refuse) {
      const error = new Error('refused');
      error.name = this.refuse;
      return Promise.reject(error);
    }
    this.paused = false;
    return Promise.resolve().then(() => this.emit('playing'));
  }
  pause() {
    this.paused = true;
  }
  emit(type: string) {
    this.dispatchEvent(new Event(type));
  }
  /** The file's metadata has arrived. */
  load() {
    this.readyState = 1;
    this.emit('loadedmetadata');
  }
  /** Playback has reached `seconds`. */
  at(seconds: number) {
    this.currentTime = seconds;
    this.emit('timeupdate');
  }
}

const fileA = 'https://example.test/2.mp3';
const fileB = 'https://example.test/3.mp3';
// Pages 49 and 50: the end of al-Baqarah, then the start of Al Imran.
const queue: Segment[] = [
  { url: fileA, from: 10_000, to: 70_000, page: 49 },
  { url: fileA, from: 70_000, to: 90_000, page: 50 },
  { url: fileB, from: 0, to: 40_000, page: 50 },
];

let media: FakeMedia;
let player: Player;
beforeEach(() => {
  vi.useFakeTimers();
  media = new FakeMedia();
  player = new Player(() => media as unknown as Media);
});
afterEach(() => vi.useRealTimers());

const flush = () => vi.advanceTimersByTimeAsync(0);

describe('the player', () => {
  it('plays a stretch from its first timestamp', async () => {
    player.play('turn', queue);
    expect(media.src).toBe(fileA);
    media.load();
    expect(media.currentTime).toBe(10);
    await flush();
    expect(player.getState()).toMatchObject({
      key: 'turn',
      status: 'playing',
      page: 49,
      total: 120_000,
    });
  });

  it('turns the page where the recitation does, without a seek', async () => {
    const pages: number[] = [];
    player.play('turn', queue, { onPage: (p) => pages.push(p) });
    media.load();
    await flush();
    media.at(40);
    expect(player.getState().played).toBe(30_000);
    media.at(70);
    expect(pages).toEqual([50]);
    expect(media.src).toBe(fileA);
    expect(player.getState()).toMatchObject({ page: 50, played: 60_000 });
  });

  it('moves to the next surah’s recording, and ends', async () => {
    const done = vi.fn();
    player.play('turn', queue, { onDone: done });
    media.load();
    await flush();
    media.at(90);
    expect(media.src).toBe(fileB);
    media.load();
    expect(media.currentTime).toBe(0);
    await flush();
    media.at(40);
    expect(done).toHaveBeenCalledOnce();
    expect(player.getState().status).toBe('ended');
    expect(media.paused).toBe(true);
  });

  it('stops on the last word, between position updates', async () => {
    const done = vi.fn();
    player.play('listen', [queue[0]], { onDone: done });
    media.load();
    await flush();
    media.at(69.8);
    expect(done).not.toHaveBeenCalled();
    media.currentTime = 70;
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toHaveBeenCalledOnce();
  });

  it('starts on a later page of the turn', async () => {
    player.play('turn', queue, { start: 50 });
    media.load();
    expect(media.currentTime).toBe(70);
    expect(player.getState().played).toBe(60_000);
  });

  it('goes back a page when the reader does', async () => {
    player.play('turn', queue);
    media.load();
    await flush();
    media.at(75);
    player.seekPage(49);
    expect(media.currentTime).toBe(10);
    expect(player.getState().page).toBe(49);
  });

  it('waits for a tap when the browser refuses sound', async () => {
    media.refuse = 'NotAllowedError';
    player.play('turn', queue);
    await flush();
    expect(player.getState().status).toBe('blocked');
    media.refuse = null;
    player.resume();
    await flush();
    expect(player.getState().status).toBe('playing');
  });

  it('notices a pause it did not make', async () => {
    player.play('turn', queue);
    media.load();
    await flush();
    media.pause();
    media.emit('pause');
    expect(player.getState().status).toBe('paused');
  });

  it('stops only what its caller started', async () => {
    player.play('turn', queue);
    player.stop('listen');
    expect(player.getState().key).toBe('turn');
    player.stop('turn');
    expect(player.getState()).toMatchObject({ key: '', status: 'idle' });
    // Events from what was playing reach nothing.
    media.emit('ended');
    expect(player.getState().status).toBe('idle');
  });

  it('reports a recording that will not load', async () => {
    player.play('turn', queue);
    media.emit('error');
    expect(player.getState().status).toBe('error');
  });
});
