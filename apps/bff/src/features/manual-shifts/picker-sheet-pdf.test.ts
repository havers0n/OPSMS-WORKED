import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSupabaseAuthStorageKey } from '@wos/domain';
import { SUPABASE_STORAGE_KEY, classifyRenderFailure, generatePickerSheetPdf } from './picker-sheet-pdf.js';
import { env } from '../../env.js';

type MockResponse = {
  url: string;
  status: number;
};

type MockRequestFailure = {
  method: string;
  url: string;
  failure: string;
};

type MockConsoleMessage = {
  type: 'warning' | 'error';
  text: string;
};

type MockPageState = {
  finalUrl: string;
  title: string;
  bodyText: string;
  hasSupabaseAuthStorageKey: boolean;
  selectorCounts: Record<string, number>;
  responses: MockResponse[];
  failedRequests: MockRequestFailure[];
  consoleMessages: MockConsoleMessage[];
};

const BASE_SELECTOR_COUNTS = {
  '.print-table': 1,
  '[data-testid="auth-startup-loading"]': 0,
  '[data-testid="auth-startup-error"]': 0,
  '[data-testid="workspace-access-error"]': 0,
  '[data-testid="protected-route-loading"]': 0,
  '[data-testid="app-route-error"]': 0,
  '[data-testid="print-picker-sheet-error"]': 0
} as const;

function createDefaultMockPageState(): MockPageState {
  return {
    finalUrl: 'http://web/operator/manual/print/picker-sheet?pdfRender=1',
    title: 'Picker sheet',
    bodyText: 'Printable body',
    hasSupabaseAuthStorageKey: true,
    selectorCounts: {
      '.print-table': 1,
      '[data-testid="auth-startup-loading"]': 0,
      '[data-testid="auth-startup-error"]': 0,
      '[data-testid="workspace-access-error"]': 0,
      '[data-testid="protected-route-loading"]': 0,
      '[data-testid="app-route-error"]': 0,
      '[data-testid="print-picker-sheet-error"]': 0
    },
    responses: [],
    failedRequests: [],
    consoleMessages: []
  };
}

function createMockLocator(getCount: () => number) {
  return {
    count: vi.fn().mockImplementation(async () => getCount())
  };
}

function resetMockPageState() {
  Object.assign(mockHolder.browser._context._page._state, createDefaultMockPageState());
}

const mockHolder = vi.hoisted(() => {
  const FAKE_PDF_BUFFER = Buffer.from('fake-pdf-data');

  function createMockPage() {
    const listeners = {
      console: [] as Array<(message: { type: () => string; text: () => string }) => void>,
      requestfailed: [] as Array<(
        request: { method: () => string; url: () => string; failure: () => { errorText: string } | null }
      ) => void>,
      response: [] as Array<(response: { url: () => string; status: () => number }) => void>
    };

    const state: MockPageState = createDefaultMockPageState();

    const locators = new Map<string, ReturnType<typeof createMockLocator>>();

    const page = {
      addInitScript: vi.fn(async () => undefined),
      waitForSelector: vi.fn(async (selector: string) => {
        if ((state.selectorCounts[selector] ?? 0) > 0) {
          return {};
        }

        throw new Error('timeout');
      }),
      goto: vi.fn().mockImplementation(async () => {
        for (const response of state.responses) {
          for (const handler of listeners.response) {
            handler({
              url: () => response.url,
              status: () => response.status
            });
          }
        }

        for (const failure of state.failedRequests) {
          for (const handler of listeners.requestfailed) {
            handler({
              method: () => failure.method,
              url: () => failure.url,
              failure: () => ({ errorText: failure.failure })
            });
          }
        }

        for (const message of state.consoleMessages) {
          for (const handler of listeners.console) {
            handler({
              type: () => message.type,
              text: () => message.text
            });
          }
        }
      }),
      waitForTimeout: vi.fn(async () => undefined),
      pdf: vi.fn(async () => FAKE_PDF_BUFFER),
      close: vi.fn(async () => undefined),
      title: vi.fn(async () => state.title),
      textContent: vi.fn(async () => state.bodyText),
      evaluate: vi.fn(async () => state.hasSupabaseAuthStorageKey),
      url: vi.fn().mockImplementation(() => state.finalUrl),
      locator: vi.fn().mockImplementation((selector: string) => {
        if (!locators.has(selector)) {
          locators.set(
            selector,
            createMockLocator(() => state.selectorCounts[selector] ?? 0)
          );
        }
        return locators.get(selector)!;
      }),
      on: vi.fn().mockImplementation((event: 'console' | 'requestfailed' | 'response', handler: unknown) => {
        if (event === 'console') {
          listeners.console.push(handler as (message: { type: () => string; text: () => string }) => void);
        } else if (event === 'requestfailed') {
          listeners.requestfailed.push(handler as typeof listeners.requestfailed[number]);
        } else {
          listeners.response.push(handler as typeof listeners.response[number]);
        }
      }),
      _state: state
    };

    return page;
  }

  function createMockContext() {
    const page = createMockPage();
    return {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
      _page: page
    };
  }

  function createMockBrowser() {
    const context = createMockContext();
    return {
      newContext: vi.fn(async () => context),
      close: vi.fn(async () => undefined),
      _context: context
    };
  }

  const browser = createMockBrowser();
  return { browser, FAKE_PDF_BUFFER };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => mockHolder.browser)
  }
}));

