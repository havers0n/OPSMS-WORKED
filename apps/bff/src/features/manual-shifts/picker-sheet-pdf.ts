import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { env } from '../../env.js';
import type { AuthenticatedRequestContext } from '../../auth.js';

export const SUPABASE_STORAGE_KEY = 'supabase.auth.token';

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

export async function generatePickerSheetPdf(
  auth: AuthenticatedRequestContext,
  params: PickerSheetPdfParams
): Promise<Buffer> {
  const frontendUrl = buildFrontendUrl(params);
  const sessionPayload = buildSessionPayload(auth);
  const initScript = buildAddInitScriptContent(SUPABASE_STORAGE_KEY, sessionPayload);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch();
    context = await browser.newContext();
    page = await context.newPage();

    await page.addInitScript(initScript);

    await page.goto(frontendUrl, { waitUntil: 'networkidle' });

    await page.waitForSelector('.print-table', { timeout: 15000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
