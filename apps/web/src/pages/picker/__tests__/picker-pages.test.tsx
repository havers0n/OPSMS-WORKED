import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PickTaskDetail } from '@wos/domain';
import { fetchPickerTaskDetail, fetchPickerTasks } from '@/entities/picker/api/queries';
import { PickerPage } from '../picker-page';
import { PickTaskPage } from '../pick-task-page';
import { PickStepPage } from '../pick-step-page';

// ── Query mock ────────────────────────────────────────────────────────────────

vi.mock('@/entities/picker/api/queries', async () => {
  const actual = await vi.importActual<typeof import('@/entities/picker/api/queries')>(
    '@/entities/picker/api/queries'
  );
  return {
    ...actual,
    fetchPickerTasks: vi.fn(),
    fetchPickerTaskDetail: vi.fn(),
    pickerTasksQueryOptions: () => ({
      queryKey: ['picker', 'tasks'],
      queryFn: () => vi.mocked(fetchPickerTasks)(),
    }),
    pickerTaskDetailQueryOptions: (taskId: string | null) => ({
      queryKey: ['picker', 'task', taskId ?? 'none'],
      queryFn: taskId ? () => vi.mocked(fetchPickerTaskDetail)(taskId) : () => Promise.resolve(null),
      enabled: Boolean(taskId),
    }),
  };
});

// ── Mutation mock ─────────────────────────────────────────────────────────────

const mockMutateAsync = vi.fn();

