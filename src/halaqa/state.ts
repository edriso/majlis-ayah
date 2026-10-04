/* The whole of a halaqa as one value, and every way it can change.

   Plain functions with no React in them, so all of it is testable without a
   browser. `useHalaqa.ts` is the only file that connects this to React. */

import { ordinal } from '@/data/arabic';
import { clampPage, PAGE_COUNT } from '@/data/mushaf';
import { defaultReciter, reciters } from '@/data/reciters';
import {
  anchorAt,
  endsRound,
  firstPageOf,
  isBeforeStart,
  pagesOf,
  readerOf,
  roundOf,
  type Anchor,
  type Mode,
  type Plan,
} from './schedule';

export type TurnChange = 'manual' | 'reciter';
export type Theme = 'burgundy' | 'green' | 'blue';
export type View = 'quran' | 'balanced' | 'halaqa';

export const MAX_READERS = 3;
export const MAX_PAGES_PER_TURN = 3;

export type Config = {
  /** One entry per reader, in the order they sit. An empty name means the
      default one, so a halaqa can start without anyone typing anything. */
  readers: string[];
  mode: Mode;
  pagesPerTurn: number;
  turnChange: TurnChange;
  reciter: string;
  startPage: number;
};

export type Prefs = { theme: Theme; view: View };

export type Session = {
  config: Config;
  anchor: Anchor;
  turn: number;
  /** Which of the current turn's pages is open, from 0. */
  pageInTurn: number;
  /** Pages the circle has finished in this sitting. */
  pagesRead: number;
};

export type State = {
  prefs: Prefs;
  /** The last configuration used, so a new halaqa starts from it. */
  config: Config;
  session: Session | null;
};

export const defaultConfig: Config = {
  readers: ['', '', ''],
  mode: 'continue',
  pagesPerTurn: 1,
  turnChange: 'manual',
  reciter: defaultReciter,
  startPage: 1,
};

export const defaultPrefs: Prefs = { theme: 'burgundy', view: 'balanced' };

export const initialState: State = {
  prefs: defaultPrefs,
  config: defaultConfig,
  session: null,
};

export const planOf = (c: Config): Plan => ({
  readers: c.readers.length,
  mode: c.readers.length === 1 ? 'continue' : c.mode,
  pagesPerTurn: c.pagesPerTurn,
});

/** The name a reader is shown by. The first seat is the person holding the
    device, «أنت», unless someone named it. */
export function readerName(c: Config, i: number) {
  const name = c.readers[i]?.trim();
  if (name) return name;
  return i === 0 ? 'أنت' : `القارئ ${ordinal(i + 1)}`;
}

/** «دورك» for the unnamed first seat, «دور أحمد» for everyone else. */
export function turnPhrase(c: Config, i: number) {
  if (i === 0 && !c.readers[0]?.trim()) return 'دورك';
  return `دور ${readerName(c, i)}`;
}

export const currentPages = (s: Session) =>
  pagesOf(planOf(s.config), s.anchor, s.turn);

export const currentPage = (s: Session) => {
  const pages = currentPages(s);
  return pages[Math.min(s.pageInTurn, pages.length - 1)] ?? PAGE_COUNT;
};

export const isComplete = (s: Session) => currentPages(s).length === 0;

export type Action =
  | { type: 'start'; config: Config }
  | { type: 'end' }
  | { type: 'finishTurn' }
  | { type: 'previousTurn' }
  | { type: 'nextPage' }
  | { type: 'previousPage' }
  | { type: 'goToPage'; page: number }
  | { type: 'configure'; config: Config }
  | { type: 'restartMushaf' }
  | { type: 'prefs'; prefs: Partial<Prefs> };

/** How many pages finishing a turn adds to the circle's progress: every
    turn's pages in continue mode, and a round's pages once in repeat mode. */
function pagesFinishedBy(s: Session, turn: number) {
  const plan = planOf(s.config);
  const pages = pagesOf(plan, s.anchor, turn).length;
  if (plan.mode === 'continue') return pages;
  return endsRound(plan, turn) ? pages : 0;
}

/**
 * Moves the current turn so it begins on `page`, keeping the open page at the
 * same position within the turn where it can.
 */
function jump(s: Session, page: number, pageInTurn = 0): Session {
  return {
    ...s,
    anchor: anchorAt(s.turn, clampPage(page)),
    pageInTurn,
  };
}

