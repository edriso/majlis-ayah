import { describe, expect, it } from 'vitest';
import { LEGACY_KEYS, loadState, saveState, STORAGE_KEY } from './storage';

describe('the saved halaqa', () => {
  it('is adopted from the key the app kept it under as مجلس آية', () => {
    localStorage.setItem(
      LEGACY_KEYS[0],
      JSON.stringify({
        prefs: { theme: 'green', view: 'halaqa' },
        config: { startPage: 50 },
        session: null,
      }),
    );
    const state = loadState();
    expect(state.prefs.theme).toBe('green');
    expect(state.config.startPage).toBe(50);
    saveState(state);
    expect(localStorage.getItem(LEGACY_KEYS[0])).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).prefs.theme).toBe(
      'green',
    );
  });

  it('prefers the current key to the old one', () => {
    localStorage.setItem(
      LEGACY_KEYS[0],
      JSON.stringify({ prefs: { theme: 'green' } }),
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ prefs: { theme: 'blue' } }),
    );
    expect(loadState().prefs.theme).toBe('blue');
  });

  it('starts fresh from a value it cannot read', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState().session).toBeNull();
  });
});
