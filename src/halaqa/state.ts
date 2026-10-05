/* The whole of a halaqa as one value, and every way it can change.

   Plain functions with no React in them, so all of it is testable without a
   browser. `useHalaqa.ts` is the only file that connects this to React. */

import { ordinal } from '@/data/arabic';
import { clampPage, PAGE_COUNT } from '@/data/mushaf';
import { defaultReciter, reciterById, reciters } from '@/data/reciters';
import {
  anchorAt,
  endsRound,
  firstPageOf,
  isBeforeStart,
  pagesOf,
  readerOf,
  round,
  roundOf,
  type Anchor,
  type Mode,
  type Plan,
} from './schedule';

export type TurnChange = 'manual' | 'reciter';
export type Theme = 'burgundy' | 'green' | 'blue' | 'sand';
/** How the reciters' photographs are shown. Some readers would rather not
    look at faces, or not in a sitting with others; blurred keeps the
    picture's place, hidden puts the reciter's initial in its stead. */
export type Photos = 'show' | 'blur' | 'hide';
/** How fast recitations play: slower for a learner following word by word,
    a little faster for revision. Beyond these, tajweed suffers. */
export type Speed = 0.75 | 1 | 1.25;
/** Whether a soft tone marks a turn that passes on its own, when its time
    runs out or a reciter finishes, since nobody touched the screen. */
export type Cue = 'chime' | 'none';

/** Four seats: three readers and a reciter, or any mix. More would crowd
    the circle on a phone, and a bigger gathering has its own teacher. */
export const MAX_MEMBERS = 4;
export const MAX_PAGES_PER_TURN = 3;

/** Someone in the room who reads aloud. An empty name means the default
    one, so a halaqa can start without anyone typing anything. */
export type Person = { id: string; kind: 'person'; name: string };

/** A recorded reciter given a seat. On his turn his recitation of the turn's
    pages plays while the others follow on the page, and the turn passes on
    when it ends, as a sheikh's would. */
export type ReciterMember = { id: string; kind: 'reciter'; reciter: string };

export type Member = Person | ReciterMember;
export type MemberKind = Member['kind'];

export type Config = {
  /** Everyone in the circle, in the order they read. */
  members: Member[];
  mode: Mode;
  pagesPerTurn: number;
  turnChange: TurnChange;
  /** How much longer than the reciter a timed reader's turn lasts: people
      read slower than a master reciter, children slower still. */
  allowance: Allowance;
  reciter: string;
  startPage: number;
};

export type Allowance = 1 | 1.25 | 1.5;

export type Prefs = {
  theme: Theme;
  photos: Photos;
  speed: Speed;
  /** How many times «استمع» recites the page. */
  listenRepeat: 1 | 2 | 3;
  cue: Cue;
};

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
  /** The circle as last set up, saved as it is chosen on the start screen,
      so the next halaqa starts from it. */
  config: Config;
  session: Session | null;
};

/** A first visit seats only «أنت»: someone reading alone starts at once,
    and a group adds its readers, which are then kept for the next time. */
export const defaultConfig: Config = {
  members: [{ id: 'p1', kind: 'person', name: '' }],
  mode: 'continue',
  pagesPerTurn: 1,
  turnChange: 'manual',
  allowance: 1,
  reciter: defaultReciter,
  startPage: 1,
};

export const defaultPrefs: Prefs = {
  theme: 'green',
  photos: 'show',
  speed: 1,
  listenRepeat: 1,
  cue: 'chime',
};

export const initialState: State = {
  prefs: defaultPrefs,
  config: defaultConfig,
  session: null,
};

export const planOf = (c: Config): Plan => ({
  readers: c.members.length,
  mode: c.members.length === 1 ? 'continue' : c.mode,
  pagesPerTurn: c.pagesPerTurn,
});

/* Members are told apart by an id that stays with them when the circle is
   reordered: `p1`…`p4` for people, `r1`…`r4` for reciters. A person's
   default name comes from that number, not from where they sit, so moving
   «القارئ الثاني» up the list moves that reader, visibly, rather than
   renaming two seats. `p1` is the person holding the device: «أنت». */

const numberOf = (m: Member) => Number(m.id.slice(1));

