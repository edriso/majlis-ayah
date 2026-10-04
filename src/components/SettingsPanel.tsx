import { useState, type Dispatch } from 'react';
import {
  currentPage,
  type Action,
  type Prefs,
  type Session,
  type Theme,
  type View,
} from '@/halaqa/state';
import { Choice } from './Choice';
import { HalaqaForm } from './HalaqaForm';
import { ReciterPicker } from './ReciterPicker';
import { Sheet } from './Sheet';
import { StartPicker } from './StartPicker';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'burgundy', label: 'عنّابي' },
  { value: 'green', label: 'أخضر' },
  { value: 'blue', label: 'أزرق' },
];

/**
 * Everything about the halaqa that can change while it runs, applied as it is
 * chosen: there is no «حفظ», because a halaqa in progress should not be one
 * forgotten button away from ignoring what was just set. Changing the shape
 * of the circle carries on from the page being read, with the same reader.
 */
export function SettingsPanel({
  open,
  onOpenChange,
  session,
  prefs,
  desktop,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session;
  prefs: Prefs;
  desktop: boolean;
  dispatch: Dispatch<Action>;
}) {
  const [panel, setPanel] = useState<'settings' | 'reciters'>('settings');
  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setPanel('settings');
  };
  const configure = (config: Session['config']) =>
    dispatch({ type: 'configure', config });

  if (panel === 'reciters')
    return (
      <Sheet
        open={open}
        onOpenChange={close}
        title="اختر القارئ"
        description="قارئ تُقاس بتلاوته مدة الدور، ويُستمع إليه في الصفحة."
        onBack={() => setPanel('settings')}
      >
        <ReciterPicker
          value={session.config.reciter}
          onChange={(reciter) => {
            configure({ ...session.config, reciter });
            setPanel('settings');
          }}
        />
      </Sheet>
    );

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="الإعدادات"
      description="إعدادات الحلقة والمظهر. تُطبَّق فور اختيارها."
    >
      <section className="settings-section" aria-labelledby="settings-halaqa">
        <h3 id="settings-halaqa" className="settings-heading">
          الحلقة
        </h3>
        <HalaqaForm
          config={session.config}
          onChange={configure}
          onPickReciter={() => setPanel('reciters')}
        />
      </section>

      <section className="settings-section" aria-labelledby="settings-jump">
        <h3 id="settings-jump" className="settings-heading">
          الموضع
        </h3>
        <StartPicker
          legend="الانتقال حسب"
          page={currentPage(session)}
          onChange={(page) => dispatch({ type: 'goToPage', page })}
        />
      </section>

      <section className="settings-section" aria-labelledby="settings-look">
        <h3 id="settings-look" className="settings-heading">
          المظهر
        </h3>
        <Choice<Theme>
          legend="اللون"
          variant="pills"
          value={prefs.theme}
          onChange={(theme) => dispatch({ type: 'prefs', prefs: { theme } })}
          options={THEMES.map((t) => ({
            value: t.value,
            label: (
              <>
                <span
                  className="swatch"
                  data-swatch={t.value}
                  aria-hidden="true"
                />
                {t.label}
              </>
            ),
          }))}
        />
        {desktop ? (
          <Choice<View>
            legend="العرض"
            value={prefs.view}
            onChange={(view) => dispatch({ type: 'prefs', prefs: { view } })}
            options={[
              { value: 'quran', label: 'المصحف' },
              { value: 'balanced', label: 'متوازن' },
              { value: 'halaqa', label: 'الحلقة' },
            ]}
          />
        ) : null}
      </section>

      <section className="settings-section" aria-labelledby="settings-keys">
        <h3 id="settings-keys" className="settings-heading">
          لوحة المفاتيح
        </h3>
        <dl className="shortcuts">
          <div>
            <dt>
              <kbd>←</kbd>
            </dt>
            <dd>تمّ، القارئ التالي (أو الصفحة التالية في الدور)</dd>
          </div>
          <div>
            <dt>
              <kbd>→</kbd>
            </dt>
            <dd>رجوع إلى الصفحة أو القارئ السابق</dd>
          </div>
          <div>
            <dt>
              <kbd>مسافة</kbd>
            </dt>
            <dd>إيقاف التوقيت مؤقتًا واستئنافه</dd>
          </div>
        </dl>
      </section>

      <section
        className="settings-section settings-about"
        aria-labelledby="settings-about"
      >
        <h3 id="settings-about" className="settings-heading">
          عن مجلس آية
        </h3>
        <p>
          صفحات مصحف المدينة النبوية برواية حفص، طبعة مجمع الملك فهد لطباعة
          المصحف الشريف، بخطوطه وبيانات صفحاته عن{' '}
          <a href="https://quran.com" target="_blank" rel="noreferrer">
            Quran.com
          </a>
          . التلاوات عن{' '}
          <a href="https://quranicaudio.com" target="_blank" rel="noreferrer">
            QuranicAudio
          </a>
          . صور القرّاء من ويكيميديا كومنز، ومصدر كل صورة وترخيصها في{' '}
          <a
            href="https://github.com/edriso/majlis-ayah/blob/main/NOTICE"
            target="_blank"
            rel="noreferrer"
          >
            ملف المصادر
          </a>
          .
        </p>
        <p>يُحفظ كل شيء على جهازك وحده، ولا يُرسل إلى أحد.</p>
        <p>
          <a
            href="https://github.com/edriso/majlis-ayah"
            target="_blank"
            rel="noreferrer"
          >
            الشيفرة المصدرية
          </a>
        </p>
      </section>

      <button
        type="button"
        className="button button-danger button-block"
        onClick={() => {
          close(false);
          dispatch({ type: 'end' });
        }}
      >
        إنهاء الحلقة
      </button>
    </Sheet>
  );
}
