import { supabase } from '@/shared/api/supabase/client';
import { env } from '@/shared/config/env';

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
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? `BFF request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
