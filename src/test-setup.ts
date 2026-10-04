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
