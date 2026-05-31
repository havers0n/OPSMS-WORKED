import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ManualShiftOrder } from '@wos/domain';
import { AssignPickerSheet } from './assign-picker-sheet';

const mutate = vi.fn();

vi.mock('@/entities/manual-shift/api/mutations', () => ({
  usePatchManualShiftOrder: () => ({ mutate, isPending: false })
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: [
        { id: 'w1', name: 'Active A', active: true, role: 'picker', shiftId: 's1', tenantId: 't1', sortOrder: 1, createdAt: '', updatedAt: '' },
        { id: 'w2', name: 'Inactive B', active: false, role: 'picker', shiftId: 's1', tenantId: 't1', sortOrder: 2, createdAt: '', updatedAt: '' }
      ]
    })
  };
});

function makeOrder(overrides: Partial<ManualShiftOrder> = {}): ManualShiftOrder {
  return {
    id: 'o1',
    tenantId: 't1',
    shiftId: 's1',
    lineId: 'l1',
    pointName: 'Point 1',
    orderNumber: null,
    customerName: null,
    palletCount: null,
    pickerName: null,
    pickerWorkerId: null,
    checkerName: null,
    lineCount: null,
    size: 'unknown',
    status: 'queued',
    startedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null,
    ...overrides,
    checkStartedAt: overrides.checkStartedAt ?? null
  };
}

function renderSheet(order: ManualShiftOrder) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AssignPickerSheet order={order} onClose={() => {}} />
    </QueryClientProvider>
  );
}

describe('assign picker sheet', () => {
  it('shows no-picker state and assign title', () => {
    renderSheet(makeOrder({ pickerName: null }));
    expect(screen.getByText('הקצה מלקט')).toBeTruthy();
  });

  it('shows current picker and change title', () => {
    renderSheet(makeOrder({ pickerName: 'Historical Inactive', pickerWorkerId: 'inactive-worker' }));
    expect(screen.getByText('שנה מלקט')).toBeTruthy();
    expect(screen.getByText('Historical Inactive')).toBeTruthy();
  });

  it('selecting active roster worker patches with pickerWorkerId', () => {
    mutate.mockClear();
    renderSheet(makeOrder());
    fireEvent.click(screen.getByText('Active A'));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ pickerWorkerId: 'w1' }),
      expect.any(Object)
    );
  });

  it('free-text assignment patches pickerName with pickerWorkerId null', () => {
    mutate.mockClear();
    renderSheet(makeOrder());
    fireEvent.change(screen.getByPlaceholderText('שם המלקט'), { target: { value: 'Free Picker' } });
    fireEvent.click(screen.getByText('שמור שם חופשי'));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ pickerWorkerId: null, pickerName: 'Free Picker' }),
      expect.any(Object)
    );
  });

  it('clear picker patches both fields as null', () => {
    mutate.mockClear();
    renderSheet(makeOrder({ pickerName: 'Worker A', pickerWorkerId: 'w1' }));
    fireEvent.click(screen.getByText('נקה מלקט'));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ pickerWorkerId: null, pickerName: null }),
      expect.any(Object)
    );
  });

  it('does not render inactive worker as selectable option', () => {
    renderSheet(makeOrder());
    expect(screen.queryByText('Inactive B')).toBeNull();
  });
});
