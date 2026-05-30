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
    await waitFor(() => expect(screen.getByText('עדיין לא נוספו משטחים')).toBeTruthy());
  });

  it('renders summary and unit list', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'open')]);
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('נבדקו 1 מתוך 2')).toBeTruthy();
      expect(screen.getByText('פתוחות 1')).toBeTruthy();
      expect(screen.getByText('תיקון 0')).toBeTruthy();
      expect(screen.getByTestId('check-units-status-chip')).toBeTruthy();
      expect(screen.getByText('נבדק חלקית')).toBeTruthy();
      expect(screen.getByText('פרטים')).toBeTruthy();
      expect(screen.getByTestId('check-units-list')).toBeTruthy();
      expect(screen.getByText('#1')).toBeTruthy();
      expect(screen.getByText('#2')).toBeTruthy();
    });
    expect((screen.getByTestId('check-units-details') as HTMLDetailsElement).open).toBe(false);
  });

  it('stage-gating disables actions and shows reason when canInteract=false', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open')]);
    renderPanel({
      canInteract: false,
      disabledReason: 'העבר את ההזמנה לבדיקה כדי להתחיל לבדוק יחידות'
    });

    await waitFor(() => expect(screen.getByText('#1')).toBeTruthy());
    expect(screen.getByTestId('check-units-disabled-reason')).toBeTruthy();

    const createButton = screen.getByTestId('create-check-unit') as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);

    const checkButton = screen.getByText('משטח תקין') as HTMLButtonElement;
    const returnedButton = screen.getByText('תקלה') as HTMLButtonElement;
    fireEvent.click(screen.getByText('עוד'));
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
    await waitFor(() => expect(screen.getByText('משטח תקין')).toBeTruthy());

    const checkButton = screen.getByText('משטח תקין');
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

  it('voided units are hidden from the list', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'voided')]);
    renderPanel();
    // checkUnits.length > 0 so the summary section renders, but the filtered list is empty
    await waitFor(() => expect(screen.getByTestId('check-units-list')).toBeTruthy());
    // No unit row rendered — #1 is voided and filtered out
    expect(screen.queryByText('#1')).toBeNull();
    expect(screen.queryByText('משטח תקין')).toBeNull();
    expect(screen.queryByText('תקלה')).toBeNull();
  });

  it('returned unit can be marked fixed (returned -> checked)', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([makeCheckUnit(1, 'returned')])
      .mockResolvedValueOnce(makeCheckUnit(1, 'checked'));
    renderPanel();

    await waitFor(() => expect(screen.getByText('משטח תקין')).toBeTruthy());
    fireEvent.click(screen.getByText('משטח תקין'));

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

    await waitFor(() => expect(screen.getByText('#1')).toBeTruthy());
    expect(screen.queryByText('צור השלמה')).toBeNull();
    expect(screen.getByText('משטח תקין')).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText('#1')).toBeTruthy());
    expect(screen.getByText('יש השלמה פתוחה. השלם ואז סמן משטח תקין')).toBeTruthy();
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

  it('create completion appears only for מוצר אזל returned unit', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') {
        return [makeCheckUnit(1, 'returned', { reason: 'כמות לא נכונה' }), makeCheckUnit(2, 'returned', { reason: 'מוצר אזל' })];
      }
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') return [];
      return [];
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText('#1')).toBeTruthy());
    expect(screen.queryByTestId('create-completion-cu-1')).toBeNull();
    expect(screen.getByTestId('create-completion-cu-2')).toBeTruthy();
  });

  it('create completion requires non-empty text and posts ashlama', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [makeCheckUnit(1, 'returned', { reason: 'מוצר אזל' })];
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
    // Dialog pre-fills text for מוצר אזל, so confirm is already enabled
    expect(confirm.disabled).toBe(false);
    fireEvent.change(dialog.querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'להשלים מוצר אזל' } });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/order-1/ashlamot', {
        method: 'POST',
        body: JSON.stringify({ checkUnitId: 'cu-1', text: 'להשלים מוצר אזל' })
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
    await waitFor(() => expect(screen.getByText('#1')).toBeTruthy());
    expect(screen.queryByTestId('order-ashlamot-section')).toBeNull();
  });

  it('"הוסף השלמה" is visible when ashlamot list is empty', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') return [];
      return [];
    });

    renderPanel();
    await waitFor(() => expect(screen.getByTestId('add-order-ashlama')).toBeTruthy());
    expect(screen.queryByTestId('order-ashlamot-section')).toBeNull();
  });

  it('creating manual ashlama posts checkUnitId:null and text', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'POST') {
        return {
          id: 'ash-manual-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: null,
          source: 'manual',
          status: 'open',
          text: 'להשלים ידנית',
          createdAt: '2026-05-29T09:00:00.000Z',
          updatedAt: '2026-05-29T09:00:00.000Z'
        };
      }
      return [];
    });

    renderPanel();
    await waitFor(() => expect(screen.getByTestId('add-order-ashlama')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-order-ashlama'));

    const dialog = screen.getByTestId('ashlama-dialog');
    fireEvent.change(dialog.querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'להשלים ידנית' } });
    fireEvent.click(screen.getAllByText('צור השלמה')[0] as HTMLButtonElement);

    await waitFor(() =>
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/order-1/ashlamot', {
        method: 'POST',
        body: JSON.stringify({ checkUnitId: null, text: 'להשלים ידנית' })
      })
    );
  });

  it('manual ashlama section appears only when at least one manual item exists', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') {
        return [{
          id: 'ash-manual-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: null,
          source: 'manual',
          status: 'open',
          text: 'להשלים ידנית',
          createdAt: '2026-05-29T09:00:00.000Z',
          updatedAt: '2026-05-29T09:00:00.000Z'
        }];
      }
      return [];
    });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('order-ashlamot-section')).toBeTruthy());
    expect(screen.getByText('השלמה')).toBeTruthy();
  });

  it('open manual ashlama exposes done and cancel actions', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') {
        return [{
          id: 'ash-manual-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: null,
          source: 'manual',
          status: 'open',
          text: 'להשלים ידנית',
          createdAt: '2026-05-29T09:00:00.000Z',
          updatedAt: '2026-05-29T09:00:00.000Z'
        }];
      }
      return [];
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('סמן כהושלם')).toBeTruthy());
    expect(screen.getByText('בטל השלמה')).toBeTruthy();
  });

  it('marking manual ashlama done calls status mutation', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') {
        return [{
          id: 'ash-manual-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: null,
          source: 'manual',
          status: 'open',
          text: 'להשלים ידנית',
          createdAt: '2026-05-29T09:00:00.000Z',
          updatedAt: '2026-05-29T09:00:00.000Z'
        }];
      }
      if (path.includes('/api/manual-shift-ashlamot/ash-manual-1') && method === 'PATCH') {
        return {
          id: 'ash-manual-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: null,
          source: 'manual',
          status: 'done',
          text: 'להשלים ידנית',
          createdAt: '2026-05-29T09:00:00.000Z',
          updatedAt: '2026-05-29T09:10:00.000Z'
        };
      }
      return [];
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('סמן כהושלם')).toBeTruthy());
    fireEvent.click(screen.getByText('סמן כהושלם'));
    await waitFor(() =>
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-ashlamot/ash-manual-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' })
      })
    );
  });

  it('cancelling manual ashlama calls status mutation', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot') && method === 'GET') {
        return [{
          id: 'ash-manual-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: null,
          source: 'manual',
          status: 'open',
          text: 'להשלים ידנית',
          createdAt: '2026-05-29T09:00:00.000Z',
          updatedAt: '2026-05-29T09:00:00.000Z'
        }];
      }
      if (path.includes('/api/manual-shift-ashlamot/ash-manual-1') && method === 'PATCH') {
        return {
          id: 'ash-manual-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: null,
          source: 'manual',
          status: 'cancelled',
          text: 'להשלים ידנית',
          createdAt: '2026-05-29T09:00:00.000Z',
          updatedAt: '2026-05-29T09:10:00.000Z'
        };
      }
      return [];
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('בטל השלמה')).toBeTruthy());
    fireEvent.click(screen.getByText('בטל השלמה'));
    await waitFor(() =>
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-ashlamot/ash-manual-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' })
      })
    );
  });

  it('no-units state shows dominant add button and no metrics', async () => {
    mockedBffRequest.mockResolvedValue([]);
    renderPanel();
    await waitFor(() => expect(screen.getByText('עדיין לא נוספו משטחים')).toBeTruthy());
    const addButton = screen.getByTestId('create-check-unit');
    expect(addButton.className).toContain('bg-blue-600');
    expect(screen.queryByTestId('check-units-summary')).toBeNull();
    expect(screen.queryByTestId('check-units-details')).toBeNull();
  });

  it('unit list and summary are populated from the same server-backed query', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open'), makeCheckUnit(2, 'open')]);
    renderPanel({ expectedUnitsCount: 2 });

    // Both unit rows appear in the list (server-backed)
    await waitFor(() => {
      expect(screen.getByTestId('check-units-list')).toBeTruthy();
      expect(screen.getByText('#1')).toBeTruthy();
      expect(screen.getByText('#2')).toBeTruthy();
    });
    // Summary reflects the same data - 0 checked out of 2 expected
    expect(screen.getByTestId('check-units-summary').textContent).toContain('נבדקו 0 מתוך 2');
    expect(screen.getByTestId('check-units-summary').textContent).toContain('פתוחות 2');
  });

  it('adding a third unit via POST appears in list without duplicates after server refetch', async () => {
    const unit3 = makeCheckUnit(3, 'open');
    let getCallCount = 0;

    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') {
        getCallCount += 1;
        if (getCallCount === 1) return [makeCheckUnit(1, 'open'), makeCheckUnit(2, 'open')];
        return [makeCheckUnit(1, 'open'), makeCheckUnit(2, 'open'), unit3];
      }
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'POST') {
        return unit3;
      }
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot')) return [];
      return [];
    });

    renderPanel({ expectedUnitsCount: 2 });
    await waitFor(() => expect(screen.getByText('#2')).toBeTruthy());

    fireEvent.click(screen.getByTestId('create-check-unit'));

    // After server refetch, unit #3 appears
    await waitFor(() => expect(screen.getByText('#3')).toBeTruthy());

    // No duplicates — exactly one row per unit number
    expect(screen.getAllByText('#1')).toHaveLength(1);
    expect(screen.getAllByText('#2')).toHaveLength(1);
    expect(screen.getAllByText('#3')).toHaveLength(1);

    // Summary updated to reflect 3 active units
    expect(screen.getByTestId('check-units-summary').textContent).toContain('פתוחות 3');
  });
});

