import { describe, expect, it } from 'vitest';
import {
  currentPage,
  currentPages,
  defaultConfig,
  initialState,
  isComplete,
  memberName,
  newMember,
  reduce,
  sanitizeState,
  planOf,
  turnPhrase,
  type Action,
  type Config,
  type Member,
  type State,
} from './state';
import { readerOf, round } from './schedule';

const run = (config: Partial<Config>, ...actions: Action[]) =>
  actions.reduce(
    reduce,
    reduce(initialState, {
      type: 'start',
      config: { ...defaultConfig, ...config },
    }),
  );

const person = (id: string, name = ''): Member => ({
  id,
  kind: 'person',
  name,
});

const where = (s: State) => {
  const session = s.session!;
  return {
    page: currentPage(session),
    reader: session.turn % session.config.members.length,
  };
};

describe('a halaqa', () => {
  it('runs the example session from the brief', () => {
    // Al-Baqarah from page 2, three readers, continue, one page each.
    let s = run({ startPage: 2 });
    const seen = [where(s)];
    for (let i = 0; i < 3; i++) {
      s = reduce(s, { type: 'finishTurn' });
      seen.push(where(s));
    }
    expect(seen).toEqual([
      { page: 2, reader: 0 },
      { page: 3, reader: 1 },
      { page: 4, reader: 2 },
      { page: 5, reader: 0 },
    ]);
    expect(s.session!.pagesRead).toBe(3);
  });

  it('steps through a turn of two pages before passing it on', () => {
    let s = run({ startPage: 20, pagesPerTurn: 2 });
    expect(currentPages(s.session!)).toEqual([20, 21]);
    s = reduce(s, { type: 'nextPage' });
    expect(where(s)).toEqual({ page: 21, reader: 0 });
    s = reduce(s, { type: 'finishTurn' });
    expect(where(s)).toEqual({ page: 22, reader: 1 });
  });

  it('counts a repeated page once, when the round completes', () => {
    let s = run({ startPage: 24, mode: 'repeat' });
    s = reduce(s, { type: 'finishTurn' });
    s = reduce(s, { type: 'finishTurn' });
    expect(s.session!.pagesRead).toBe(0);
    s = reduce(s, { type: 'finishTurn' });
    expect(s.session!.pagesRead).toBe(1);
    expect(where(s)).toEqual({ page: 25, reader: 0 });
  });

  it('goes back to the previous reader and un-counts their pages', () => {
    let s = run({ startPage: 10 }, { type: 'finishTurn' });
    s = reduce(s, { type: 'previousTurn' });
    expect(where(s)).toEqual({ page: 10, reader: 0 });
    expect(s.session!.pagesRead).toBe(0);
    expect(reduce(s, { type: 'previousTurn' })).toBe(s);
  });

  it('moves the whole circle one page on past the end of a turn', () => {
    let s = run({ startPage: 10 });
    s = reduce(s, { type: 'nextPage' });
    expect(where(s)).toEqual({ page: 11, reader: 0 });
    s = reduce(s, { type: 'finishTurn' });
    expect(where(s)).toEqual({ page: 12, reader: 1 });
  });

  it('jumps to a page with the same reader', () => {
    let s = run({ startPage: 10 }, { type: 'finishTurn' });
    s = reduce(s, { type: 'goToPage', page: 300 });
    expect(where(s)).toEqual({ page: 300, reader: 1 });
    s = reduce(s, { type: 'finishTurn' });
    expect(where(s)).toEqual({ page: 301, reader: 2 });
  });

  it('keeps the page and the reader when the circle changes shape', () => {
    let s = run({ startPage: 10 }, { type: 'finishTurn' });
    const config = {
      ...s.session!.config,
      mode: 'repeat' as const,
      pagesPerTurn: 2,
    };
    s = reduce(s, { type: 'configure', config });
    expect(where(s)).toEqual({ page: 11, reader: 1 });
    expect(currentPages(s.session!)).toEqual([11, 12]);
    // Two readers now: reader 3 is gone, so a reader beyond the circle
    // falls back to the last seat.
    s = reduce(s, {
      type: 'configure',
      config: { ...config, members: config.members.slice(0, 2) },
    });
    expect(
      readerOf(
        { readers: 2, mode: 'repeat', pagesPerTurn: 2 },
        s.session!.turn,
      ),
    ).toBe(1);
  });

  it('completes the Mushaf, then starts a new khatma from al-Fatihah', () => {
    let s = run(
      { startPage: 604, members: [person('p1')] },
      { type: 'finishTurn' },
    );
    expect(isComplete(s.session!)).toBe(true);
    expect(reduce(s, { type: 'finishTurn' })).toBe(s);
    s = reduce(s, { type: 'restartMushaf' });
    expect(where(s)).toEqual({ page: 1, reader: 0 });
  });

  it('ends', () => {
    expect(run({}, { type: 'end' }).session).toBeNull();
  });
});

