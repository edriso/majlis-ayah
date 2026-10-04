import { ChevronLeft, ChevronRight, Settings, Users } from 'lucide-react';
import { useEffect, useState, type Dispatch } from 'react';
import { arabic, clock, pagesCount } from '@/data/arabic';
import { PAGE_COUNT, surahOfPage } from '@/data/mushaf';
import { reciterById } from '@/data/reciters';
import { pagesDuration } from '@/data/timings';
import { pagesLabel } from '@/halaqa/labels';
import { endsRound, isBeforeStart, pagesOf, readerOf } from '@/halaqa/schedule';
import {
  currentPage,
  currentPages,
  isComplete,
  memberName,
  planOf,
  turnPhrase,
  type Action,
  type Prefs,
  type Session,
  type View,
} from '@/halaqa/state';
import {
  player,
  useListen,
  useReciterTurn,
  useTimings,
} from '@/halaqa/useRecitation';
import { useTurnClock } from '@/halaqa/useTurnClock';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWakeLock } from '@/hooks/useWakeLock';
import { MushafPage } from '@/mushaf/MushafPage';
import {
  ActionBar,
  BackButton,
  DoneButton,
  ListenButton,
  RecitationButton,
  SkipButton,
  TimerButton,
} from './ActionBar';
import { Brand } from './Logo';
import { Choice } from './Choice';
import { HalaqaCircle } from './HalaqaCircle';
import { SettingsPanel } from './SettingsPanel';
import { Sheet } from './Sheet';
import { StartPicker } from './StartPicker';

/**
 * The halaqa itself: the page being read, the circle, and one button that
 * passes the turn on.
 *
 * On a wide screen the circle sits beside the page and the reader chooses
 * which of the two gets the room (المصحف، متوازن، الحلقة). The circle is
 * also the reading order: every seat says what it does next. On a phone the
 * page takes the screen, the line above it says whose turn it is, and the
 * circle is one tap away. Nothing navigates: switching view only resizes
 * what is already here.
 *
 * On a reciter's turn his recitation plays, the page follows it, and the
 * turn passes on when it ends; the primary button pauses it instead.
 */
