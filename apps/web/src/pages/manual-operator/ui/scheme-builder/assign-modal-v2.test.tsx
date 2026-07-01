// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AssignModalV2 } from './assign-modal-v2';
import { useSchemeBuilderStore } from './scheme-store';

function resetStore() {
  useSchemeBuilderStore.setState({
    selectedAreaName: null,
    planningLines: [],
    workGroups: [],
    itemAllocations: [],
    targetWorkGroupId: null,
  });
}

function populateStore() {
  const store = useSchemeBuilderStore.getState();
  store.planningLines = [
    { id: 'pl-user', areaName: 'דרום', name: 'כללי', sortOrder: 0, createdAt: 100 },
    { id: 'pl-tech', areaName: 'דרום', name: 'default', sortOrder: 1, createdAt: 0 },
  ];
  store.workGroups = [
    { id: 'wg-user', planningLineId: 'pl-user', areaName: 'דרום', name: 'צוות א', createdAt: 200 },
    { id: 'wg-tech', planningLineId: 'pl-user', areaName: 'דרום', name: 'unassigned', createdAt: 0 },
    { id: 'wg-tech-line', planningLineId: 'pl-tech', areaName: 'דרום', name: 'unassigned', createdAt: 0 },
  ];
}

describe('AssignModalV2', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders empty state when no planning lines exist', () => {
    render(
      <AssignModalV2
        isOpen={true}
        onClose={() => {}}
        targetAreaName="דרום"
        itemCount={3}
        onAssign={() => {}}
      />,
    );
    expect(screen.getByText('אין קו עבודה וקבוצות עבודה לשיוך בשטח זה')).toBeInTheDocument();
  });

  it('hides technical default planning lines and unassigned work groups', () => {
    populateStore();

    render(
      <AssignModalV2
        isOpen={true}
        onClose={() => {}}
        targetAreaName="דרום"
        itemCount={3}
        onAssign={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'בחר קבוצת עבודה לשורות המסומנות' })).toBeInTheDocument();
    expect(screen.queryByText('default')).toBeNull();
    expect(screen.queryByText('unassigned')).toBeNull();
  });

  it('renders user-created work groups as selectable buttons', () => {
    populateStore();

    const onAssign = vi.fn();
    render(
      <AssignModalV2
        isOpen={true}
        onClose={() => {}}
        targetAreaName="דרום"
        itemCount={3}
        onAssign={onAssign}
      />,
    );

    const assignButton = screen.getByRole('button', { name: 'המשך לשיוך' });
    expect(assignButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'צוות א' }));
    expect(assignButton).toBeEnabled();

    fireEvent.click(assignButton);
    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onAssign).toHaveBeenCalledWith('wg-user');
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <AssignModalV2
        isOpen={false}
        onClose={() => {}}
        targetAreaName="דרום"
        itemCount={3}
        onAssign={() => {}}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows an empty state when all groups are technical', () => {
    const store = useSchemeBuilderStore.getState();
    store.planningLines = [{ id: 'pl-1', areaName: 'דרום', name: 'כללי', sortOrder: 0, createdAt: 100 }];
    store.workGroups = [{ id: 'wg-unassigned', planningLineId: 'pl-1', areaName: 'דרום', name: 'unassigned', createdAt: 0 }];

    render(
      <AssignModalV2
        isOpen={true}
        onClose={() => {}}
        targetAreaName="דרום"
        itemCount={3}
        onAssign={() => {}}
      />,
    );

    expect(screen.getByText('אין קבוצות עבודה לשיוך בשטח זה')).toBeInTheDocument();
    expect(screen.queryByText('unassigned')).toBeNull();
  });
});
