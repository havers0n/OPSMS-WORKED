import { supabase } from '@/shared/api/supabase/client';
import { env } from '@/shared/config/env';

type BffErrorBody = {
  code?: string;
  message?: string;
  requestId?: string;
  errorId?: string;
};

export class BffRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
    public readonly requestId: string | null,
    public readonly errorId: string | null
  ) {
    super(message);
  }
}

async function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (init?.body !== undefined) {
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

export async function bffRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await buildHeaders(init);
  const response = await fetch(`${env.bffUrl}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as BffErrorBody | null;
    const requestId = errorBody?.requestId ?? response.headers.get('x-request-id');
    const errorId = errorBody?.errorId ?? null;
    const message =
      errorBody?.message ??
      `BFF request failed with status ${response.status}${requestId ? ` [request ${requestId}]` : ''}${errorId ? ` [error ${errorId}]` : ''}`;

    throw new BffRequestError(response.status, errorBody?.code ?? null, message, requestId, errorId);
  }

  return (await response.json()) as T;
}
