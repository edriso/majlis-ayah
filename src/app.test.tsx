import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

const start = async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: /ابدأ الحلقة/ }));
  return user;
};

/** The top bar: whose turn, and which page. */
const status = () =>
  screen.getByRole('button', { name: /الانتقال إلى صفحة/ }).textContent;

describe('the start screen', () => {
  it('names the app once, as the page heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'مجلس آية',
    );
  });

  it('shows the starting page whichever way it is chosen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('السورة'), '2');
    expect(screen.getByText('الصفحة ٢')).toBeTruthy();
    await user.click(screen.getByLabelText('جزء'));
    await user.selectOptions(screen.getByLabelText('الجزء'), '30');
    expect(screen.getByText('الصفحة ٥٨٢')).toBeTruthy();
    await user.click(screen.getByLabelText('صفحة'));
    const field = screen.getByLabelText(/رقم الصفحة/);
    await user.clear(field);
    await user.type(field, '٢٤{Enter}');
    expect(screen.getByText('الصفحة ٢٤')).toBeTruthy();
  });

  it('hides the reading mode for a single reader', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('group', { name: 'طريقة القراءة' })).toBeTruthy();
    await user.click(screen.getByLabelText('قارئ واحد'));
    expect(screen.queryByRole('group', { name: 'طريقة القراءة' })).toBeNull();
  });
});

describe('a halaqa', () => {
  it('passes the turn round the circle', async () => {
    const user = await start();
    expect(status()).toContain('دورك');
    expect(status()).toContain('الصفحة ١');
    await user.click(
      screen.getByRole('button', { name: /تمّ — القارئ التالي/ }),
    );
    expect(status()).toContain('دور القارئ الثاني');
    expect(status()).toContain('الصفحة ٢');
    await user.click(screen.getByRole('button', { name: /القارئ السابق/ }));
    expect(status()).toContain('دورك');
  });

  it('moves on with the left arrow, the way an Arabic book turns', async () => {
    await start();
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(status()).toContain('الصفحة ٢');
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(status()).toContain('الصفحة ١');
  });

  it('is offered again after a refresh', async () => {
    const user = await start();
    await user.click(
      screen.getByRole('button', { name: /تمّ — القارئ التالي/ }),
    );
    const { unmount } = { unmount: () => document.body.replaceChildren() };
    unmount();
    render(<App />);
    const card = screen.getByRole('region', { name: 'تابع حلقتك' });
    expect(within(card).getByText(/الصفحة ٢ · سورة البقرة/)).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: /متابعة/ }));
    expect(status()).toContain('دور القارئ الثاني');
  });

  it('announces whose turn it is to a screen reader', async () => {
    const user = await start();
    await user.click(
      screen.getByRole('button', { name: /تمّ — القارئ التالي/ }),
    );
    expect(screen.getByRole('status').textContent).toContain(
      'دور القارئ الثاني، الصفحة ٢',
    );
  });
});

describe('accessibility', () => {
  const unnamed = () =>
    [...document.querySelectorAll('button, input, select, a')].filter((el) => {
      const labelled =
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby') ||
        (el as HTMLInputElement).labels?.length ||
        el.textContent?.trim();
      return !labelled;
    });

  it('names every control on the start screen', () => {
    render(<App />);
    expect(unnamed()).toEqual([]);
  });

  it('names every control on the reading screen', async () => {
    await start();
    expect(unnamed()).toEqual([]);
  });

  it('keeps one main landmark, one h1 and a way past the header', async () => {
    await start();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'تخطَّ إلى الصفحة' })).toBeTruthy();
  });
});
