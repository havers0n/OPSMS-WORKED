import { supabase } from '@/shared/api/supabase/client';
import { env } from '@/shared/config/env';

type BffErrorBody = {
  code?: string;
  message?: string;
  details?: unknown;
  requestId?: string;
  errorId?: string;
};

export class BffRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
    public readonly requestId: string | null,
    public readonly errorId: string | null,
    public readonly details: unknown = null
  ) {
    super(message);
  }
}

async function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (init?.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return headers;
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return contentType ? /\bapplication\/json\b|\+json\b/i.test(contentType) : false;
}

async function readJsonBody<T>(response: Response): Promise<T | undefined> {
  if (response.status === 204 || !isJsonResponse(response)) {
    return undefined;
  }

  const body = await response.text();
  if (!body.trim()) {
    return undefined;
  }

  return JSON.parse(body) as T;
}

export function resolveBffUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${normalizedBase}${normalizedPath.slice(4)}`;
  }

  return `${normalizedBase}${normalizedPath}`;
}

export async function bffRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await buildHeaders(init);
  const response = await fetch(resolveBffUrl(env.bffUrl, path), {
    ...init,
    headers
  });

  if (!response.ok) {
    const errorBody = (await readJsonBody<BffErrorBody>(response).catch(() => null)) ?? null;
    const requestId = errorBody?.requestId ?? response.headers.get('x-request-id');
    const errorId = errorBody?.errorId ?? null;
    const message =
      errorBody?.message ??
      `BFF request failed with status ${response.status}${requestId ? ` [request ${requestId}]` : ''}${errorId ? ` [error ${errorId}]` : ''}`;

    throw new BffRequestError(response.status, errorBody?.code ?? null, message, requestId, errorId, errorBody?.details ?? null);
  }

  return (await readJsonBody<T>(response)) as T;
}