vi.mock('@/entities/picker/api/mutations', () => ({
  useConfirmPickStep: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TASK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STEP_ID_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STEP_ID_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TENANT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SOURCE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

function makeTask(overrides: Partial<PickTaskDetail> = {}): PickTaskDetail {
  return {
    id: TASK_ID,
    taskNumber: 'T-0042',
    tenantId: TENANT_ID,
    sourceType: 'order',
    sourceId: SOURCE_ID,
    status: 'in_progress',
    assignedTo: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    totalSteps: 2,
    completedSteps: 0,
    steps: [
      {
        id: STEP_ID_1,
        taskId: TASK_ID,
        tenantId: TENANT_ID,
        orderId: SOURCE_ID,
        orderLineId: null,
        sequenceNo: 1,
        sku: 'SKU-001',
        itemName: 'Motor Oil 5W-40',
        qtyRequired: 3,
        qtyPicked: 0,
        status: 'pending',
        sourceCellAddress: 'A-04-02',
        sourceCellId: null,
        sourceContainerId: null,
        sourceContainerCode: null,
        inventoryUnitId: null,
        pickContainerId: null,
        executedAt: null,
        executedBy: null,
        imageUrl: null,
        sourceFloorId: null,
      },
      {
        id: STEP_ID_2,
        taskId: TASK_ID,
        tenantId: TENANT_ID,
        orderId: SOURCE_ID,
        orderLineId: null,
        sequenceNo: 2,
        sku: 'SKU-002',
        itemName: 'Air Filter',
        qtyRequired: 1,
        qtyPicked: 1,
        status: 'picked',
        sourceCellAddress: 'B-01-01',
        sourceCellId: null,
        sourceContainerId: null,
        sourceContainerCode: null,
        inventoryUnitId: null,
        pickContainerId: null,
        executedAt: null,
        executedBy: null,
        imageUrl: null,
        sourceFloorId: null,
      },
    ],
    ...overrides,
  };
}

// ── Render helpers ────────────────────────────────────────────────────────────

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>;
}

function PersistentLocationEcho({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div>
      <div data-testid="active-url">{`${location.pathname}${location.search}`}</div>
      {children}
    </div>
  );
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPickerPage() {
  return render(
    createElement(
      QueryClientProvider,
      { client: makeQueryClient() },
      createElement(
        MemoryRouter,
        { initialEntries: ['/picker'] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/picker', element: createElement(PickerPage) }),
          createElement(Route, {
            path: '/picker/task/:taskId',
            element: createElement(LocationEcho),
          })
        )
      )
    )
  );
}

function renderPickTaskPage(taskId = TASK_ID) {
  return render(
    createElement(
      QueryClientProvider,
      { client: makeQueryClient() },
      createElement(
        MemoryRouter,
        { initialEntries: [`/picker/task/${taskId}`] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: '/picker/task/:taskId',
            element: createElement(PickTaskPage),
          }),
          createElement(Route, { path: '/picker', element: createElement(LocationEcho) }),
          createElement(Route, {
            path: '/picker/task/:taskId/step/:stepId',
            element: createElement(LocationEcho),
          })
        )
      )
    )
  );
}

function renderPickStepPage(taskId = TASK_ID, stepId = STEP_ID_1) {
  return render(
    createElement(
      QueryClientProvider,
      { client: makeQueryClient() },
      createElement(
        MemoryRouter,
        { initialEntries: [`/picker/task/${taskId}/step/${stepId}`] },
        createElement(
          PersistentLocationEcho,
          null,
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: '/picker/task/:taskId/step/:stepId',
              element: createElement(PickStepPage),
            }),
            createElement(Route, {
              path: '/picker/task/:taskId',
              element: createElement(LocationEcho),
            })
          )
        )
      )
    )
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PickerPage', () => {
  beforeEach(() => {
    vi.mocked(fetchPickerTasks).mockReset();
    vi.mocked(fetchPickerTaskDetail).mockReset();
    mockMutateAsync.mockReset();
  });

  it('shows error with retry action on list query failure', async () => {
    vi.mocked(fetchPickerTasks).mockRejectedValue(new Error('Network error'));

    renderPickerPage();

    await waitFor(() => {
      expect(screen.getByTestId('picker-error')).toBeTruthy();
      expect(screen.getByTestId('picker-retry')).toBeTruthy();
    });
  });

  it('shows auth-binding error state when PICKER_WORKER_NOT_BOUND', async () => {
    vi.mocked(fetchPickerTasks).mockRejectedValue(
      Object.assign(new Error('not bound'), { code: 'PICKER_WORKER_NOT_BOUND' })
    );

    renderPickerPage();

    await waitFor(() => {
      expect(screen.getByTestId('picker-missing-worker')).toBeTruthy();
      expect(screen.getByTestId('picker-return-home')).toBeTruthy();
    });
  });

  it('renders assigned tasks', async () => {
    vi.mocked(fetchPickerTasks).mockResolvedValue([makeTask()]);

    renderPickerPage();

    await waitFor(() => {
      expect(screen.getByTestId('picker-task-list')).toBeTruthy();
      expect(screen.getAllByTestId('picker-task-item')).toHaveLength(1);
    });
  });

  it('clicking a task navigates to task detail', async () => {
    vi.mocked(fetchPickerTasks).mockResolvedValue([makeTask()]);

    renderPickerPage();

    await waitFor(() => expect(screen.getByTestId('picker-task-item')).toBeTruthy());

    fireEvent.click(screen.getByTestId('picker-task-item'));

    await waitFor(() => {
      const echo = screen.getByTestId('location-echo').textContent ?? '';
      expect(echo).toBe(`/picker/task/${TASK_ID}`);
    });
  });
});

