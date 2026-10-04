import { useEffect, useState } from 'react';
import { ReadingScreen } from './components/ReadingScreen';
import { SetupScreen } from './components/SetupScreen';
import { useHalaqa } from './halaqa/useHalaqa';
import type { Theme } from './halaqa/state';

/** The colour the browser's own chrome takes on a phone, per theme. Kept in
    step with `--bg` in styles/tokens.css and with index.html. */
export const THEME_COLOR: Record<Theme, string> = {
  burgundy: '#2a0f14',
  green: '#0c2019',
  blue: '#0d1729',
};

/**
 * Two screens and no router. The app always opens on the start screen, which
 * offers to carry on a halaqa left open; the reading screen is only ever
 * reached from there, so a refresh never drops a group straight into a page
 * without saying where they are.
 */
export function App() {
  const [state, dispatch] = useHalaqa();
  const [reading, setReading] = useState(false);
  const { theme } = state.prefs;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const open = (go: () => void) => {
    go();
    setReading(true);
    window.scrollTo(0, 0);
  };

  if (reading && state.session)
    return (
      <ReadingScreen
        session={state.session}
        prefs={state.prefs}
        dispatch={dispatch}
      />
    );

  return (
    <SetupScreen
      initial={state.config}
      saved={state.session}
      onStart={(config) => open(() => dispatch({ type: 'start', config }))}
      onResume={() => open(() => {})}
    />
  );
}
