import { describe, expect, it } from 'vitest';
import { resolveBffUrl } from './client';

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
