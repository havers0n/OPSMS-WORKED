import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { SectionPresetForm } from './section-preset-form';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type OnApply = (rackId: string, side: 'A' | 'B', sections: number, levels: number, slots: number) => void;

function renderForm(opts: {
  existingSectionCount: number;
  onApply: OnApply;
  initialSectionCount?: number;
  initialLevelCount?: number;
  initialSlotCount?: number;
}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(SectionPresetForm, {
        rackId: 'rack-1',
        side: 'A',
        totalLength: 6,
        initialSectionCount: opts.initialSectionCount ?? 3,
        initialLevelCount: opts.initialLevelCount ?? 4,
        initialSlotCount: opts.initialSlotCount ?? 3,
        existingSectionCount: opts.existingSectionCount,
        readOnly: false,
        onApply: opts.onApply
      })
    );
  });
  return renderer;
}

function hasConfirm(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByProps({ 'data-testid': 'section-preset-confirm' }).length > 0;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return JSON.stringify(renderer.toJSON()).includes(text);
}

describe('SectionPresetForm confirmation safety', () => {
  it('empty face — Generate applies immediately', () => {
    const onApply = vi.fn();
    const renderer = renderForm({ existingSectionCount: 0, onApply });

    const generate = renderer.root.findByProps({ 'data-testid': 'section-preset-generate' });
    act(() => {
      generate.props.onClick();
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith('rack-1', 'A', 3, 4, 3);
    expect(hasConfirm(renderer)).toBe(false);
  });

  it('populated face — Generate enters pending-confirm without applying', () => {
    const onApply = vi.fn();
    const renderer = renderForm({ existingSectionCount: 3, onApply });

    const generate = renderer.root.findByProps({ 'data-testid': 'section-preset-generate' });
    act(() => {
      generate.props.onClick();
    });

    expect(onApply).not.toHaveBeenCalled();
    expect(hasConfirm(renderer)).toBe(true);
    expect(hasText(renderer, '3 existing sections')).toBe(true);
    expect(
      renderer.root.findAllByProps({ 'data-testid': 'section-preset-cancel' })
    ).toHaveLength(1);
    expect(
      renderer.root.findAllByProps({ 'data-testid': 'section-preset-replace' })
    ).toHaveLength(1);
  });

  it('Cancel clears pending-confirm and does not call onApply', () => {
    const onApply = vi.fn();
    const renderer = renderForm({ existingSectionCount: 2, onApply });

    act(() => {
      renderer.root
        .findByProps({ 'data-testid': 'section-preset-generate' })
        .props.onClick();
    });
    expect(hasConfirm(renderer)).toBe(true);

    act(() => {
      renderer.root
        .findByProps({ 'data-testid': 'section-preset-cancel' })
        .props.onClick();
    });

    expect(onApply).not.toHaveBeenCalled();
    expect(hasConfirm(renderer)).toBe(false);
    expect(
      renderer.root.findAllByProps({ 'data-testid': 'section-preset-generate' })
    ).toHaveLength(1);
  });

  it('Replace calls onApply and clears pending-confirm', () => {
    const onApply = vi.fn();
    const renderer = renderForm({ existingSectionCount: 4, onApply });

    act(() => {
      renderer.root
        .findByProps({ 'data-testid': 'section-preset-generate' })
        .props.onClick();
    });

    act(() => {
      renderer.root
        .findByProps({ 'data-testid': 'section-preset-replace' })
        .props.onClick();
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith('rack-1', 'A', 3, 4, 3);
    expect(hasConfirm(renderer)).toBe(false);
  });

  it('changing a stepper value while pending clears confirm', () => {
    const onApply = vi.fn();
    const renderer = renderForm({ existingSectionCount: 2, onApply });

    act(() => {
      renderer.root
        .findByProps({ 'data-testid': 'section-preset-generate' })
        .props.onClick();
    });
    expect(hasConfirm(renderer)).toBe(true);

    // find the Sections stepper "+" button (first + button in the form)
    const plusButtons = renderer.root.findAll(
      (node) =>
        node.type === 'button' &&
        node.children.some((child) => child === '+')
    );
    expect(plusButtons.length).toBeGreaterThan(0);
    act(() => {
      plusButtons[0].props.onClick();
    });

    expect(hasConfirm(renderer)).toBe(false);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('singular copy when existingSectionCount === 1', () => {
    const onApply = vi.fn();
    const renderer = renderForm({ existingSectionCount: 1, onApply });

    act(() => {
      renderer.root
        .findByProps({ 'data-testid': 'section-preset-generate' })
        .props.onClick();
    });

    expect(hasText(renderer, '1 existing section')).toBe(true);
    expect(hasText(renderer, '1 existing sections')).toBe(false);
  });
});
