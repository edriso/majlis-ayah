import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { arabic } from '@/data/arabic';
import { surahOfPage } from '@/data/mushaf';
import {
  currentPage,
  isComplete,
  readerName,
  type Config,
  type Session,
} from '@/halaqa/state';
import { HalaqaForm } from './HalaqaForm';
import { LogoMark } from './Logo';
import { ReciterPicker } from './ReciterPicker';
import { Sheet } from './Sheet';
import { StartPicker } from './StartPicker';

/**
 * The first screen, every time the app opens: the name, one line saying what
 * it is for, and the few choices a halaqa needs. Everything has a default, so
 * «ابدأ الحلقة» works on arrival.
 *
 * A halaqa left open (the page refreshed, the phone locked) is offered first,
 * as one card, because carrying on is what someone returning almost always
 * wants. Starting over is the quieter link under it.
 */
export function SetupScreen({
  initial,
  saved,
  onStart,
  onResume,
}: {
  initial: Config;
  saved: Session | null;
  onStart: (config: Config) => void;
  onResume: () => void;
}) {
  const [config, setConfig] = useState<Config>(initial);
  const [showForm, setShowForm] = useState(!saved);
  const [picking, setPicking] = useState(false);

  return (
    <main className="setup" id="main">
      <header className="setup-intro">
        <LogoMark size={64} />
        <h1 className="setup-title">
          <span className="setup-title-ar">مجلس آية</span>
        </h1>
        <p className="setup-tagline">حلقة قرآن، أينما كنتم.</p>
      </header>

      {saved && !showForm ? (
        <section className="resume" aria-labelledby="resume-title">
          <h2 id="resume-title" className="resume-title">
            تابع حلقتك
          </h2>
          <ResumeSummary session={saved} />
          <button
            type="button"
            className="button button-primary button-block"
            onClick={onResume}
          >
            متابعة
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => setShowForm(true)}
          >
            ابدأ حلقة جديدة
          </button>
        </section>
      ) : (
        <form
          className="setup-form"
          onSubmit={(e) => {
            e.preventDefault();
            onStart(config);
          }}
        >
          <StartPicker
            page={config.startPage}
            onChange={(startPage) => setConfig({ ...config, startPage })}
          />
          <HalaqaForm
            config={config}
            onChange={setConfig}
            onPickReciter={() => setPicking(true)}
          />
          <button
            type="submit"
            className="button button-primary button-block button-large"
          >
            ابدأ الحلقة
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          {saved ? (
            <button
              type="button"
              className="button button-quiet"
              onClick={() => setShowForm(false)}
            >
              العودة إلى الحلقة السابقة
            </button>
          ) : null}
        </form>
      )}

      <Sheet
        open={picking}
        onOpenChange={setPicking}
        title="اختر القارئ"
        description="قارئ تُقاس بتلاوته مدة الدور، ويُستمع إليه في الصفحة."
      >
        <ReciterPicker
          value={config.reciter}
          onChange={(reciter) => {
            setConfig({ ...config, reciter });
            setPicking(false);
          }}
        />
      </Sheet>
    </main>
  );
}

function ResumeSummary({ session }: { session: Session }) {
  const page = currentPage(session);
  const { config } = session;
  const reader = session.turn % config.readers.length;
  return (
    <p className="resume-summary">
      <span className="resume-page">
        الصفحة {arabic(page)} · سورة {surahOfPage(page).name}
      </span>
      <span className="resume-reader">
        {isComplete(session)
          ? 'خُتم المصحف'
          : config.readers.length > 1
            ? `الدور على: ${readerName(config, reader)}`
            : 'قراءة فردية'}
      </span>
    </p>
  );
}
