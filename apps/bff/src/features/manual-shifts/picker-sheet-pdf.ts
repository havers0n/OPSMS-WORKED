import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { resolveSupabaseAuthStorageKey } from '@wos/domain';
import { env } from '../../env.js';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';

export const SUPABASE_STORAGE_KEY = resolveSupabaseAuthStorageKey(env.supabaseUrl);

export type PickerSheetPdfParams = {
  shiftId: string;
  scope: 'line' | 'workGroup';
  distributionArea: string;
  planningLineName: string;
  workGroupName?: string;
};

function buildFrontendUrl(params: PickerSheetPdfParams): string {
  const urlParams = new URLSearchParams({
    shiftId: params.shiftId,
    scope: params.scope,
    distributionArea: params.distributionArea,
    planningLineName: params.planningLineName,
    pdfRender: '1',
  });
  if (params.scope === 'workGroup' && params.workGroupName) {
    urlParams.set('workGroupName', params.workGroupName);
  }
  const base = env.printRenderFrontendUrl.replace(/\/+$/, '');
  return `${base}/operator/manual/print/picker-sheet?${urlParams.toString()}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    return typeof decoded === 'object' && decoded !== null ? decoded : null;
  } catch {
    return null;
  }
}

function buildSessionPayload(auth: AuthenticatedRequestContext): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    access_token: auth.accessToken,
    refresh_token: auth.accessToken,
    token_type: 'bearer',
    user: auth.user,
  };

  const jwt = decodeJwtPayload(auth.accessToken);
  if (jwt && typeof jwt.exp === 'number') {
    payload.expires_at = jwt.exp;
    payload.expires_in = Math.max(0, jwt.exp - Math.floor(Date.now() / 1000));
  } else {
    const future = Math.floor(Date.now() / 1000) + 3600;
    payload.expires_at = future;
    payload.expires_in = 3600;
  }

  return payload;
}

function buildAddInitScriptContent(storageKey: string, sessionPayload: Record<string, unknown>): string {
  const keyArg = JSON.stringify(storageKey);
  const valueArg = JSON.stringify(JSON.stringify(sessionPayload));
  return `window.localStorage.setItem(${keyArg}, ${valueArg});`;
}

type RenderConsoleMessage = {
  type: 'warning' | 'error';
  text: string;
};

type FailedRenderRequest = {
  method: string;
  pathname: string;
  failure: string;
};

type PickerSheetRenderDiagnostics = {
  frontendUrl: string;
  finalUrl: string | null;
  title: string | null;
  bodyText: string | null;
  hasSupabaseAuthStorageKey: boolean | null;
  authStartupLoading: boolean | null;
  authStartupError: boolean | null;
  workspaceAccessError: boolean | null;
  protectedRouteLoading: boolean | null;
  appRouteError: boolean | null;
  printPickerSheetError: boolean | null;
  consoleMessages: RenderConsoleMessage[];
  failedRequests: FailedRenderRequest[];
  apiStatuses: {
    me: number | null;
    pickerSheet: number | null;
  };
};

function normalizeDiagnosticText(text: string, accessToken: string): string {
  const sanitized = accessToken ? text.replaceAll(accessToken, '[redacted]') : text;
  return sanitized.replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function safePathname(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function createPickerSheetDiagnostics(frontendUrl: string): PickerSheetRenderDiagnostics {
  return {
    frontendUrl,
    finalUrl: null,
    title: null,
    bodyText: null,
    hasSupabaseAuthStorageKey: null,
    authStartupLoading: null,
    authStartupError: null,
    workspaceAccessError: null,
    protectedRouteLoading: null,
    appRouteError: null,
    printPickerSheetError: null,
    consoleMessages: [],
    failedRequests: [],
    apiStatuses: {
      me: null,
      pickerSheet: null
    }
  };
}

function logPickerSheetDiagnostics(stage: string, diagnostics: PickerSheetRenderDiagnostics) {
  console.error(
    JSON.stringify(
      {
        stage,
        ...diagnostics
      },
      null,
      2
    )
  );
}

async function capturePageDiagnostics(
  page: Page,
  diagnostics: PickerSheetRenderDiagnostics,
  accessToken: string
): Promise<PickerSheetRenderDiagnostics> {
  const hasSelector = async (selector: string) =>
    await Promise.resolve(page.waitForSelector(selector, { timeout: 0 }))
      .then(() => true)
      .catch(() => false);

  diagnostics.finalUrl = page.url();
  diagnostics.title = await page.title().catch(() => null);
  diagnostics.bodyText = await page
    .textContent('body')
    .then((value) => (value ? truncateText(normalizeDiagnosticText(value, accessToken), 1000) : null))
    .catch(() => null);
  diagnostics.authStartupLoading = await hasSelector('[data-testid="auth-startup-loading"]');
  diagnostics.authStartupError = await hasSelector('[data-testid="auth-startup-error"]');
  diagnostics.workspaceAccessError = await hasSelector('[data-testid="workspace-access-error"]');
  diagnostics.protectedRouteLoading = await hasSelector('[data-testid="protected-route-loading"]');
  diagnostics.appRouteError = await hasSelector('[data-testid="app-route-error"]');
  diagnostics.printPickerSheetError = await hasSelector('[data-testid="print-picker-sheet-error"]');
  diagnostics.hasSupabaseAuthStorageKey = await page
    .evaluate(
      (storageKey) => {
        const storage = (globalThis as typeof globalThis & {
          localStorage?: { getItem(key: string): string | null };
        }).localStorage;
        return storage?.getItem(storageKey) !== null;
      },
      SUPABASE_STORAGE_KEY
    )
    .catch(() => null);
  return diagnostics;
}

type PickerSheetRenderFailure =
  | { code: 'PDF_RENDER_AUTH_FAILED'; statusCode: 401 | 502; message: string }
  | { code: 'PDF_PRINT_DATA_LOAD_FAILED'; statusCode: 502; message: string }
  | { code: 'PDF_PRINT_PAGE_ERROR'; statusCode: 500; message: string };

export function classifyRenderFailure(
  diagnostics: PickerSheetRenderDiagnostics
): PickerSheetRenderFailure | null {
  const meStatus = diagnostics.apiStatuses.me;
  if (meStatus !== null && meStatus >= 400) {
    return {
      code: 'PDF_RENDER_AUTH_FAILED',
      statusCode: meStatus === 401 ? 401 : 502,
      message: `/api/me returned ${meStatus}`
    };
  }

  const pickerSheetStatus = diagnostics.apiStatuses.pickerSheet;
  if (pickerSheetStatus !== null && pickerSheetStatus >= 400) {
    return {
      code: 'PDF_PRINT_DATA_LOAD_FAILED',
      statusCode: 502,
      message: `/api/manual-shifts/.../print/picker-sheet returned ${pickerSheetStatus}`
    };
  }

  const finalUrl = diagnostics.finalUrl ?? '';
  const bodyText = diagnostics.bodyText ?? '';
  const title = diagnostics.title ?? '';

  if (
    finalUrl.includes('/login') ||
    diagnostics.authStartupLoading === true ||
    diagnostics.authStartupError === true ||
    diagnostics.workspaceAccessError === true ||
    diagnostics.protectedRouteLoading === true ||
    diagnostics.hasSupabaseAuthStorageKey === false
  ) {
    return {
      code: 'PDF_RENDER_AUTH_FAILED',
      statusCode: 502,
      message: 'Render finished on an auth/login state'
    };
  }

  if (diagnostics.appRouteError === true || bodyText.includes('This screen crashed') || title.includes('This screen crashed')) {
    return {
      code: 'PDF_PRINT_PAGE_ERROR',
      statusCode: 500,
      message: 'Render finished on a runtime error state'
    };
  }

  if (diagnostics.printPickerSheetError === true) {
    return {
      code: 'PDF_PRINT_PAGE_ERROR',
      statusCode: 500,
      message: 'Render finished on an error state'
    };
  }

  return null;
}

async function waitForPickerSheetRenderState(
  page: Page,
  diagnostics: PickerSheetRenderDiagnostics,
  accessToken: string,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const tableReady = await Promise.resolve(
      page.waitForSelector('.print-table', { timeout: 250 })
    )
      .then(() => true)
      .catch(() => false);
    if (tableReady) {
      return;
    }

    const failure = classifyRenderFailure(diagnostics);
    if (failure) {
      logPickerSheetDiagnostics(failure.code, await capturePageDiagnostics(page, diagnostics, accessToken));
      throw new ApiError(failure.statusCode, failure.code, failure.message);
    }

    await page.waitForTimeout(250);
  }

  const updatedDiagnostics = await capturePageDiagnostics(page, diagnostics, accessToken);
  const failure = classifyRenderFailure(updatedDiagnostics);
  if (failure) {
    logPickerSheetDiagnostics(failure.code, updatedDiagnostics);
    throw new ApiError(failure.statusCode, failure.code, failure.message);
  }

  logPickerSheetDiagnostics('PDF_PRINT_DOCUMENT_TIMEOUT', updatedDiagnostics);
  throw new ApiError(
    504,
    'PDF_PRINT_DOCUMENT_TIMEOUT',
    'Print document table did not appear before timeout.'
  );
}

export async function generatePickerSheetPdf(
  auth: AuthenticatedRequestContext,
  params: PickerSheetPdfParams
): Promise<Buffer> {
  const frontendUrl = buildFrontendUrl(params);
  const sessionPayload = buildSessionPayload(auth);
  const initScript = buildAddInitScriptContent(SUPABASE_STORAGE_KEY, sessionPayload);
  const diagnostics = createPickerSheetDiagnostics(frontendUrl);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await Promise.resolve(
      chromium.launch({ args: ['--no-sandbox'] })
    )
      .catch((err: unknown) => {
        throw new ApiError(
          502,
          'PDF_BROWSER_LAUNCH_FAILED',
          `Failed to launch Chromium: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    context = await browser.newContext();
    page = await context.newPage();

    page.on('console', (message) => {
      const type = message.type();
      if (type !== 'warning' && type !== 'error') {
        return;
      }

      diagnostics.consoleMessages.push({
        type: type as 'warning' | 'error',
        text: normalizeDiagnosticText(message.text(), auth.accessToken)
      });
    });

    page.on('requestfailed', (request) => {
      diagnostics.failedRequests.push({
        method: request.method(),
        pathname: safePathname(request.url()),
        failure: request.failure()?.errorText ?? 'unknown'
      });
    });

    page.on('response', (response) => {
      const pathname = safePathname(response.url());
      if (pathname === '/api/me') {
        diagnostics.apiStatuses.me = response.status();
      }

      if (pathname.includes('/api/manual-shifts/') && pathname.endsWith('/print/picker-sheet')) {
        diagnostics.apiStatuses.pickerSheet = response.status();
      }
    });

    await page.addInitScript(initScript);

    await Promise.resolve(page.goto(frontendUrl, { waitUntil: 'networkidle' })).catch((err: unknown) => {
      throw new ApiError(
        502,
        'PDF_FRONTEND_UNREACHABLE',
        `Frontend page did not load: ${err instanceof Error ? err.message : String(err)}`
      );
    });

    diagnostics.hasSupabaseAuthStorageKey = await page
      .evaluate(
        (storageKey) => {
          const storage = (globalThis as typeof globalThis & {
            localStorage?: { getItem(key: string): string | null };
          }).localStorage;
          return storage?.getItem(storageKey) !== null;
        },
        SUPABASE_STORAGE_KEY
      )
      .catch(() => null);

    await waitForPickerSheetRenderState(page, diagnostics, auth.accessToken, 15000);

    const pdf = await Promise.resolve(
      page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      })
    ).catch((err: unknown) => {
      throw new ApiError(
        500,
        'PDF_RENDER_FAILED',
        `PDF rendering failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });

    return Buffer.from(pdf);
  } finally {
    if (page) await Promise.resolve(page.close()).catch(() => {});
    if (context) await Promise.resolve(context.close()).catch(() => {});
    if (browser) await Promise.resolve(browser.close()).catch(() => {});
  }
}