describe('the circle', () => {
  it('keeps the reader when the circle is reordered', () => {
    // Omar (p2) is reading page 11; the circle is turned round.
    let s = run({ startPage: 10 }, { type: 'finishTurn' });
    const [a, b, c] = s.session!.config.members;
    s = reduce(s, {
      type: 'configure',
      config: { ...s.session!.config, members: [c, b, a] },
    });
    expect(where(s).page).toBe(11);
    const session = s.session!;
    expect(session.config.members[where(s).reader].id).toBe('p2');
    // And the circle goes on in its new order: c, b, a, c …
    s = reduce(s, { type: 'finishTurn' });
    expect(s.session!.config.members[where(s).reader].id).toBe('p1');
    expect(where(s).page).toBe(12);
  });

  it('gives the turn to whoever takes the seat of a reader who leaves', () => {
    let s = run({ startPage: 10 }, { type: 'finishTurn' });
    const [a, , c] = s.session!.config.members;
    s = reduce(s, {
      type: 'configure',
      config: { ...s.session!.config, members: [a, c] },
    });
    expect(s.session!.config.members[where(s).reader].id).toBe('p3');
    expect(where(s).page).toBe(11);
  });

  it('changes nothing about the turn when only a name changes', () => {
    const s = run({ startPage: 10 }, { type: 'finishTurn' });
    const members = s.session!.config.members.map((m) =>
      m.id === 'p2' ? { ...m, name: 'عمر' } : m,
    );
    const t = reduce(s, {
      type: 'configure',
      config: { ...s.session!.config, members },
    });
    expect(t.session!.turn).toBe(s.session!.turn);
    expect(t.session!.anchor).toEqual(s.session!.anchor);
  });

  describe('in repeat mode, nobody misses the page', () => {
    const ids = (st: State) => st.session!.config.members.map((m) => m.id);
    const reading = (st: State) =>
      st.session!.config.members[where(st).reader].id;
    const states = (st: State) => {
      const session = st.session!;
      return round(planOf(session.config), session.anchor, session.turn).map(
        (r) => r.state,
      );
    };
    const reorder = (st: State, order: string[]) =>
      reduce(st, {
        type: 'configure',
        config: {
          ...st.session!.config,
          members: order.map((id) =>
            st.session!.config.members.find((m) => m.id === id)!,
          ),
        },
      });

    it('starts the page over when someone who has not read it moves ahead', () => {
      // p1 is reading page 20 and nobody has read it yet.
      let s = run({ startPage: 20, mode: 'repeat' });
      s = reorder(s, ['p2', 'p1', 'p3']);
      expect(ids(s)).toEqual(['p2', 'p1', 'p3']);
      expect(reading(s)).toBe('p2');
      expect(where(s).page).toBe(20);
      for (const next of ['p1', 'p3']) {
        s = reduce(s, { type: 'finishTurn' });
        expect([reading(s), where(s).page]).toEqual([next, 20]);
      }
      s = reduce(s, { type: 'finishTurn' });
      expect([reading(s), where(s).page]).toEqual(['p2', 21]);
    });

    it('lets the reader carry on when everyone ahead has read the page', () => {
      // p1 has read page 20; p2 is reading it; a fourth reader joins.
      let s = run({ startPage: 20, mode: 'repeat' }, { type: 'finishTurn' });
      const members = [...s.session!.config.members, person('p4', 'زيد')];
      s = reduce(s, {
        type: 'configure',
        config: { ...s.session!.config, members },
      });
      expect([reading(s), where(s).page]).toEqual(['p2', 20]);
      expect(states(s)).toEqual(['done', 'now', 'waiting', 'waiting']);
    });

    it('puts a reader who has not read the page first, ahead of one who has', () => {
      let s = run({ startPage: 20, mode: 'repeat' }, { type: 'finishTurn' });
      s = reorder(s, ['p3', 'p2', 'p1']);
      expect([reading(s), where(s).page]).toEqual(['p3', 20]);
    });

    it('changes nothing when only those after the reader are reordered', () => {
      const s = run({ startPage: 20, mode: 'repeat' }, { type: 'finishTurn' });
      const t = reorder(s, ['p1', 'p2', 'p3']);
      expect(t.session!.turn).toBe(s.session!.turn);
    });
  });

  it('seats a reciter like anyone else', () => {
    const sheikh: Member = { id: 'r1', kind: 'reciter', reciter: 'minshawi' };
    let s = run({
      startPage: 24,
      mode: 'repeat',
      members: [sheikh, person('p1')],
    });
    expect(turnPhrase(s.session!.config.members[0])).toBe('يتلو المنشاوي');
    s = reduce(s, { type: 'finishTurn' });
    expect(where(s)).toEqual({ page: 24, reader: 1 });
    s = reduce(s, { type: 'finishTurn' });
    expect(where(s)).toEqual({ page: 25, reader: 0 });
  });

  it('adds members with the first free id, up to four', () => {
    const members: Member[] = [person('p1'), person('p3')];
    expect(newMember(members, 'person')!.id).toBe('p2');
    expect(newMember(members, 'reciter', 'alafasy')).toEqual({
      id: 'r1',
      kind: 'reciter',
      reciter: 'alafasy',
    });
    const full = [...members, person('p2'), person('p4')];
    expect(newMember(full, 'person')).toBeNull();
  });
});

