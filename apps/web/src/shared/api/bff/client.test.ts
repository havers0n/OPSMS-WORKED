import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffRequest, resolveBffUrl, type BffRequestError } from './client';

const supabaseAuth = vi.hoisted(() => ({
  getSession: vi.fn()
}));

vi.mock('@/shared/api/supabase/client', () => ({
  supabase: {
    auth: supabaseAuth
  }
}));

vi.mock('@/shared/config/env', () => ({
  env: {
    bffUrl: '/api'
  }
}));

beforeEach(() => {
  supabaseAuth.getSession.mockResolvedValue({
    data: {
      session: null
    }
  });
  vi.stubGlobal('fetch', vi.fn());
});

describe('resolveBffUrl', () => {
  it('keeps a single /api prefix when both baseUrl and path include it', () => {
    expect(resolveBffUrl('/api', '/api/rack-sections/123/slots/3/storage')).toBe(
      '/api/rack-sections/123/slots/3/storage'
    );
  });

  it('joins regular relative BFF paths', () => {
    expect(resolveBffUrl('/api', '/sites')).toBe('/api/sites');
  });

  it('passes through absolute urls unchanged', () => {
    expect(resolveBffUrl('/api', 'http://127.0.0.1:8787/api/sites')).toBe(
      'http://127.0.0.1:8787/api/sites'
    );
  });
});

describe('bffRequest', () => {
  it('returns undefined for 204 No Content responses', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(bffRequest<void>('/empty')).resolves.toBeUndefined();
  });

  it('returns undefined for empty JSON response bodies', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    await expect(bffRequest<void>('/empty')).resolves.toBeUndefined();
  });

  it('parses JSON only when the response content type is JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8'
        }
      })
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('not json', {
        status: 200,
        headers: {
          'content-type': 'text/plain'
        }
      })
    );

    await expect(bffRequest<{ ok: boolean }>('/json')).resolves.toEqual({ ok: true });
    await expect(bffRequest<void>('/text')).resolves.toBeUndefined();
  });

  it('does not force a JSON content type for FormData bodies', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const body = new FormData();
    body.set('file', new Blob(['test']), 'test.txt');

    await bffRequest<void>('/upload', {
      method: 'POST',
      body
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get('content-type')).toBeNull();
  });



  it('forwards AbortSignal to fetch', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const controller = new AbortController();
    await bffRequest<void>('/abortable', { signal: controller.signal });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.signal).toBe(controller.signal);
  });

  it('creates a timeout-backed abort signal when timeoutMs is provided', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await bffRequest<void>('/with-timeout', { timeoutMs: 50 });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses fallback error details when the error response has no JSON body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 500,
        headers: {
          'x-request-id': 'request-1'
        }
      })
    );

    const expectedError: Partial<BffRequestError> = {
      status: 500,
      code: null,
      message: 'BFF request failed with status 500 [request request-1]',
      requestId: 'request-1',
      errorId: null,
      details: null
    };

    await expect(bffRequest<void>('/broken')).rejects.toMatchObject(expectedError);
  });
});
