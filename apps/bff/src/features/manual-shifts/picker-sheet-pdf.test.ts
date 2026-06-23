import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPABASE_STORAGE_KEY, generatePickerSheetPdf } from './picker-sheet-pdf.js';
import { env } from '../../env.js';

const mockHolder = vi.hoisted(() => {
  const FAKE_PDF_BUFFER = Buffer.from('fake-pdf-data');

  function createMockPage() {
    return {
      addInitScript: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(FAKE_PDF_BUFFER),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createMockContext() {
    const page = createMockPage();
    return {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockResolvedValue(undefined),
      _page: page,
    };
  }

  function createMockBrowser() {
    const context = createMockContext();
    return {
      newContext: vi.fn().mockResolvedValue(context),
      close: vi.fn().mockResolvedValue(undefined),
      _context: context,
    };
  }

  const browser = createMockBrowser();
  return { browser, createMockPage, createMockContext, FAKE_PDF_BUFFER };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockHolder.browser),
  },
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
    created_at: '2026-01-01T00:00:00.000Z',
  },
  displayName: 'Test User',
  memberships: [],
  currentTenant: null,
};

describe('SUPABASE_STORAGE_KEY', () => {
  it('matches the @supabase/auth-js default', () => {
    expect(SUPABASE_STORAGE_KEY).toBe('supabase.auth.token');
  });
});

describe('generatePickerSheetPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getPage() {
    return mockHolder.browser._context._page;
  }

  it('builds frontend URL with pdfRender=1 for workGroup scope', async () => {
    const result = await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'workGroup',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
      workGroupName: 'כללי',
    });

    expect(result.equals(mockHolder.FAKE_PDF_BUFFER)).toBe(true);

    const gotoUrl = getPage().goto.mock.calls[0][0] as string;
    expect(gotoUrl).toContain('/operator/manual/print/picker-sheet');
    expect(gotoUrl).toContain('pdfRender=1');
    expect(gotoUrl).toContain('shiftId=shift-1');
    expect(gotoUrl).toContain('scope=workGroup');
    expect(gotoUrl).toContain('workGroupName=%D7%9B%D7%9C%D7%9C%D7%99');
  });

  it('omits workGroupName from URL for line scope', async () => {
    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    });

    const gotoUrl = getPage().goto.mock.calls[0][0] as string;
    expect(gotoUrl).toContain('scope=line');
    expect(gotoUrl).not.toContain('workGroupName');
  });

  it('injects session into localStorage with correct key', async () => {
    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    });

    const script = getPage().addInitScript.mock.calls[0][0] as string;
    expect(script).toContain('localStorage.setItem');
    expect(script).toContain(SUPABASE_STORAGE_KEY);
  });

  it('includes the authenticated access token in the injected session', async () => {
    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    });

    const script = getPage().addInitScript.mock.calls[0][0] as string;
    expect(script).toContain(mockAuthContext.accessToken);
  });

  it('uses A4 format, printBackground, preferCSSPageSize', async () => {
    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    });

    const pdfOptions = getPage().pdf.mock.calls[0][0];
    expect(pdfOptions).toMatchObject({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
  });

  it('waits for .print-table selector', async () => {
    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    });

    expect(getPage().waitForSelector).toHaveBeenCalledWith('.print-table', { timeout: 15000 });
    expect(getPage().waitForSelector).toHaveBeenCalledTimes(1);
  });

  it('navigates with networkidle', async () => {
    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    });

    expect(getPage().goto).toHaveBeenCalledWith(
      expect.stringContaining('/operator/manual/print/picker-sheet'),
      { waitUntil: 'networkidle' }
    );
  });

  it('closes page, context and browser on success', async () => {
    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    });

    const page = getPage();
    const context = mockHolder.browser._context;
    expect(page.close).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(mockHolder.browser.close).toHaveBeenCalledOnce();
  });

  it('closes page, context and browser on error', async () => {
    const page = getPage();
    page.waitForSelector.mockRejectedValueOnce(new Error('timeout'));

    await expect(generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    })).rejects.toThrow('timeout');

    expect(page.close).toHaveBeenCalledOnce();
    expect(mockHolder.browser._context.close).toHaveBeenCalledOnce();
    expect(mockHolder.browser.close).toHaveBeenCalledOnce();
  });

  it('uses the printRenderFrontendUrl from env as base', async () => {
    await generatePickerSheetPdf(mockAuthContext, {
      shiftId: 'shift-1',
      scope: 'line',
      distributionArea: 'גליל',
      planningLineName: 'קו 1',
    });

    const gotoUrl = getPage().goto.mock.calls[0][0] as string;
    expect(gotoUrl).toContain(env.printRenderFrontendUrl.replace(/\/+$/, ''));
  });
});
