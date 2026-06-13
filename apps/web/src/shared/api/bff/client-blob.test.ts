import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffRequestBlob, type BffBlobDownload } from './client';

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

describe('bffRequestBlob', () => {
  it('returns blob and filename from Content-Disposition', async () => {
    const pdfBlob = new Blob(['fake-pdf-content'], { type: 'application/pdf' });
    vi.mocked(fetch).mockResolvedValue(
      new Response(pdfBlob, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="warehouse-labels-f3000000-0000-4000-8000-000000000003.pdf"'
        }
      })
    );

    const result: BffBlobDownload = await bffRequestBlob('/api/warehouse-labels/pdf', {
      method: 'POST',
      body: JSON.stringify({ floorId: 'f3000000-0000-4000-8000-000000000003' })
    });

    expect(result.filename).toBe('warehouse-labels-f3000000-0000-4000-8000-000000000003.pdf');
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe('application/pdf');
  });

  it('uses fallback filename when Content-Disposition is absent', async () => {
    const pdfBlob = new Blob(['fake-pdf-content'], { type: 'application/pdf' });
    vi.mocked(fetch).mockResolvedValue(
      new Response(pdfBlob, {
        status: 200,
        headers: {
          'content-type': 'application/pdf'
        }
      })
    );

    const result: BffBlobDownload = await bffRequestBlob('/api/warehouse-labels/pdf', {
      method: 'POST',
      body: JSON.stringify({ floorId: 'f3000000-0000-4000-8000-000000000003' })
    });

    expect(result.filename).toBe('warehouse-labels.pdf');
  });

  it('throws BffRequestError for JSON error response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'WORKSPACE_UNAVAILABLE',
          message: 'Warehouse labels are unavailable without an active workspace.'
        }),
        {
          status: 403,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    await expect(
      bffRequestBlob('/api/warehouse-labels/pdf', {
        method: 'POST',
        body: JSON.stringify({})
      })
    ).rejects.toThrow('Warehouse labels are unavailable without an active workspace.');
  });

  it('throws BffRequestError for non-JSON error response without body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 500,
        headers: {}
      })
    );

    await expect(
      bffRequestBlob('/api/warehouse-labels/pdf', {
        method: 'POST',
        body: JSON.stringify({})
      })
    ).rejects.toThrow('BFF request failed with status 500');
  });

  it('includes plain text error body in the error message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html><body>502 Gateway Timeout</body></html>', {
        status: 502,
        headers: {
          'content-type': 'text/html'
        }
      })
    );

    await expect(
      bffRequestBlob('/api/warehouse-labels/pdf', {
        method: 'POST',
        body: JSON.stringify({})
      })
    ).rejects.toThrow('BFF request failed with status 502: <html><body>502 Gateway Timeout</body></html>');
  });

  it('truncates long non-JSON error bodies', async () => {
    const longMessage = 'x'.repeat(1000);
    vi.mocked(fetch).mockResolvedValue(
      new Response(longMessage, {
        status: 502,
        headers: {
          'content-type': 'text/plain'
        }
      })
    );

    await expect(
      bffRequestBlob('/api/warehouse-labels/pdf', {
        method: 'POST',
        body: JSON.stringify({})
      })
    ).rejects.toThrow(/^BFF request failed with status 502: x{200}\.{3}$/);
  });
});