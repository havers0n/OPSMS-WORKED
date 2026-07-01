// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { QuantityAllocationModal } from './quantity-allocation-modal';
import type { SourceOrderItem } from './scheme-types';

function makeItem(id: string, sku: string): SourceOrderItem {
  return {
    id,
    orderId: 'order-1',
    sku,
    description: sku,
    category: 'כללי',
    quantity: 1,
    notes: null,
    zone: null,
    sourceRows: null,
    sourceFile: null,
  };
}

describe('QuantityAllocationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms only the visible selected rows and excludes fully allocated rows', () => {
    const onConfirm = vi.fn();

    render(
      <QuantityAllocationModal
        isOpen={true}
        onClose={() => {}}
        workGroupName="קבוצה א"
        onConfirm={onConfirm}
        itemRows={[
          { item: makeItem('row-1', 'SKU-1'), remainingQty: 1, assignedQty: 0 },
          { item: makeItem('row-2', 'SKU-2'), remainingQty: 0, assignedQty: 1 },
          { item: makeItem('row-3', 'SKU-3'), remainingQty: 1, assignedQty: 0 },
        ]}
      />,
    );

    expect(screen.getByText('הקצאת כמויות לשורות המסומנות')).toBeInTheDocument();
    expect(screen.getByText(/קבוצת עבודה:/)).toBeInTheDocument();
    expect(screen.getByText('הפעולה תחול רק על השורות שנבחרו.')).toBeInTheDocument();
    expect(screen.getByText('1 שורות שהיו מסומנות כבר הוקצו במלואן')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'אשר הקצאה לשורות המסומנות' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith([
      { itemRowId: 'row-1', qty: 1 },
      { itemRowId: 'row-3', qty: 1 },
    ]);
  });
});
