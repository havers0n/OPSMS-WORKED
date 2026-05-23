import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';
import { PickingStepCard } from './picking-step-card';

function makeStep(overrides: Partial<PlanningRouteStepDto> = {}): PlanningRouteStepDto {
  return {
    sequence: 1,
    taskId: 'task-1',
    fromLocationId: 'loc-1',
    locationId: 'loc-1',
    addressLabel: 'A-01-01',
    cellId: 'cell-1',
    productId: 'prod-1',
    skuId: 'sku-1',
    displayCode: 'SKU-001',
    barcode: '123456',
    productName: 'Product One',
    productImageUrl: null,
    qtyToPick: 9,
    qtyEach: 9,
    packagingLevels: [{ id: 'box', code: 'boxes', name: 'Box', qtyEach: 2 }],
    allocations: [{ orderId: 'order-1', qty: 9 }],
    ...overrides
  };
}

function collectText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (node === null) return '';
  if (Array.isArray(node)) return node.map((child) => collectText(child)).join(' ');
  return (node.children ?? []).map((child) => (typeof child === 'string' ? child : collectText(child))).join(' ');
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

describe('PickingStepCard', () => {
  it('renders image when productImageUrl exists', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingStepCard, {
          step: makeStep({ productImageUrl: 'https://example.com/a.png' }),
          progressCurrent: 1,
          progressTotal: 6,
          onConfirm: () => undefined,
          onWhereIsIt: () => undefined
        })
      );
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'picking-step-product-image' })).toHaveLength(1);
  });

  it('renders fallback when image missing', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingStepCard, {
          step: makeStep({ productImageUrl: null }),
          progressCurrent: 1,
          progressTotal: 6,
          onConfirm: () => undefined,
          onWhereIsIt: () => undefined
        })
      );
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'picking-step-product-placeholder' })).toHaveLength(1);
  });

  it('renders product identity and packaging instruction and address', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingStepCard, {
          step: makeStep(),
          progressCurrent: 1,
          progressTotal: 6,
          onConfirm: () => undefined,
          onWhereIsIt: () => undefined
        })
      );
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Product One');
    expect(text).toContain('SKU: SKU-001');
    expect(text).toContain('Barcode: 123456');
    expect(text).toContain('Pick: 4 boxes + 1 unit');
    expect(text).toContain('Location: A-01-01');
  });

  it('confirm calls local action', () => {
    const onConfirm = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingStepCard, {
          step: makeStep(),
          progressCurrent: 1,
          progressTotal: 6,
          onConfirm,
          onWhereIsIt: () => undefined
        })
      );
    });

    const confirmButton = renderer.root.findByProps({ 'data-testid': 'picking-step-confirm' });
    act(() => {
      confirmButton.props.onClick();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('where-is-it calls focus action', () => {
    const onWhereIsIt = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingStepCard, {
          step: makeStep(),
          progressCurrent: 1,
          progressTotal: 6,
          onConfirm: () => undefined,
          onWhereIsIt
        })
      );
    });

    const whereButton = renderer.root.findByProps({ 'data-testid': 'picking-step-where-is-it' });
    act(() => {
      whereButton.props.onClick();
    });

    expect(onWhereIsIt).toHaveBeenCalledTimes(1);
  });
});
