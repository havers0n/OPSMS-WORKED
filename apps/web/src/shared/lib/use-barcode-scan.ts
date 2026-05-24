import { useEffect, useRef } from 'react';

/**
 * Detects barcode scanner input.
 *
 * Barcode scanners act as HID keyboards and emit all characters of a barcode
 * very rapidly (< 30 ms between keystrokes), then send Enter. Human typing
 * is much slower (> 80 ms between keystrokes on average).
 *
 * The hook listens at window level. To avoid conflicting with normal form
 * input, it only fires when the current focus is NOT inside an input,
 * textarea, or select element.
 *
 * Usage:
 *   useBarcodeScan((barcode) => { ... });
 *
 * The callback is called with the accumulated string when Enter is received
 * after rapid input. The callback ref is stable — no need to memoize.
 */

const SCAN_SPEED_THRESHOLD_MS = 50;  // keystrokes faster than this = scanner
const FLUSH_TIMEOUT_MS = 200;         // clear buffer if no key within this window
const MIN_BARCODE_LENGTH = 3;         // ignore very short accidental triggers

export function useBarcodeScan(onScan: (barcode: string) => void): void {
  // Keep callback in a ref so the effect never needs to re-run
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    function clearBuffer() {
      buffer = '';
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when user is actively typing in a form field.
      // Scanners should be triggered by pointing the gun at the screen
      // while focus is on the page (not inside an input).
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          clearBuffer();
          return;
        }
      }

      const now = Date.now();
      const gap = now - lastKeyTime;
      lastKeyTime = now;

      // Enter = end of barcode sequence
      if (e.key === 'Enter') {
        const captured = buffer;
        clearBuffer();
        if (captured.length >= MIN_BARCODE_LENGTH) {
          onScanRef.current(captured);
        }
        return;
      }

      // If the gap between keystrokes is too large, this is probably human
      // typing leaking into the buffer — reset and start fresh.
      if (gap > SCAN_SPEED_THRESHOLD_MS * 3 && buffer.length > 0) {
        buffer = '';
      }

      // Accumulate printable characters only
      if (e.key.length === 1) {
        buffer += e.key;
      }

      // Auto-flush in case the scanner doesn't send Enter
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(clearBuffer, FLUSH_TIMEOUT_MS);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, []); // stable — onScanRef handles callback updates
}