/** The name a member is shown by. */
export function memberName(m: Member) {
  if (m.kind === 'reciter') return reciterById(m.reciter).short;
  const name = m.name.trim();
  if (name) return name;
  const n = numberOf(m);
  return n === 1 ? 'أنت' : `القارئ ${ordinal(n)}`;
}

/** Whether a member is the unnamed «أنت», who is spoken to, not of. */
const isYou = (m: Member) =>
  m.kind === 'person' && m.id === 'p1' && !m.name.trim();

/** «دورك», «دور أحمد», or «يتلو الحصري» for a reciter's turn. */
export function turnPhrase(m: Member) {
  if (m.kind === 'reciter') return `يتلو ${memberName(m)}`;
  return isYou(m) ? 'دورك' : `دور ${memberName(m)}`;
}

/** A new member of the given kind, with the first id not taken. Returns
    null when the circle is full. */
export function newMember(
  members: readonly Member[],
  kind: MemberKind,
  reciter: string = defaultReciter,
): Member | null {
  if (members.length >= MAX_MEMBERS) return null;
  const prefix = kind === 'person' ? 'p' : 'r';
  const taken = new Set(members.map((m) => m.id));
  let n = 1;
  while (taken.has(`${prefix}${n}`)) n++;
  const id = `${prefix}${n}`;
  return kind === 'person' ? { id, kind, name: '' } : { id, kind, reciter };
}

export const currentPages = (s: Session) =>
  pagesOf(planOf(s.config), s.anchor, s.turn);

export const currentPage = (s: Session) => {
  const pages = currentPages(s);
  return pages[Math.min(s.pageInTurn, pages.length - 1)] ?? PAGE_COUNT;
};

export const isComplete = (s: Session) => currentPages(s).length === 0;

export type Action =
  | { type: 'draft'; config: Config }
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

  // The start screen's choices, kept as they are made, so a refresh or the
  // next visit finds the circle as it was left.
  if (action.type === 'draft')
    return { ...state, config: sanitizeConfig(action.config) };

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
      /* Whoever is reading keeps the turn wherever they now sit: the circle
         may have been reordered, or someone added or removed. If it was
         they who left, the turn goes to whoever took their seat. */
      const seat = readerOf(plan, s.turn);
      const moved = config.members.findIndex(
        (m) => m.id === s.config.members[seat]?.id,
      );
      let reader = moved !== -1 ? moved : Math.min(seat, next.readers - 1);
      const repeating = plan.mode === 'repeat' && next.mode === 'repeat';
      const ahead = (c: Config, n: number) =>
        c.members
          .slice(0, n)
          .map((m) => m.id)
          .join();
      const unchanged =
        next.readers === plan.readers &&
        next.mode === plan.mode &&
        next.pagesPerTurn === plan.pagesPerTurn &&
        reader === seat &&
        (!repeating || ahead(config, reader) === ahead(s.config, seat));
      if (unchanged) return { ...state, config, session: { ...s, config } };

      // A fresh round, so the turn number names the right member from here
      // on; the turns before this one are history either way.
      const start = (roundOf(plan, s.turn) + 1) * next.readers;
      const changed = (session: Partial<Session>) => ({
        ...state,
        config,
        session: { ...s, config, pageInTurn: 0, ...session },
      });

      // Continue mode carries on from the page being read.
      if (!repeating)
        return changed({
          turn: start + reader,
          anchor: anchorAt(start + reader, currentPage(s)),
        });

      /* In repeat mode everyone reads the round's pages, in the circle's
         order, so the round keeps its first page and nobody is left out of
         it. If the reader who left sat last, everyone else has read the
         pages and the circle moves on to the next. Otherwise, if anyone
         now seated ahead of the reader is still to read them (moved up,
         newly added, or the turn now covers a page they did not read), the
         pages start over from the first seat. If not, the reader carries
         on where they were, and those ahead keep their marks. */
      const first = firstPageOf(plan, s.anchor, s.turn);
      const read = currentPages(s);
      if (moved === -1 && seat >= next.readers)
        return changed({
          turn: start,
          anchor: anchorAt(start, first + plan.pagesPerTurn),
          pagesRead: s.pagesRead + read.length,
        });
      const was = new Map(
        round(plan, s.anchor, s.turn).map((r) => [
          s.config.members[r.reader].id,
          r.state,
        ]),
      );
      const covered = pagesOf(next, anchorAt(start, first), start).every((p) =>
        read.includes(p),
      );
      const marks = config.members.slice(0, reader).map((m) => was.get(m.id));
      let ticked = 0;
      if (!covered || marks.some((m) => m !== 'done' && m !== 'skipped'))
        reader = 0;
      // The anchor goes after the last one passed over, so those before it
      // read as passed over and those after it as ticked.
      else ticked = marks.lastIndexOf('skipped') + 1;
      return changed({
        turn: start + reader,
        anchor: anchorAt(start + ticked, first),
        pageInTurn:
          reader === moved ? Math.min(s.pageInTurn, next.pagesPerTurn - 1) : 0,
      });
    }
  }
}