export function ReadingScreen({
  session,
  prefs,
  dispatch,
}: {
  session: Session;
  prefs: Prefs;
  dispatch: Dispatch<Action>;
}) {
  const { config, anchor, turn } = session;
  const plan = planOf(config);
  const pages = currentPages(session);
  const page = currentPage(session);
  const complete = isComplete(session);
  const member = config.members[readerOf(plan, turn)];
  const nextMember = config.members[readerOf(plan, turn + 1)];
  const nextPages = pagesOf(plan, anchor, turn + 1);
  const lastPageOfTurn = session.pageInTurn >= pages.length - 1;
  const reciting = !complete && member.kind === 'reciter';
  const desktop = useMediaQuery('(min-width: 1100px)');
  // A turn, and the pages it covers: a new key is a new turn to time or
  // to recite from its start.
  const turnKey = `${turn}:${anchor.turn}:${anchor.page}:${plan.mode}:${plan.pagesPerTurn}`;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [circleOpen, setCircleOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useWakeLock(!complete);

  const { timings, retry } = useTimings([
    config.reciter,
    ...config.members.flatMap((m) => (m.kind === 'reciter' ? [m.reciter] : [])),
  ]);

  const finishTurn = () => {
    if (complete) return;
    if (plan.mode === 'repeat' && endsRound(plan, turn) && plan.readers > 1)
      setToast((t) => ({
        id: (t?.id ?? 0) + 1,
        text: `اكتملت ${pagesLabel(pages)}`,
      }));
    dispatch({ type: 'finishTurn' });
  };

  // A reader's turn may be timed by the halaqa's reciter; a reciter's turn
  // is as long as his recitation, and needs no clock.
  const timed = config.turnChange === 'reciter' && !complete && !reciting;
  const paceTimings = timings[config.reciter];
  const duration =
    timed && paceTimings ? pagesDuration(paceTimings, pages) : null;
  const clockState = useTurnClock({
    enabled: timed,
    duration,
    turnKey: `${turnKey}:${config.reciter}`,
    onExpire: finishTurn,
  });

  const recitation = useReciterTurn({
    reciter: member.kind === 'reciter' && !complete ? member.reciter : null,
    turnKey,
    pages,
    page,
    timings,
    onPage: (p) => dispatch({ type: 'goToPage', page: p }),
    onDone: finishTurn,
    onRetry: retry,
  });
  const listen = useListen({
    reciter: config.reciter,
    turnKey,
    page,
    timings,
  });

  const left = reciting ? recitation.left : timed ? clockState.left : null;
  const total = reciting ? recitation.total : timed ? clockState.total : null;
  const progress = left !== null && total ? left / total : null;

  // Every press is a chance to unlock sound for a reciter whose turn comes
  // round later without one (see player.ts).
  const press = (action: () => void) => () => {
    player.prime();
    action();
  };
  const primary = press(() => {
    if (!lastPageOfTurn) dispatch({ type: 'nextPage' });
    else finishTurn();
  });
  const skip = press(finishTurn);
  const toggleRecitation = press(recitation.toggle);
  const back = press(() => {
    if (session.pageInTurn > 0) dispatch({ type: 'previousPage' });
    else dispatch({ type: 'previousTurn' });
  });
  const canGoBack =
    session.pageInTurn > 0 ||
    (turn > 0 && !isBeforeStart(plan, anchor, turn - 1));

  /* A new page starts at its first line. On a phone the page is taller than
     the screen and the reader finished at the foot of the last one; in the
     Quran view on a desktop the page scrolls in its own column. */
  useEffect(() => {
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = smooth ? 'smooth' : 'auto';
    document.querySelector('.mushaf-scroll')?.scrollTo({ top: 0, behavior });
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior });
  }, [page]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* The arrows turn the page the way a right-to-left book turns: left is
     forward. A focused button owns Space and Enter, and a field owns every
     key, so neither is taken from them; the arrows always work, since no
     control here claims them. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('input, select, textarea, [role="dialog"]')) return;
      if (settingsOpen || circleOpen || jumpOpen || complete) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (reciting) skip();
        else primary();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (canGoBack) back();
      } else if (e.key === ' ' && !t?.closest('button, a')) {
        if (reciting) {
          e.preventDefault();
          toggleRecitation();
        } else if (timed) {
          e.preventDefault();
          clockState.toggle();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const prefetch = [...nextPages, page + 1, page - 1].filter(
    (p) => p >= 1 && p <= PAGE_COUNT,
  );

  const reciter =
    member.kind === 'reciter' ? reciterById(member.reciter) : null;
  const nextName = memberName(nextMember);
  const announcement = complete
    ? 'خُتم المصحف. تقبّل الله منكم.'
    : `${turnPhrase(member)}، ${pagesLabel(pages)}${
        pages.length > 1 ? `، الآن الصفحة ${arabic(page)}` : ''
      }${
        reciter && recitation.status === 'blocked'
          ? `. اضغط «استمع إلى ${reciter.short}» لتبدأ تلاوته.`
          : ''
      }`;

  const circle = (
    <HalaqaCircle
      config={config}
      plan={plan}
      anchor={anchor}
      turn={turn}
      page={page}
      progress={progress}
      sounding={reciting && recitation.status === 'playing'}
    />
  );
  const sitting = <Sitting page={page} pagesRead={session.pagesRead} />;

  return (
    <div className="reading" data-view={prefs.view}>
      <a className="skip-link" href="#mushaf">
        تخطَّ إلى الصفحة
      </a>
      <header className="topbar">
        <Brand compact />
        <button
          type="button"
          className="topbar-status"
          onClick={() => setJumpOpen(true)}
          aria-label={`الانتقال إلى صفحة. الآن: ${complete ? 'خُتم المصحف' : `${turnPhrase(member)}، الصفحة ${arabic(page)}`}`}
        >
          {complete ? (
            'خُتم المصحف'
          ) : (
            <>
              <strong>{turnPhrase(member)}</strong>
              {left === null ? (
                <span> · الصفحة {arabic(page)}</span>
              ) : (
                // With a clock beside it, a narrow phone has room only
                // for «ص ٢٤».
                <>
                  <span className="label-long"> · الصفحة {arabic(page)}</span>
                  <span className="label-short"> · ص {arabic(page)}</span>
                  <span className="topbar-clock"> · {clock(left)}</span>
                </>
              )}
            </>
          )}
        </button>
        <div className="topbar-actions">
          {desktop ? (
            <Choice<View>
              legend="العرض"
              hideLegend
              value={prefs.view}
              onChange={(view) => dispatch({ type: 'prefs', prefs: { view } })}
              options={[
                { value: 'quran', label: 'المصحف' },
                { value: 'balanced', label: 'متوازن' },
                { value: 'halaqa', label: 'الحلقة' },
              ]}
            />
          ) : (
            <button
              type="button"
              className="icon-button circle-toggle"
              aria-label="الحلقة"
              onClick={() => setCircleOpen(true)}
            >
              <Users size={20} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label="الإعدادات"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <output className="visually-hidden" aria-live="polite">
        {announcement}
      </output>

      <main className="reading-main">
        {/* The brand in the bar says which app this is; the heading says
            where in it a screen reader has landed. */}
        <h1 className="visually-hidden">مجلس نور: الحلقة</h1>
        <aside className="reading-side" aria-label="الحلقة">
          {circle}
          {sitting}
        </aside>

        <section
          className="reading-quran"
          id="mushaf"
          tabIndex={-1}
          aria-label="المصحف"
        >
          {complete ? (
            <Khatm
              onRestart={() => dispatch({ type: 'restartMushaf' })}
              onEnd={() => dispatch({ type: 'end' })}
              pagesRead={session.pagesRead}
            />
          ) : (
            <div className="mushaf-stage">
              {/* A tab stop, because in the Quran view the page is taller
                  than its column and scrolls, and a region a keyboard cannot
                  reach is text a keyboard cannot read. */}
              <section
                className="mushaf-scroll"
                tabIndex={0}
                aria-label={`صفحة المصحف ${arabic(page)}`}
              >
                <MushafPage page={page} prefetch={prefetch} />
              </section>
              <nav className="page-nav" aria-label="تقليب الصفحات">
                <button
                  type="button"
                  className="quiet-button page-turn"
                  onClick={press(() => dispatch({ type: 'previousPage' }))}
                  aria-disabled={page <= 1}
                  aria-label="الصفحة السابقة"
                >
                  <ChevronRight size={20} aria-hidden="true" />
                  <span className="page-turn-label" aria-hidden="true">
                    السابقة
                  </span>
                </button>
                <button
                  type="button"
                  className="quiet-button page-nav-number"
                  onClick={() => setJumpOpen(true)}
                  aria-label={`الصفحة ${arabic(page)} من ${arabic(PAGE_COUNT)}، انتقل إلى صفحة`}
                >
                  {arabic(page)} / {arabic(PAGE_COUNT)}
                </button>
                <button
                  type="button"
                  className="quiet-button page-turn"
                  onClick={press(() => dispatch({ type: 'nextPage' }))}
                  aria-disabled={page >= PAGE_COUNT}
                  aria-label="الصفحة التالية"
                >
                  <span className="page-turn-label" aria-hidden="true">
                    التالية
                  </span>
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
              </nav>
            </div>
          )}

          {complete ? null : (
            <ActionBar toast={toast} progress={progress}>
              <BackButton
                onClick={back}
                disabled={!canGoBack}
                label={
                  session.pageInTurn > 0 ? 'الصفحة السابقة' : 'القارئ السابق'
                }
              />
              {reciter ? (
                <>
                  <RecitationButton
                    reciter={reciter}
                    status={recitation.status}
                    left={recitation.left}
                    onClick={toggleRecitation}
                  />
                  <SkipButton
                    onClick={skip}
                    label={
                      nextPages.length
                        ? `تخطَّ إلى ${plan.readers > 1 ? `${nextName}، ` : ''}${pagesLabel(nextPages)}`
                        : 'تخطَّ، وبه يُختم المصحف'
                    }
                  />
                </>
              ) : (
                <>
                  <DoneButton
                    onClick={primary}
                    alone={plan.readers === 1}
                    step={
                      lastPageOfTurn
                        ? null
                        : `الصفحة التالية (${arabic(session.pageInTurn + 2)} من ${arabic(pages.length)})`
                    }
                    sub={
                      !lastPageOfTurn
                        ? null
                        : nextPages.length
                          ? `${plan.readers > 1 ? `${nextName} · ` : ''}${pagesLabel(nextPages)}`
                          : 'وبه يُختم المصحف'
                    }
                  />
                  {timed ? (
                    <TimerButton
                      paused={clockState.paused}
                      left={left}
                      onClick={clockState.toggle}
                    />
                  ) : null}
                  <ListenButton
                    status={listen.status}
                    page={pagesLabel([page])}
                    onPlay={press(listen.play)}
                    onStop={listen.stop}
                  />
                </>
              )}
            </ActionBar>
          )}
        </section>
      </main>

      <Sheet
        open={circleOpen}
        onOpenChange={setCircleOpen}
        title="الحلقة"
        description="أهل الحلقة وترتيب القراءة"
      >
        <div className="sheet-halaqa">
          {circle}
          {sitting}
        </div>
      </Sheet>

      <Sheet
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        title="الانتقال إلى"
        description="اختر سورة أو جزءًا أو صفحة، ويُكمل صاحب الدور منها."
      >
        <StartPicker
          legend="الانتقال حسب"
          page={page}
          onChange={(p) => dispatch({ type: 'goToPage', page: p })}
        />
        <button
          type="button"
          className="button button-primary button-block"
          onClick={() => setJumpOpen(false)}
        >
          اقرأ من هنا
        </button>
      </Sheet>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        session={session}
        prefs={prefs}
        desktop={desktop}
        dispatch={dispatch}
      />
    </div>
  );
}

/** Where the circle is in the Mushaf, and how far it has come today. */
function Sitting({ page, pagesRead }: { page: number; pagesRead: number }) {
  return (
    <div className="sitting">
      <p className="sitting-label">
        <span>سورة {surahOfPage(page).name}</span>
        <span>
          {arabic(page)} من {arabic(PAGE_COUNT)}
        </span>
      </p>
      <progress
        className="sitting-bar"
        aria-label="الموضع في المصحف"
        max={PAGE_COUNT}
        value={page}
      />
      <p className="sitting-note">
        {pagesRead
          ? `قرأتم ${pagesCount(pagesRead)} في هذا المجلس`
          : 'بداية المجلس'}
      </p>
    </div>
  );
}

function Khatm({
  onRestart,
  onEnd,
  pagesRead,
}: {
  onRestart: () => void;
  onEnd: () => void;
  pagesRead: number;
}) {
  return (
    <div className="khatm">
      <p className="khatm-ornament" aria-hidden="true">
        ۞
      </p>
      <h2 className="khatm-title">خُتم المصحف</h2>
      <p className="khatm-text">
        تقبّل الله منكم.
        {pagesRead ? ` قرأتم في هذا المجلس ${pagesCount(pagesRead)}.` : ''}
      </p>
      <div className="khatm-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={onRestart}
        >
          ختمة جديدة من الفاتحة
        </button>
        <button type="button" className="button button-quiet" onClick={onEnd}>
          إنهاء الحلقة
        </button>
      </div>
    </div>
  );
}
