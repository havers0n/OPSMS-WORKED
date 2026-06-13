import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toBuffer } = vi.hoisted(() => ({
  toBuffer: vi.fn()
}));

vi.mock('bwip-js', () => ({
  default: {
    toBuffer
  }
}));

import { renderCode128Png } from './pdf.js';

describe('warehouse label barcode rendering', () => {
  beforeEach(() => {
    toBuffer.mockReset();
  });

  it('returns PNG bytes for a valid Code 128 value', async () => {
    const pngBytes = Buffer.from([1, 2, 3, 4]);
    toBuffer.mockResolvedValue(pngBytes);

    const result = await renderCode128Png('03-A.02.03.04');

    expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(toBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        bcid: 'code128',
        text: '03-A.02.03.04',
        includetext: false
      })
    );
  });

  it('rejects an empty barcode value', async () => {
    await expect(renderCode128Png('   ')).rejects.toMatchObject({
      statusCode: 422,
      code: 'WAREHOUSE_LABEL_BARCODE_VALUE_REQUIRED'
    });
  });

  it('wraps library failures in a stable rendering error', async () => {
    toBuffer.mockRejectedValue(new Error('library failed'));

    await expect(renderCode128Png('03-A.02.03.04')).rejects.toMatchObject({
      statusCode: 500,
      code: 'WAREHOUSE_LABEL_BARCODE_RENDER_FAILED'
    });
  });
});
