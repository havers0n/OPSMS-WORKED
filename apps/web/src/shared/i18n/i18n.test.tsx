import { fireEvent, render } from '@testing-library/react';
import { BffRequestError } from '@/shared/api/bff/client';
import { I18nProvider, translate, translateBffError, useI18n, useT } from '.';

function Probe() {
  const { dir, locale } = useI18n();
  const t = useT();

  return (
    <div data-locale={locale} data-dir={dir}>
      {t('warehouse.bootstrap.step', { step: 3 })}
    </div>
  );
}

function SwitchProbe() {
  const { dir, locale, setLocale } = useI18n();
  return (
    <button type="button" data-locale={locale} data-dir={dir} onClick={() => setLocale('en')}>
      switch
    </button>
  );
}

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('falls back to English when a Hebrew key is missing', () => {
    expect(translate('i18n.fallbackProbe')).toBe('Fallback text');
  });

  it('interpolates parameters', () => {
    expect(translate('warehouse.bootstrap.step', { step: 2 }, 'en')).toBe('Step 2');
  });

  it('translates known BFF error codes and hides unknown messages behind diagnostics', () => {
    const conflictError = new BffRequestError(
      409,
      'DRAFT_CONFLICT',
      'server message',
      'req-1',
      null
    );
    const unknownError = new BffRequestError(
      500,
      'UNKNOWN_CODE',
      'raw backend detail',
      'req-2',
      null
    );

    expect(translateBffError(conflictError)).toBe(translate('error.DRAFT_CONFLICT'));
    expect(
      translateBffError(unknownError)
    ).toBe(translate('error.withRequestId', { requestId: 'req-2' }));
  });

  it('sets Hebrew RTL metadata on the document', () => {
    const { getByText } = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    const translatedStep = getByText(translate('warehouse.bootstrap.step', { step: 3 }));
    expect(translatedStep.getAttribute('data-locale')).toBe('he');
    expect(translatedStep.getAttribute('data-dir')).toBe('rtl');
  });

  it('switches locale, persists it, and updates document direction', () => {
    const { getByText } = render(
      <I18nProvider>
        <SwitchProbe />
      </I18nProvider>
    );

    const switchButton = getByText('switch');
    expect(switchButton.getAttribute('data-locale')).toBe('he');

    fireEvent.click(switchButton);

    expect(switchButton.getAttribute('data-locale')).toBe('en');
    expect(switchButton.getAttribute('data-dir')).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(window.localStorage.getItem('wos:locale')).toBe('en');
  });
});