export function reduce(state: State, action: Action): State {
  if (action.type === 'prefs')
    return { ...state, prefs: { ...state.prefs, ...action.prefs } };

  if (action.type === 'start') {
    const config = sanitizeConfig(action.config);
    return {
      ...state,
      config,
      session: {
        config,
        anchor: anchorAt(0, config.startPage),
        turn: 0,
        pageInTurn: 0,
        pagesRead: 0,
      },
    };
  }

  if (action.type === 'end') return { ...state, session: null };

  const s = state.session;
  if (!s) return state;
  const plan = planOf(s.config);
  const pages = currentPages(s);
  const set = (session: Session) => ({ ...state, session });

  switch (action.type) {
    case 'finishTurn':
      if (pages.length === 0) return state;
      return set({
        ...s,
        turn: s.turn + 1,
        pageInTurn: 0,
        pagesRead: s.pagesRead + pagesFinishedBy(s, s.turn),
      });

    case 'previousTurn': {
      const turn = s.turn - 1;
      if (turn < 0 || isBeforeStart(plan, s.anchor, turn)) return state;
      return set({
        ...s,
        turn,
        pageInTurn: 0,
        pagesRead: Math.max(0, s.pagesRead - pagesFinishedBy(s, turn)),
      });
    }

    case 'nextPage': {
      if (s.pageInTurn < pages.length - 1)
        return set({ ...s, pageInTurn: s.pageInTurn + 1 });
      // Past the end of the turn: the whole circle moves one page on.
      const first = firstPageOf(plan, s.anchor, s.turn);
      if (currentPage(s) >= PAGE_COUNT) return state;
      return set(jump(s, first + 1, s.pageInTurn));
    }

    case 'previousPage': {
      if (s.pageInTurn > 0) return set({ ...s, pageInTurn: s.pageInTurn - 1 });
      const first = firstPageOf(plan, s.anchor, s.turn);
      if (first <= 1) return state;
      return set(jump(s, first - 1));
    }

    case 'goToPage': {
      const page = clampPage(action.page);
      const at = pages.indexOf(page);
      if (at !== -1) return set({ ...s, pageInTurn: at });
      return set(jump(s, page));
    }

    case 'restartMushaf':
      return set(jump(s, 1));

    case 'configure': {
      const config = sanitizeConfig(action.config);
      const next = planOf(config);
      const samePlan =
        next.readers === plan.readers &&
        next.mode === plan.mode &&
        next.pagesPerTurn === plan.pagesPerTurn;
      if (samePlan) return { ...state, config, session: { ...s, config } };
      /* The shape of the circle changed. Carry on from the page being read,
         with the same reader if they are still seated, so nobody loses
         their place; the turns before this one are history either way. */
      const reader = Math.min(readerOf(plan, s.turn), next.readers - 1);
      const turn = (roundOf(plan, s.turn) + 1) * next.readers + reader;
      return {
        ...state,
        config,
        session: {
          ...s,
          config,
          turn,
          anchor: anchorAt(turn, currentPage(s)),
          pageInTurn: 0,
        },
      };
    }
  }
}

const themes: Theme[] = ['burgundy', 'green', 'blue'];
const views: View[] = ['quran', 'balanced', 'halaqa'];

const intIn = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
    ? v
    : fallback;

/** Whatever was stored, made into a valid configuration. A stored value is
    data from an older version or a hand-edited store, never trusted. */
export function sanitizeConfig(raw: unknown): Config {
  const c = (raw ?? {}) as Partial<Config>;
  const readers = Array.isArray(c.readers)
    ? c.readers
        .slice(0, MAX_READERS)
        .map((n) => (typeof n === 'string' ? n.slice(0, 40) : ''))
    : defaultConfig.readers;
  return {
    readers: readers.length ? readers : [''],
    mode: c.mode === 'repeat' ? 'repeat' : 'continue',
    pagesPerTurn: intIn(c.pagesPerTurn, 1, MAX_PAGES_PER_TURN, 1),
    turnChange: c.turnChange === 'reciter' ? 'reciter' : 'manual',
    reciter: reciters.some((r) => r.id === c.reciter)
      ? (c.reciter as string)
      : defaultReciter,
    startPage: intIn(c.startPage, 1, PAGE_COUNT, 1),
  };
}

export function sanitizeState(raw: unknown): State {
  const r = (raw ?? {}) as Partial<State>;
  const p = (r.prefs ?? {}) as Partial<Prefs>;
  const prefs: Prefs = {
    theme: themes.includes(p.theme as Theme) ? (p.theme as Theme) : 'burgundy',
    view: views.includes(p.view as View) ? (p.view as View) : 'balanced',
  };
  const config = sanitizeConfig(r.config);
  let session: Session | null = null;
  const s = r.session as Partial<Session> | null | undefined;
  if (s && typeof s === 'object') {
    const sc = sanitizeConfig(s.config);
    const turn = intIn(s.turn, 0, Number.MAX_SAFE_INTEGER, 0);
    const a = (s.anchor ?? {}) as Partial<Anchor>;
    const anchor = anchorAt(
      intIn(a.turn, 0, turn, 0),
      intIn(a.page, 1, PAGE_COUNT, sc.startPage),
    );
    session = {
      config: sc,
      anchor,
      turn,
      pageInTurn: intIn(s.pageInTurn, 0, MAX_PAGES_PER_TURN - 1, 0),
      pagesRead: intIn(s.pagesRead, 0, Number.MAX_SAFE_INTEGER, 0),
    };
  }
  return { prefs, config, session };
}
