import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom has neither; the app only feature-detects them.
if (!window.matchMedia)
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;

// jsdom draws nothing, so it implements no scrolling either.
window.scrollTo = () => {};
if (!('scrollTo' in Element.prototype))
  Object.assign(Element.prototype, { scrollTo: () => {} });

// jsdom has media elements but plays nothing; a recitation here only ever
// starts, and the player is tested on its own with a fake element.
Object.assign(HTMLMediaElement.prototype, {
  play: () => Promise.resolve(),
  pause: () => {},
  load: () => {},
});
