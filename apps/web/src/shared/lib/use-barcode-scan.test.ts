// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useBarcodeScan } from './use-barcode-scan';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fireKey(key: string, target: EventTarget = window) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
}

/** Simulate a barcode scanner firing characters fast then Enter */
function scanBarcode(barcode: string, target: EventTarget = window) {
  for (const ch of barcode) {
    fireKey(ch, target);
  }
  fireKey('Enter', target);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useBarcodeScan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onScan with the accumulated barcode on Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScan(onScan));

    scanBarcode('SKU-001');

    expect(onScan).toHaveBeenCalledOnce();
    expect(onScan).toHaveBeenCalledWith('SKU-001');
  });

  it('ignores barcodes shorter than the minimum length', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScan(onScan));

    scanBarcode('AB'); // only 2 chars — below MIN_BARCODE_LENGTH

    expect(onScan).not.toHaveBeenCalled();
  });

  it('resets the buffer after the flush timeout with no Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScan(onScan));

    // Type some chars but never send Enter
    for (const ch of 'PARTIAL') {
      fireKey(ch);
    }

    // Advance past the flush timeout
    vi.advanceTimersByTime(300);

    // Now send a fresh barcode — the old buffer should be gone
    scanBarcode('FRESH-1');

    expect(onScan).toHaveBeenCalledOnce();
    expect(onScan).toHaveBeenCalledWith('FRESH-1');
  });

  it('does not fire when Enter is pressed with an empty buffer', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScan(onScan));

    fireKey('Enter');

    expect(onScan).not.toHaveBeenCalled();
  });

  it('removes the event listener on unmount', () => {
    const onScan = vi.fn();
    const { unmount } = renderHook(() => useBarcodeScan(onScan));

    unmount();

    scanBarcode('AFTER-UNMOUNT');

    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores input when focus is on an input element', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScan(onScan));

    // Create a real input and dispatch events targeting it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    scanBarcode('BARCODE-123', input);

    document.body.removeChild(input);

    expect(onScan).not.toHaveBeenCalled();
  });
});
