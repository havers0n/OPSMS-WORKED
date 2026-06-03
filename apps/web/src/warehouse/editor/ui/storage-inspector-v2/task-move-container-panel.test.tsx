import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/shared/i18n';
import {
  MoveContainerTaskPanel,
  type MoveContainerTaskPanelProps
} from './task-move-container-panel';
import type { MoveTaskState } from './mode';

function createMoveState(overrides?: Partial<MoveTaskState>): MoveTaskState {
  return {
    sourceContainerId: 'c-1',
    sourceCellId: 'src-cell',
    sourceLocationId: 'src-loc',
    sourceRackId: null,
    sourceLevel: null,
    sourceLocationCode: 'SRC.01',
    sourceContainerDisplayCode: 'CONT-001',
    targetCellId: 'tgt-cell',
    stage: 'selecting-target',
    errorMessage: null,
    ...overrides
  };
}

function renderPanel(props: Partial<MoveContainerTaskPanelProps> = {}) {
  const defaultProps: MoveContainerTaskPanelProps = {
    moveTaskState: createMoveState(),
    rackDisplayCode: 'RACK-A',
    targetLocationLoading: false,
    resolvedTargetLocationCode: 'TGT.01',
    canConfirm: true,
    onConfirm: () => {},
    onCancel: () => {}
  };

  return render(
    <I18nProvider locale="en">
      <MoveContainerTaskPanel {...defaultProps} {...props} />
    </I18nProvider>
  );
}

describe('MoveContainerTaskPanel', () => {
  it('renders resolved target location code', () => {
    renderPanel();
    expect(screen.getByTestId('move-target-selected').textContent).toBe('TGT.01');
  });

  it('does not expose UUID when code is resolved', () => {
    renderPanel();
    const text = screen.getByTestId('move-target-selected').textContent!;
    expect(text).not.toBe('tgt-cell');
    expect(text).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('renders dash when target location code is null', () => {
    renderPanel({
      resolvedTargetLocationCode: null
    });
    expect(screen.getByTestId('move-target-selected').textContent).toBe('-');
  });

  it('renders dash when target location code is null even when resolvedTargetLocationId would be null', () => {
    renderPanel({
      resolvedTargetLocationCode: null
    });
    expect(screen.getByTestId('move-target-selected').textContent).toBe('-');
  });

  it('renders placeholder when targetCellId is null', () => {
    renderPanel({
      moveTaskState: createMoveState({ targetCellId: null })
    });
    expect(screen.getByTestId('move-target-placeholder')).toBeTruthy();
  });

  it('renders source location code in FROM field', () => {
    renderPanel();
    expect(screen.getAllByText('SRC.01').length).toBeGreaterThanOrEqual(1);
  });

  it('renders container display code in CONTAINER field', () => {
    renderPanel();
    expect(screen.getByText('CONT-001')).toBeTruthy();
  });
});
