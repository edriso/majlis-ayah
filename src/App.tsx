import { useEffect, useState } from 'react';
import { PhotosContext } from './components/photos';
import { ReadingScreen } from './screens/ReadingScreen';
import { SetupScreen } from './screens/SetupScreen';
import { useHalaqa } from './halaqa/useHalaqa';
import { player } from './halaqa/useRecitation';
import {
  currentPage,
  isComplete,
  type Prefs,
  type State,
  type Theme,
} from './halaqa/state';

/** The colour the browser's own chrome takes on a phone, per theme. Kept in
    step with `--bg` in styles/tokens.css and with index.html. */
export const THEME_COLOR: Record<Theme, string> = {
  burgundy: '#2a0f14',
  green: '#0c2019',
  blue: '#0d1729',
  sand: '#f3eadb',
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

  // The press that opens a halaqa is the one a phone needs to let a
  // reciter seated first, or later, be heard (see player.ts).
  const open = (go: () => void) => {
    player.prime();
    go();
    setReading(true);
    window.scrollTo(0, 0);
  };
  const setPrefs = (prefs: Partial<Prefs>) =>
    dispatch({ type: 'prefs', prefs });

  return (
    <PhotosContext value={state.prefs.photos}>
      {reading && state.session ? (
        <ReadingScreen
          session={state.session}
          prefs={state.prefs}
          dispatch={dispatch}
        />
      ) : (
        <SetupScreen
          initial={initialConfig(state)}
          saved={state.session}
          prefs={state.prefs}
          onPrefs={setPrefs}
          onStart={(config) => open(() => dispatch({ type: 'start', config }))}
          onResume={() => open(() => {})}
        />
      )}
    </PhotosContext>
  );
}

/** A new halaqa set up beside an unfinished one starts where that one
    stopped: the readers may change from one sitting to the next, the place
    in the Mushaf rarely does. */
function initialConfig(state: State) {
  const { session } = state;
  return session && !isComplete(session)
    ? { ...state.config, startPage: currentPage(session) }
    : state.config;
}
