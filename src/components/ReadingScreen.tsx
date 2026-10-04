import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Pause,
  Play,
  Settings,
  Square,
  Undo2,
  Users,
} from 'lucide-react';
import { useEffect, useState, type Dispatch } from 'react';
import { arabic, clock, durationWords, pagesCount } from '@/data/arabic';
import { PAGE_COUNT, surahOfPage } from '@/data/mushaf';
import { loadTimings, pagesDuration, type Timings } from '@/data/timings';
import { pagesLabel } from '@/halaqa/labels';
import { endsRound, isBeforeStart, pagesOf, readerOf } from '@/halaqa/schedule';
import {
  currentPage,
  currentPages,
  isComplete,
  planOf,
  readerName,
  turnPhrase,
  type Action,
  type Prefs,
  type Session,
  type View,
} from '@/halaqa/state';
import { usePageAudio } from '@/halaqa/usePageAudio';
import { useTurnClock } from '@/halaqa/useTurnClock';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWakeLock } from '@/hooks/useWakeLock';
import { MushafPage } from '@/mushaf/MushafPage';
import { Brand } from './Logo';
import { Choice } from './Choice';
import { HalaqaCircle } from './HalaqaCircle';
import { ReadingOrder } from './ReadingOrder';
import { SettingsPanel } from './SettingsPanel';
import { Sheet } from './Sheet';
import { StartPicker } from './StartPicker';

