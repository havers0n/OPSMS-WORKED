import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManualShiftOrderCheckUnit } from '@wos/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualOrderCheckUnitsPanel } from './manual-order-check-units-panel';

vi.mock('@/shared/api/bff/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function makeCheckUnit(
  unitNumber: number,
  status: ManualShiftOrderCheckUnit['status'],
  overrides: Partial<ManualShiftOrderCheckUnit> = {}
): ManualShiftOrderCheckUnit {
  return {
    id: `cu-${unitNumber}`,
    tenantId: 'tenant-1',
    shiftId: 'shift-1',
    lineId: 'line-1',
    orderId: 'order-1',
    unitNumber,
    status,
    note: null,
    reason: null,
    checkedAt: null,
    returnedAt: null,
    voidedAt: null,
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z',
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type PanelProps = Parameters<typeof ManualOrderCheckUnitsPanel>[0];
function renderPanel(props?: Partial<PanelProps>) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <ManualOrderCheckUnitsPanel orderId="order-1" interactive {...props} />
    </QueryClientProvider>
  );
}

describe('ManualOrderCheckUnitsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders empty state', async () => {
    mockedBffRequest.mockResolvedValue([]);
    renderPanel();
    await waitFor(() => expect(screen.getByText('עדיין לא נוספו יחידות בדיקה')).toBeTruthy());
  });

  it('renders summary and unit list', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'open')]);
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('נבדקו 1 מתוך 2')).toBeTruthy();
      expect(screen.getByTestId('check-units-status-chip')).toBeTruthy();
      expect(screen.getByText('נבדק חלקית')).toBeTruthy();
      expect(screen.getByText('פרטים')).toBeTruthy();
      expect(screen.getByTestId('check-units-list')).toBeTruthy();
      expect(screen.getByText('יחידה #1')).toBeTruthy();
      expect(screen.getByText('יחידה #2')).toBeTruthy();
    });
  });

  it('stage-gating disables actions and shows reason when canInteract=false', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open')]);
    renderPanel({
      canInteract: false,
      disabledReason: 'העבר את ההזמנה לבדיקה כדי להתחיל לבדוק יחידות'
    });

    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());
    expect(screen.getByTestId('check-units-disabled-reason')).toBeTruthy();

    const createButton = screen.getByTestId('create-check-unit') as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);

    const checkButton = screen.getByText('יחידה תקינה') as HTMLButtonElement;
    const returnedButton = screen.getByText('תקלה') as HTMLButtonElement;
    const voidButton = screen.getByText('בטל יחידה') as HTMLButtonElement;
    expect(checkButton.disabled).toBe(true);
    expect(returnedButton.disabled).toBe(true);
    expect(voidButton.disabled).toBe(true);

    fireEvent.click(createButton);
    fireEvent.click(checkButton);
    fireEvent.click(returnedButton);
    fireEvent.click(voidButton);

    expect(
      mockedBffRequest.mock.calls.some(([url, init]) =>
        String(url).includes('/check-units') && (init?.method === 'POST' || init?.method === 'PATCH')
      )
    ).toBe(false);
  });

  it('rapid double click on create triggers one POST while pending', async () => {
    const createPending = deferred<ManualShiftOrderCheckUnit>();

    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'POST') return createPending.promise;
      return [];
    });

    renderPanel();
    await waitFor(() => expect(screen.getByTestId('create-check-unit')).toBeTruthy());

    const createButton = screen.getByTestId('create-check-unit');
    fireEvent.click(createButton);
    fireEvent.click(createButton);

    await waitFor(() => {
      const postCalls = mockedBffRequest.mock.calls.filter(
        ([url, init]) => String(url).includes('/api/manual-shift-orders/order-1/check-units') && init?.method === 'POST'
      );
      expect(postCalls).toHaveLength(1);
    });

    createPending.resolve(makeCheckUnit(1, 'open'));
    await waitFor(() => expect(mockedBffRequest).toHaveBeenCalled());
  });

  it('create button has success cooldown and re-enables after it', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'POST') return makeCheckUnit(1, 'open');
      return [];
    });

    renderPanel();
    await waitFor(() => expect(screen.getByTestId('create-check-unit')).toBeTruthy());
    vi.useFakeTimers();

    const createButton = screen.getByTestId('create-check-unit') as HTMLButtonElement;
    fireEvent.click(createButton);

    await act(async () => {
      await Promise.resolve();
    });
    expect(createButton.disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(801);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(createButton.disabled).toBe(false);
  });

  it('rapid repeated status clicks send one PATCH while pending', async () => {
    const patchPending = deferred<ManualShiftOrderCheckUnit>();

    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [makeCheckUnit(1, 'open')];
      if (path.includes('/api/manual-shift-check-units/cu-1/status') && method === 'PATCH') return patchPending.promise;
      return [];
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('יחידה תקינה')).toBeTruthy());

    const checkButton = screen.getByText('יחידה תקינה');
    fireEvent.click(checkButton);
    fireEvent.click(checkButton);

    await waitFor(() => {
      const patchCalls = mockedBffRequest.mock.calls.filter(
        ([url, init]) => String(url).includes('/api/manual-shift-check-units/cu-1/status') && init?.method === 'PATCH'
      );
      expect(patchCalls).toHaveLength(1);
    });

    patchPending.resolve(makeCheckUnit(1, 'checked'));
    await waitFor(() => expect(mockedBffRequest).toHaveBeenCalled());
  });

  it('voided units show no active actions', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'voided')]);
    renderPanel();
    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());
    expect(screen.queryByText('יחידה תקינה')).toBeNull();
    expect(screen.queryByText('תקלה')).toBeNull();
    expect(screen.queryByText('עוד')).toBeNull();
  });

  it('returned unit can be marked fixed (returned -> checked)', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([makeCheckUnit(1, 'returned')])
      .mockResolvedValueOnce(makeCheckUnit(1, 'checked'));
    renderPanel();

    await waitFor(() => expect(screen.getByText('יחידה תקינה')).toBeTruthy());
    fireEvent.click(screen.getByText('יחידה תקינה'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/cu-1/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'checked', note: undefined, reason: undefined })
      });
    });
  });

  it('returned unit can be reverted (returned -> open) without voiding', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([makeCheckUnit(1, 'returned')])
      .mockResolvedValueOnce(makeCheckUnit(1, 'open'));
    renderPanel();

    await waitFor(() => expect(screen.getByText('עוד')).toBeTruthy());
    fireEvent.click(screen.getByText('עוד'));
    fireEvent.click(screen.getByText('החזר לבדיקה'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/cu-1/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'open', note: undefined, reason: undefined })
      });
    });
  });

  it('returned -> open hides reason after server refresh', async () => {
    let getCallCount = 0;
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') {
        getCallCount += 1;
        if (getCallCount === 1) return [makeCheckUnit(1, 'returned', { reason: 'מוצר פגום' })];
        return [makeCheckUnit(1, 'open', { reason: null })];
      }
      if (path.includes('/api/manual-shift-check-units/cu-1/status') && method === 'PATCH') {
        return makeCheckUnit(1, 'open', { reason: null });
      }
      return [];
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText('סיבת תיקון: מוצר פגום')).toBeTruthy());
    fireEvent.click(screen.getByText('עוד'));
    fireEvent.click(screen.getByText('החזר לבדיקה'));
    await waitFor(() => expect(screen.queryByText('סיבת תיקון: מוצר פגום')).toBeNull());
  });

  it('returned state does not expose all actions simultaneously', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'returned', { reason: 'כמות לא נכונה' })]);
    renderPanel();

    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());
    expect(screen.queryByText('צור השלמה')).toBeNull();
    expect(screen.getByText('יחידה תקינה')).toBeTruthy();
    fireEvent.click(screen.getByText('עוד'));
    expect(screen.getByText('החזר לבדיקה')).toBeTruthy();
    expect(screen.getByText('בטל יחידה')).toBeTruthy();
    expect(screen.getAllByText('דורש תיקון').length).toBeGreaterThan(0);
  });

  it('returned unit displays repair reason when available', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'returned', { reason: 'מוצר פגום' })]);
    renderPanel();
    await waitFor(() => expect(screen.getByText('סיבת תיקון: מוצר פגום')).toBeTruthy());
  });

  it('returned unit with open completion shows compact next-step instruction', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') {
        return [makeCheckUnit(1, 'returned', { reason: 'חסר מוצר' })];
      }
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') {
        return [
          {
            id: 'ash-1',
            tenantId: 'tenant-1',
            shiftId: 'shift-1',
            lineId: 'line-1',
            orderId: 'order-1',
            checkUnitId: 'cu-1',
            source: 'check_unit',
            status: 'open',
            text: 'להשלים מוצר חסר',
            createdAt: '2026-05-29T09:00:00.000Z',
            updatedAt: '2026-05-29T09:00:00.000Z'
          }
        ];
      }
      return [];
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());
    expect(screen.getByText('יש השלמה פתוחה. השלם ואז סמן יחידה תקינה')).toBeTruthy();
  });

  it('marking unit as returned exposes reason flow and requires reason selection', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([makeCheckUnit(1, 'open')])
      .mockResolvedValueOnce(makeCheckUnit(1, 'returned', { reason: 'חסר מוצר' }));
    renderPanel();

    await waitFor(() => expect(screen.getByText('תקלה')).toBeTruthy());
    fireEvent.click(screen.getByText('תקלה'));
    expect(screen.getByTestId('returned-reason-selector-cu-1')).toBeTruthy();

    const submitReturned = screen.getByText('שמור תיקון') as HTMLButtonElement;
    expect(submitReturned.disabled).toBe(true);
    fireEvent.click(screen.getByText('חסר מוצר'));
    expect(submitReturned.disabled).toBe(false);
    fireEvent.click(submitReturned);

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/cu-1/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'returned', note: undefined, reason: 'חסר מוצר' })
      });
    });
  });

  it('create completion appears only for missing-product returned unit', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') {
        return [makeCheckUnit(1, 'returned', { reason: 'כמות לא נכונה' }), makeCheckUnit(2, 'returned', { reason: 'חסר מוצר' })];
      }
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') return [];
      return [];
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());
    expect(screen.queryByTestId('create-completion-cu-1')).toBeNull();
    expect(screen.getByTestId('create-completion-cu-2')).toBeTruthy();
  });

  it('create completion requires non-empty text and posts ashlama', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [makeCheckUnit(1, 'returned', { reason: 'חסר מוצר' })];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'POST') {
        return {
          id: 'ash-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: 'cu-1',
          source: 'check_unit',
          status: 'open',
          text: 'להשלים מוצר חסר',
          createdAt: '2026-05-29T09:00:00.000Z',
          updatedAt: '2026-05-29T09:00:00.000Z'
        };
      }
      return [];
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText('צור השלמה')).toBeTruthy());

    fireEvent.click(screen.getByText('צור השלמה'));
    const dialog = screen.getByTestId('ashlama-dialog');
    const confirm = dialog.querySelector('button.bg-blue-600') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(dialog.querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'להשלים מוצר חסר' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/order-1/ashlamot', {
        method: 'POST',
        body: JSON.stringify({ checkUnitId: 'cu-1', text: 'להשלים מוצר חסר' })
      })
    );
  });

  it('shows returned chip and keeps voided excluded from active count', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'returned'), makeCheckUnit(3, 'voided')]);
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('נבדקו 1 מתוך 2')).toBeTruthy();
      expect(screen.getByTestId('check-units-status-chip').textContent).toBe('דורש תיקון');
    });
  });

  it('empty completion block is hidden when no completions exist', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [makeCheckUnit(1, 'checked')];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') return [];
      return [];
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());
    expect(screen.queryByTestId('order-ashlamot-section')).toBeNull();
  });

  it('no-units state shows dominant add button and no metrics', async () => {
    mockedBffRequest.mockResolvedValue([]);
    renderPanel();
    await waitFor(() => expect(screen.getByText('עדיין לא נוספו יחידות בדיקה')).toBeTruthy());
    const addButton = screen.getByTestId('create-check-unit');
    expect(addButton.className).toContain('bg-blue-600');
    expect(screen.queryByTestId('check-units-summary')).toBeNull();
    expect(screen.queryByTestId('check-units-details')).toBeNull();
  });
});