const mockAuthContext = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxOTk5OTk5OTk5fQ.test',
  user: {
    id: 'user-1',
    email: 'test@test.com',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  displayName: 'Test User',
  memberships: [],
  currentTenant: null
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  resetMockPageState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SUPABASE_STORAGE_KEY', () => {
  it('matches the frontend-derived Supabase auth storage key', () => {
    expect(SUPABASE_STORAGE_KEY).toBe(resolveSupabaseAuthStorageKey(env.supabaseUrl));
  });
});

describe('generatePickerSheetPdf', () => {
  function getPage() {
    return mockHolder.browser._context._page as any;
  }

  function configurePage(overrides: Partial<MockPageState> = {}) {
    const state = getPage()._state as MockPageState;
    Object.assign(state, createDefaultMockPageState(), overrides);
    state.selectorCounts = { ...BASE_SELECTOR_COUNTS, ...(overrides.selectorCounts ?? {}) };
    state.responses = overrides.responses ?? [];
    state.failedRequests = overrides.failedRequests ?? [];
    state.consoleMessages = overrides.consoleMessages ?? [];
  }

  it('builds frontend URL with pdfRender=1 for workGroup scope', async () => {
    configurePage({
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 1
      }
    });

    const result = await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'workGroup',
      distributionArea: 'Ч’ЧњЧ™Чњ',
      planningLineName: 'Ч§Ч• 1',
      workGroupName: 'Ч›ЧњЧњЧ™'
    });

    expect(result.equals(mockHolder.FAKE_PDF_BUFFER)).toBe(true);

    const gotoUrl = getPage().goto.mock.calls[0][0] as string;
    expect(gotoUrl).toContain('/operator/manual/print/picker-sheet');
    expect(gotoUrl).toContain('pdfRender=1');
    expect(gotoUrl).toContain('shiftId=shift-1');
    expect(gotoUrl).toContain('scope=workGroup');
    expect(gotoUrl).toContain('workGroupName=');
    expect(gotoUrl).not.toContain(mockAuthContext.accessToken);
    expect(new URL(gotoUrl).searchParams.has('access_token')).toBe(false);
    expect(new URL(gotoUrl).searchParams.has('token')).toBe(false);
  });

  it('injects session into localStorage with the frontend auth storage key and refresh token', async () => {
    configurePage({
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 1
      }
    });

    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'Ч’ЧњЧ™Чњ',
      planningLineName: 'Ч§Ч• 1'
    });

    const script = getPage().addInitScript.mock.calls[0][0] as string;
    expect(script).toContain('localStorage.setItem');
    expect(script).toContain(SUPABASE_STORAGE_KEY);
    expect(script).toContain('refresh_token');
  });

  it('uses A4 format, printBackground, and preferCSSPageSize', async () => {
    configurePage({
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 1
      }
    });

    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'Ч’ЧњЧ™Чњ',
      planningLineName: 'Ч§Ч• 1'
    });

    const pdfOptions = getPage().pdf.mock.calls[0][0];
    expect(pdfOptions).toMatchObject({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });
  });

  it('waits for .print-table before rendering the PDF', async () => {
    configurePage({
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 1
      }
    });

    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'Ч’ЧњЧ™Чњ',
      planningLineName: 'Ч§Ч• 1'
    });

    expect(getPage().waitForSelector).toHaveBeenCalledWith('.print-table', { timeout: 250 });
    expect(getPage().waitForTimeout).not.toHaveBeenCalled();
  });

  it('captures timeout diagnostics with sanitized body text, title, and url', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockImplementationOnce(() => 0).mockImplementationOnce(() => 0).mockImplementation(() => 15001);

    try {
      configurePage({
      bodyText: `Body with access token ${mockAuthContext.accessToken}`,
      title: 'Timeout title',
      finalUrl: 'http://web/operator/manual/print/picker-sheet?shiftId=shift-1&pdfRender=1',
      hasSupabaseAuthStorageKey: true,
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 0
      }
    });

    await expect(
      generatePickerSheetPdf(mockAuthContext, {
        shiftId: 'shift-1',
        scope: 'line',
        distributionArea: 'Ч’ЧњЧ™Чњ',
        planningLineName: 'Ч§Ч• 1'
      })
    ).rejects.toMatchObject({
      statusCode: 504,
      code: 'PDF_PRINT_DOCUMENT_TIMEOUT'
    });

    const logCall = vi.mocked(console.error).mock.calls[0]?.[0] as string;
    expect(logCall).toContain('Timeout title');
    expect(logCall).toContain('/operator/manual/print/picker-sheet');
    expect(logCall).toContain('Body with access token [redacted]');
    expect(logCall).not.toContain(mockAuthContext.accessToken);
    expect(logCall).not.toContain('Authorization');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it.skip('maps /api/me 401 inside Playwright to PDF_RENDER_AUTH_FAILED', async () => {
    configurePage({
      responses: [
        { url: 'http://web/api/me', status: 401 }
      ],
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 0,
        '[data-testid="auth-startup-error"]': 1
      }
    });

    await expect(
      generatePickerSheetPdf(mockAuthContext, {
        shiftId: 'shift-1',
        scope: 'line',
        distributionArea: 'Ч’ЧњЧ™Чњ',
        planningLineName: 'Ч§Ч• 1'
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'PDF_RENDER_AUTH_FAILED'
    });
  });

  it.skip('maps picker-sheet non-2xx inside Playwright to PDF_PRINT_DATA_LOAD_FAILED', async () => {
    configurePage({
      responses: [
        { url: 'http://web/api/me', status: 200 },
        { url: 'http://web/api/manual-shifts/shift-1/print/picker-sheet', status: 500 }
      ],
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 0,
        '[data-testid="print-picker-sheet-error"]': 1
      }
    });

    await expect(
      generatePickerSheetPdf(mockAuthContext, {
        shiftId: 'shift-1',
        scope: 'line',
        distributionArea: 'Ч’ЧњЧ™Чњ',
        planningLineName: 'Ч§Ч• 1'
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'PDF_PRINT_DATA_LOAD_FAILED'
    });
  });

  it('maps /api/me 401 to PDF_RENDER_AUTH_FAILED', () => {
    expect(
      classifyRenderFailure({
        frontendUrl: 'http://web/operator/manual/print/picker-sheet?pdfRender=1',
        finalUrl: 'http://web/operator/manual/print/picker-sheet?pdfRender=1',
        title: 'Picker sheet',
        bodyText: null,
        hasSupabaseAuthStorageKey: true,
        authStartupLoading: null,
        authStartupError: null,
        workspaceAccessError: null,
        protectedRouteLoading: null,
        appRouteError: null,
        printPickerSheetError: null,
        consoleMessages: [],
        failedRequests: [],
        apiStatuses: {
          me: 401,
          pickerSheet: null
        }
      })
    ).toEqual({
      code: 'PDF_RENDER_AUTH_FAILED',
      statusCode: 401,
      message: '/api/me returned 401'
    });
  });

  it('maps picker-sheet non-2xx to PDF_PRINT_DATA_LOAD_FAILED', () => {
    expect(
      classifyRenderFailure({
        frontendUrl: 'http://web/operator/manual/print/picker-sheet?pdfRender=1',
        finalUrl: 'http://web/operator/manual/print/picker-sheet?pdfRender=1',
        title: 'Picker sheet',
        bodyText: null,
        hasSupabaseAuthStorageKey: true,
        authStartupLoading: null,
        authStartupError: null,
        workspaceAccessError: null,
        protectedRouteLoading: null,
        appRouteError: null,
        printPickerSheetError: null,
        consoleMessages: [],
        failedRequests: [],
        apiStatuses: {
          me: 200,
          pickerSheet: 500
        }
      })
    ).toEqual({
      code: 'PDF_PRINT_DATA_LOAD_FAILED',
      statusCode: 502,
      message: '/api/manual-shifts/.../print/picker-sheet returned 500'
    });
  });

  it('closes page, context, and browser on success', async () => {
    configurePage({
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 1
      }
    });

    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'Ч’ЧњЧ™Чњ',
      planningLineName: 'Ч§Ч• 1'
    });

    const page = getPage();
    const context = mockHolder.browser._context;
    expect(page.close).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(mockHolder.browser.close).toHaveBeenCalledOnce();
  });

  it('uses the printRenderFrontendUrl from env as base', async () => {
    configurePage({
      selectorCounts: {
        ...getPage()._state.selectorCounts,
        '.print-table': 1
      }
    });

    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'Ч’ЧњЧ™Чњ',
      planningLineName: 'Ч§Ч• 1'
    });

    const gotoUrl = getPage().goto.mock.calls[0][0] as string;
    expect(gotoUrl).toContain(env.printRenderFrontendUrl.replace(/\/+$/, ''));
  });
});