/**
 * The halaqa itself: the page being read, the circle, who reads next, and
 * one button that passes the turn on.
 *
 * On a wide screen the three sit side by side and the reader chooses which
 * one gets the room (المصحف، متوازن، الحلقة). On a phone the page takes the
 * screen, the line above it says whose turn it is, and the circle is one tap
 * away. Nothing navigates: switching view only resizes what is already here.
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
  const reader = readerOf(plan, turn);
  const nextReader = readerOf(plan, turn + 1);
  const nextPages = pagesOf(plan, anchor, turn + 1);
  const lastPageOfTurn = session.pageInTurn >= pages.length - 1;
  const desktop = useMediaQuery('(min-width: 1100px)');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [circleOpen, setCircleOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useWakeLock(!complete);

  const timings = useTimings(config.reciter, config.turnChange === 'reciter');
  const duration = timings && !complete ? pagesDuration(timings, pages) : null;
  const timed = config.turnChange === 'reciter' && !complete;

  const finishTurn = () => {
    if (complete) return;
    if (plan.mode === 'repeat' && endsRound(plan, turn) && plan.readers > 1)
      setToast((t) => ({
        id: (t?.id ?? 0) + 1,
        text: `اكتملت ${pagesLabel(pages)}`,
      }));
    dispatch({ type: 'finishTurn' });
  };

  const clockState = useTurnClock({
    enabled: timed,
    duration,
    turnKey: `${turn}:${anchor.turn}:${anchor.page}:${config.pagesPerTurn}:${config.reciter}`,
    onExpire: finishTurn,
  });
  const left = timed ? clockState.left : null;
  const progress =
    timed && clockState.left !== null && clockState.total
      ? clockState.left / clockState.total
      : null;

  const audio = usePageAudio(config.reciter, page);

  const primary = () => {
    if (!lastPageOfTurn) dispatch({ type: 'nextPage' });
    else finishTurn();
  };
  const back = () => {
    if (session.pageInTurn > 0) dispatch({ type: 'previousPage' });
    else dispatch({ type: 'previousTurn' });
  };
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
      if (settingsOpen || circleOpen || jumpOpen) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        primary();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (canGoBack) back();
      } else if (e.key === ' ' && timed && !t?.closest('button, a')) {
        e.preventDefault();
        clockState.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const prefetch = [...nextPages, page + 1, page - 1].filter(
    (p) => p >= 1 && p <= PAGE_COUNT,
  );

  const announcement = complete
    ? 'خُتم المصحف. تقبّل الله منكم.'
    : `${turnPhrase(config, reader)}، ${pagesLabel(pages)}${
        pages.length > 1 ? `، تقرأ الآن الصفحة ${arabic(page)}` : ''
      }`;

  const circle = (
    <HalaqaCircle
      config={config}
      plan={plan}
      anchor={anchor}
      turn={turn}
      page={page}
      progress={progress}
    />
  );
  const order = (
    <ReadingOrder
      config={config}
      plan={plan}
      anchor={anchor}
      turn={turn}
      left={left}
    />
  );

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
          aria-label={`الانتقال إلى صفحة. الآن: ${complete ? 'خُتم المصحف' : `${turnPhrase(config, reader)}، الصفحة ${arabic(page)}`}`}
        >
          {complete ? (
            'خُتم المصحف'
          ) : (
            <>
              <strong>{turnPhrase(config, reader)}</strong>
              <span> · الصفحة {arabic(page)}</span>
              {left !== null ? (
                <span className="topbar-clock"> · {clock(left)}</span>
              ) : null}
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
              aria-label="الحلقة وترتيب القراءة"
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
        <aside className="reading-side reading-circle" aria-label="الحلقة">
          {circle}
          <p className="progress-note">
            {session.pagesRead
              ? `قرأتم ${pagesCount(session.pagesRead)} في هذا المجلس`
              : 'بداية المجلس'}
          </p>
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
            <>
              <div className="mushaf-stage">
                {/* A tab stop, because in the Quran view the page is taller than
                    its column and scrolls, and a region a keyboard cannot
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
                    onClick={() => dispatch({ type: 'previousPage' })}
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
                    onClick={() => dispatch({ type: 'nextPage' })}
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
            </>
          )}

          {!complete && (
            <div className="action-bar">
              {toast ? (
                <p key={toast.id} className="toast" aria-hidden="true">
                  {toast.text}
                </p>
              ) : null}
              {progress !== null ? (
                <div className="turn-progress" aria-hidden="true">
                  <span style={{ transform: `scaleX(${progress})` }} />
                </div>
              ) : null}
              <button
                type="button"
                className="action-secondary"
                onClick={back}
                aria-disabled={!canGoBack}
                aria-keyshortcuts="ArrowRight"
                title="رجوع (→)"
              >
                <Undo2 size={20} aria-hidden="true" />
                <span className="action-secondary-label">
                  {session.pageInTurn > 0 ? 'الصفحة السابقة' : 'القارئ السابق'}
                </span>
              </button>

              <button
                type="button"
                className="action-primary"
                onClick={primary}
                aria-keyshortcuts="ArrowLeft"
                title="(←)"
              >
                <span className="action-primary-main">
                  {!lastPageOfTurn ? (
                    `الصفحة التالية (${arabic(session.pageInTurn + 2)} من ${arabic(pages.length)})`
                  ) : plan.readers > 1 ? (
                    <>
                      <span className="label-long">تمّ — القارئ التالي</span>
                      <span className="label-short" aria-hidden="true">
                        تمّ — التالي
                      </span>
                    </>
                  ) : (
                    'تمّ — متابعة'
                  )}
                  <ArrowLeft size={20} aria-hidden="true" />
                </span>
                {lastPageOfTurn ? (
                  <span className="action-primary-sub">
                    {nextPages.length
                      ? `${plan.readers > 1 ? `${readerName(config, nextReader)} · ` : ''}${pagesLabel(nextPages)}`
                      : 'وبه يُختم المصحف'}
                  </span>
                ) : null}
              </button>

              {timed ? (
                <button
                  type="button"
                  className="action-secondary"
                  onClick={clockState.toggle}
                  aria-pressed={clockState.paused}
                  aria-label={
                    clockState.paused
                      ? `استئناف التوقيت، بقي ${durationWords(left ?? 0)}`
                      : `إيقاف التوقيت مؤقتًا، بقي ${durationWords(left ?? 0)}`
                  }
                >
                  {clockState.paused ? (
                    <Play size={20} aria-hidden="true" />
                  ) : (
                    <Pause size={20} aria-hidden="true" />
                  )}
                  <span className="action-clock" aria-hidden="true">
                    {left === null ? '…' : clock(left)}
                  </span>
                </button>
              ) : null}

              <button
                type="button"
                className="action-secondary"
                data-active={
                  audio.status === 'playing' ||
                  audio.status === 'loading' ||
                  undefined
                }
                onClick={
                  audio.status === 'idle' || audio.status === 'error'
                    ? audio.play
                    : audio.stop
                }
                aria-label={
                  audio.status === 'playing' || audio.status === 'loading'
                    ? 'إيقاف الاستماع'
                    : `استمع إلى الصفحة ${arabic(page)}`
                }
              >
                {audio.status === 'playing' || audio.status === 'loading' ? (
                  <Square size={18} aria-hidden="true" />
                ) : (
                  <Headphones size={20} aria-hidden="true" />
                )}
                <span className="action-secondary-label" aria-hidden="true">
                  {audio.status === 'loading'
                    ? 'جارٍ التحميل…'
                    : audio.status === 'playing'
                      ? 'إيقاف'
                      : audio.status === 'error'
                        ? 'تعذّر التشغيل'
                        : 'استمع'}
                </span>
              </button>
            </div>
          )}
        </section>

        <aside
          className="reading-side reading-order"
          aria-label="ترتيب القراءة"
        >
          {order}
          <div className="mushaf-progress">
            <p className="mushaf-progress-label">
              <span>سورة {surahOfPage(page).name}</span>
              <span>
                {arabic(page)} من {arabic(PAGE_COUNT)}
              </span>
            </p>
            <progress
              className="mushaf-progress-bar"
              aria-label="الموضع في المصحف"
              max={PAGE_COUNT}
              value={page}
            />
          </div>
        </aside>
      </main>

      <Sheet
        open={circleOpen}
        onOpenChange={setCircleOpen}
        title="الحلقة"
        description="القرّاء وترتيب القراءة"
      >
        <div className="sheet-halaqa">
          {circle}
          {order}
        </div>
      </Sheet>

      <Sheet
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        title="الانتقال إلى"
        description="اختر سورة أو جزءًا أو صفحة، ويُكمل القارئ الحالي منها."
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

function useTimings(reciter: string, needed: boolean) {
  const [loaded, setLoaded] = useState<{ id: string; t: Timings } | null>(null);
  useEffect(() => {
    if (!needed) return;
    let live = true;
    loadTimings(reciter).then(
      (t) => live && setLoaded({ id: reciter, t }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [reciter, needed]);
  return loaded?.id === reciter ? loaded.t : null;
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