describe('PickTaskPage', () => {
  beforeEach(() => {
    vi.mocked(fetchPickerTaskDetail).mockReset();
    mockMutateAsync.mockReset();
  });

  it('shows error state with retry action on task query failure', async () => {
    vi.mocked(fetchPickerTaskDetail).mockRejectedValue(new Error('Network error'));

    renderPickTaskPage();

    await waitFor(() => {
      expect(screen.getByTestId('pick-task-error')).toBeTruthy();
      expect(screen.getByTestId('pick-task-retry')).toBeTruthy();
    });
  });

  it('shows completion handoff for a completed task', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask({ status: 'completed' }));

    renderPickTaskPage();

    await waitFor(() => {
      expect(screen.getByTestId('pick-task-completed')).toBeTruthy();
      expect(screen.getByTestId('pick-task-back-to-list')).toBeTruthy();
    });
  });

  it('renders steps with correct statuses', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());

    renderPickTaskPage();

    await waitFor(() => {
      expect(screen.getByTestId('pick-task-steps')).toBeTruthy();
      expect(screen.getByTestId('pick-step-item-pending')).toBeTruthy();
      expect(screen.getByTestId('pick-step-item-picked')).toBeTruthy();
    });

    const statuses = screen.getAllByTestId('pick-step-status').map((el) => el.textContent);
    expect(statuses).toContain('Pending');
    expect(statuses).toContain('Picked');
  });

  it('back button navigates to /picker', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());

    renderPickTaskPage();

    await waitFor(() => expect(screen.getByTestId('pick-task-back')).toBeTruthy());
    fireEvent.click(screen.getByTestId('pick-task-back'));

    await waitFor(() => {
      const echo = screen.getByTestId('location-echo').textContent ?? '';
      expect(echo).toBe('/picker');
    });
  });
});