describe('member names', () => {
  it('defaults the first reader to the person holding the device', () => {
    expect(memberName(person('p1'))).toBe('أنت');
    expect(turnPhrase(person('p1'))).toBe('دورك');
  });
  it('uses a given name', () => {
    expect(turnPhrase(person('p2', 'عمر'))).toBe('دور عمر');
    expect(turnPhrase(person('p1', 'عمر'))).toBe('دور عمر');
  });
  it('numbers the rest by who they are, not where they sit', () => {
    expect(memberName(person('p3'))).toBe('القارئ الثالث');
  });
  it('names a reciter by the name he is known by', () => {
    expect(memberName({ id: 'r1', kind: 'reciter', reciter: 'husary' })).toBe(
      'الحصري',
    );
  });
});

describe('a saved halaqa', () => {
  it('survives a round trip', () => {
    const s = run({ startPage: 77 }, { type: 'finishTurn' });
    expect(sanitizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('is repaired, never trusted', () => {
    const s = sanitizeState({
      prefs: { theme: 'neon', view: 7 },
      config: { readers: 'x', pagesPerTurn: 9, startPage: 9000 },
      session: { turn: -3, anchor: { turn: 5, page: 0 }, config: {} },
    });
    expect(s.prefs).toEqual({ theme: 'burgundy', view: 'balanced' });
    expect(s.config.pagesPerTurn).toBe(1);
    expect(s.config.startPage).toBe(1);
    expect(s.session!.turn).toBe(0);
    expect(s.session!.anchor).toEqual({ turn: 0, page: 1 });
  });

  it('turns a halaqa saved before reciters could sit into people', () => {
    const s = sanitizeState({
      config: { readers: ['', 'عمر', ''], mode: 'repeat' },
      session: {
        config: { readers: ['أحمد', ''] },
        turn: 3,
        anchor: { turn: 0, page: 50 },
      },
    });
    expect(s.config.members).toEqual([
      person('p1'),
      person('p2', 'عمر'),
      person('p3'),
    ]);
    expect(s.config.members.map(memberName)).toEqual([
      'أنت',
      'عمر',
      'القارئ الثالث',
    ]);
    expect(s.session!.config.members).toEqual([
      person('p1', 'أحمد'),
      person('p2'),
    ]);
    expect(where(s)).toEqual({ page: 53, reader: 1 });
  });

  it('repairs members it cannot trust', () => {
    const s = sanitizeState({
      config: {
        members: [
          { id: 'p1', kind: 'person', name: 7 },
          { id: 'p1', kind: 'person', name: 'عمر' },
          { id: 'r9', kind: 'reciter', reciter: 'nobody' },
          null,
          { kind: 'person' },
          { kind: 'person' },
        ],
      },
    });
    expect(s.config.members).toEqual([
      person('p1'),
      person('p2', 'عمر'),
      { id: 'r1', kind: 'reciter', reciter: 'husary' },
      person('p3'),
    ]);
  });

  it('starts fresh from nothing', () => {
    expect(sanitizeState(null)).toEqual(initialState);
  });
});