const themes: Theme[] = ['green', 'burgundy', 'blue', 'sand'];
const photoModes: Photos[] = ['show', 'blur', 'hide'];

/** `v` if it is one of `options`, else `fallback`. */
const oneOf = <T>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

const intIn = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
    ? v
    : fallback;

const knownReciter = (id: unknown) =>
  reciters.some((r) => r.id === id) ? (id as string) : defaultReciter;

const idPattern: Record<MemberKind, RegExp> = {
  person: new RegExp(`^p[1-${MAX_MEMBERS}]$`),
  reciter: new RegExp(`^r[1-${MAX_MEMBERS}]$`),
};

/** The members of a stored configuration, repaired: each a known kind with a
    unique id of its kind, a person's name a string of at most 40
    characters, a reciter one that exists. A configuration saved before
    reciters could sit in the circle has `readers`, a list of names, and
    becomes people in the same order under the same default names. */
function sanitizeMembers(c: Record<string, unknown>): Member[] {
  const raw: unknown[] = Array.isArray(c.members)
    ? c.members
    : Array.isArray(c.readers)
      ? c.readers.map((name) => ({ kind: 'person', name }))
      : defaultConfig.members;
  const members: Member[] = [];
  for (const item of raw) {
    if (members.length === MAX_MEMBERS) break;
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const kind: MemberKind = m.kind === 'reciter' ? 'reciter' : 'person';
    const own =
      typeof m.id === 'string' &&
      idPattern[kind].test(m.id) &&
      !members.some((other) => other.id === m.id);
    const id = own ? (m.id as string) : newMember(members, kind)!.id;
    members.push(
      kind === 'person'
        ? {
            id,
            kind,
            name: typeof m.name === 'string' ? m.name.slice(0, 40) : '',
          }
        : { id, kind, reciter: knownReciter(m.reciter) },
    );
  }
  return members.length ? members : [defaultConfig.members[0]];
}

/** Whatever was stored, made into a valid configuration. A stored value is
    data from an older version or a hand-edited store, never trusted. */
export function sanitizeConfig(raw: unknown): Config {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    members: sanitizeMembers(c),
    mode: c.mode === 'repeat' ? 'repeat' : 'continue',
    pagesPerTurn: intIn(c.pagesPerTurn, 1, MAX_PAGES_PER_TURN, 1),
    turnChange: c.turnChange === 'reciter' ? 'reciter' : 'manual',
    allowance: oneOf(c.allowance, [1, 1.25, 1.5] as const, 1),
    reciter: knownReciter(c.reciter),
    startPage: intIn(c.startPage, 1, PAGE_COUNT, 1),
  };
}

export function sanitizeState(raw: unknown): State {
  const r = (raw ?? {}) as Partial<State>;
  const p = (r.prefs ?? {}) as Partial<Prefs>;
  const prefs: Prefs = {
    theme: themes.includes(p.theme as Theme) ? (p.theme as Theme) : 'green',
    photos: oneOf(p.photos, photoModes, 'show'),
    speed: oneOf(p.speed, [0.75, 1, 1.25] as const, 1),
    listenRepeat: oneOf(p.listenRepeat, [1, 2, 3] as const, 1),
    cue: oneOf(p.cue, ['chime', 'none'] as const, 'chime'),
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