describe('PickStepPage', () => {
  beforeEach(() => {
    vi.mocked(fetchPickerTaskDetail).mockReset();
    mockMutateAsync.mockReset();
  });

  it('renders product name, location, and required qty', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());

    renderPickStepPage();

    await waitFor(() => {
      expect(screen.getByTestId('pick-step-product-name').textContent).toContain('Motor Oil 5W-40');
      expect(screen.getByTestId('pick-step-sku').textContent).toContain('SKU-001');
      expect(screen.getByTestId('pick-step-location').textContent).toContain('A-04-02');
      expect(screen.getByTestId('pick-step-qty-required').textContent).toContain('3');
    });
  });

  it('omits location block when source location is missing', async () => {
    const task = makeTask();
    task.steps[0] = { ...task.steps[0], sourceCellAddress: null };
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(task);

    renderPickStepPage();

    await waitFor(() => {
      expect(screen.getByTestId('pick-step-product-name')).toBeTruthy();
    });

    expect(screen.queryByTestId('pick-step-location')).toBeNull();
  });

  it('qty stepper increments and decrements without going below 0 or above qtyRequired', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-qty-value')).toBeTruthy());

    const decrease = screen.getByTestId('pick-step-qty-decrease');
    const increase = screen.getByTestId('pick-step-qty-increase');
    const value = () => screen.getByTestId('pick-step-qty-value').textContent?.trim();

    expect(value()).toBe('3');

    fireEvent.click(increase);
    expect(value()).toBe('3');

    fireEvent.click(decrease);
    expect(value()).toBe('2');

    fireEvent.click(decrease);
    fireEvent.click(decrease);
    expect(value()).toBe('0');

    fireEvent.click(decrease);
    expect(value()).toBe('0');
  });

  it('increase button is disabled when qtyPicked reaches qtyRequired', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-qty-value')).toBeTruthy());

    const increase = screen.getByTestId('pick-step-qty-increase') as HTMLButtonElement;
    expect(increase.disabled).toBe(true);

    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));
    expect(increase.disabled).toBe(false);

    fireEvent.click(increase);
    expect(increase.disabled).toBe(true);
  });

  it('confirm calls API with taskId, stepId, and current qtyPicked', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());
    mockMutateAsync.mockResolvedValue({ ...makeTask(), steps: [] });

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-confirm')).toBeTruthy());

    fireEvent.click(screen.getByTestId('pick-step-confirm'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        taskId: TASK_ID,
        stepId: STEP_ID_1,
        qtyPicked: 3,
      });
    });
  });

  it('successful confirm navigates to next pending step', async () => {
    const pendingStep2Id = 'ffffffff-1111-4111-8111-111111111111';
    const updatedTask = makeTask({
      steps: [
        {
          id: STEP_ID_1,
          taskId: TASK_ID,
          tenantId: TENANT_ID,
          orderId: SOURCE_ID,
          orderLineId: null,
          sequenceNo: 1,
          sku: 'SKU-001',
          itemName: 'Motor Oil 5W-40',
          qtyRequired: 3,
          qtyPicked: 3,
          status: 'picked',
          sourceCellAddress: 'A-04-02',
          sourceCellId: null,
          sourceContainerId: null,
          sourceContainerCode: null,
          inventoryUnitId: null,
          pickContainerId: null,
          executedAt: null,
          executedBy: null,
          imageUrl: null,
          sourceFloorId: null,
        },
        {
          id: pendingStep2Id,
          taskId: TASK_ID,
          tenantId: TENANT_ID,
          orderId: SOURCE_ID,
          orderLineId: null,
          sequenceNo: 2,
          sku: 'SKU-003',
          itemName: 'Next Item',
          qtyRequired: 2,
          qtyPicked: 0,
          status: 'pending',
          sourceCellAddress: null,
          sourceCellId: null,
          sourceContainerId: null,
          sourceContainerCode: null,
          inventoryUnitId: null,
          pickContainerId: null,
          executedAt: null,
          executedBy: null,
          imageUrl: null,
          sourceFloorId: null,
        },
      ],
    });

    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());
    mockMutateAsync.mockResolvedValue(updatedTask);

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('pick-step-confirm'));

    await waitFor(() => {
      const echo = screen.getByTestId('active-url').textContent ?? '';
      expect(echo).toContain(`/picker/task/${TASK_ID}/step/${pendingStep2Id}`);
    });
  });

  it('successful confirm with no next pending step navigates back to task', async () => {
    const updatedTask = makeTask({
      steps: [
        {
          id: STEP_ID_1,
          taskId: TASK_ID,
          tenantId: TENANT_ID,
          orderId: SOURCE_ID,
          orderLineId: null,
          sequenceNo: 1,
          sku: 'SKU-001',
          itemName: 'Motor Oil 5W-40',
          qtyRequired: 3,
          qtyPicked: 3,
          status: 'picked',
          sourceCellAddress: 'A-04-02',
          sourceCellId: null,
          sourceContainerId: null,
          sourceContainerCode: null,
          inventoryUnitId: null,
          pickContainerId: null,
          executedAt: null,
          executedBy: null,
          imageUrl: null,
          sourceFloorId: null,
        },
      ],
      completedSteps: 1,
      totalSteps: 1,
    });

    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());
    mockMutateAsync.mockResolvedValue(updatedTask);

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('pick-step-confirm'));

    await waitFor(() => {
      const echo = screen.getByTestId('active-url').textContent ?? '';
      expect(echo).toContain(`/picker/task/${TASK_ID}`);
      expect(echo).not.toContain('/step/');
    });
  });

  it('confirm conflict shows a visible error message', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());
    mockMutateAsync.mockRejectedValue(
      Object.assign(new Error('Conflict'), { status: 409 })
    );

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('pick-step-confirm'));

    await waitFor(() => {
      const errEl = screen.getByTestId('pick-step-error');
      expect(errEl).toBeTruthy();
      expect(errEl.textContent).toContain('already confirmed');
    });
  });

  it('shows not-found state when stepId is absent from task detail', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(
      makeTask({ steps: [] })
    );

    renderPickStepPage(TASK_ID, STEP_ID_1);

    await waitFor(() => {
      expect(screen.getByTestId('pick-step-not-found')).toBeTruthy();
    });
  });

  it('shows amber warning and partial-pick button text when qty is below required', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-qty-value')).toBeTruthy());

    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));
    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));

    await waitFor(() => {
      expect(screen.getByTestId('pick-step-shortage-warning')).toBeTruthy();
      expect(screen.getByTestId('pick-step-confirm').textContent).toContain('partial pick');
    });
  });

  it('confirm button is disabled when qty is 0', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-qty-value')).toBeTruthy());

    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));
    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));
    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));

    expect((screen.getByTestId('pick-step-confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
