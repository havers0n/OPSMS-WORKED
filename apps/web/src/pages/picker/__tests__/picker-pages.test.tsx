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
    pickerTasksQueryOptions: (workerId: string | null) => ({
      queryKey: ['picker', 'tasks', workerId ?? 'none'],
      queryFn: workerId ? () => vi.mocked(fetchPickerTasks)(workerId) : () => Promise.resolve([]),
      enabled: Boolean(workerId),
    }),
    pickerTaskDetailQueryOptions: (taskId: string | null, workerId: string | null) => ({
      queryKey: ['picker', 'task', taskId ?? 'none', workerId ?? 'none'],
      queryFn:
        taskId && workerId
          ? () => vi.mocked(fetchPickerTaskDetail)(taskId, workerId)
          : () => Promise.resolve(null),
      enabled: Boolean(taskId) && Boolean(workerId),
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

const WORKER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
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
    assignedTo: WORKER_ID,
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

// Renders outside <Routes> so it always tracks current URL regardless of which route is active.
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

function renderPickerPage(search = '') {
  return render(
    createElement(
      QueryClientProvider,
      { client: makeQueryClient() },
      createElement(
        MemoryRouter,
        { initialEntries: [`/picker${search}`] },
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

function renderPickTaskPage(taskId = TASK_ID, search = `?workerId=${WORKER_ID}`) {
  return render(
    createElement(
      QueryClientProvider,
      { client: makeQueryClient() },
      createElement(
        MemoryRouter,
        { initialEntries: [`/picker/task/${taskId}${search}`] },
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

function renderPickStepPage(
  taskId = TASK_ID,
  stepId = STEP_ID_1,
  search = `?workerId=${WORKER_ID}`
) {
  return render(
    createElement(
      QueryClientProvider,
      { client: makeQueryClient() },
      createElement(
        MemoryRouter,
        { initialEntries: [`/picker/task/${taskId}/step/${stepId}${search}`] },
        // PersistentLocationEcho is outside Routes so it always reflects the active URL.
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

  it('shows missing worker identity state when workerId is absent', () => {
    renderPickerPage();
    expect(screen.getByTestId('picker-missing-worker')).toBeTruthy();
  });

  it('renders assigned tasks when workerId is present', async () => {
    vi.mocked(fetchPickerTasks).mockResolvedValue([makeTask()]);

    renderPickerPage(`?workerId=${WORKER_ID}`);

    await waitFor(() => {
      expect(screen.getByTestId('picker-task-list')).toBeTruthy();
      expect(screen.getAllByTestId('picker-task-item')).toHaveLength(1);
    });
  });

  it('clicking a task navigates to task detail preserving workerId', async () => {
    vi.mocked(fetchPickerTasks).mockResolvedValue([makeTask()]);

    renderPickerPage(`?workerId=${WORKER_ID}`);

    await waitFor(() => expect(screen.getByTestId('picker-task-item')).toBeTruthy());

    fireEvent.click(screen.getByTestId('picker-task-item'));

    await waitFor(() => {
      const echo = screen.getByTestId('location-echo').textContent ?? '';
      expect(echo).toContain(`/picker/task/${TASK_ID}`);
      expect(echo).toContain(`workerId=${WORKER_ID}`);
    });
  });
});

describe('PickTaskPage', () => {
  beforeEach(() => {
    vi.mocked(fetchPickerTaskDetail).mockReset();
    mockMutateAsync.mockReset();
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

  it('qty stepper increments and decrements without going below 0', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-qty-value')).toBeTruthy());

    const decrease = screen.getByTestId('pick-step-qty-decrease');
    const increase = screen.getByTestId('pick-step-qty-increase');
    const value = () => screen.getByTestId('pick-step-qty-value').textContent?.trim();

    // initial value equals qtyRequired (3)
    expect(value()).toBe('3');

    fireEvent.click(increase);
    expect(value()).toBe('4');

    fireEvent.click(decrease);
    expect(value()).toBe('3');

    // drive to 0 then try to go below
    fireEvent.click(decrease);
    fireEvent.click(decrease);
    fireEvent.click(decrease);
    expect(value()).toBe('0');

    fireEvent.click(decrease);
    expect(value()).toBe('0');
  });

  it('confirm calls API with current qtyPicked and workerId', async () => {
    vi.mocked(fetchPickerTaskDetail).mockResolvedValue(makeTask());
    mockMutateAsync.mockResolvedValue({ ...makeTask(), steps: [] });

    renderPickStepPage();

    await waitFor(() => expect(screen.getByTestId('pick-step-confirm')).toBeTruthy());

    // Increment once so qty = 4
    fireEvent.click(screen.getByTestId('pick-step-qty-increase'));

    fireEvent.click(screen.getByTestId('pick-step-confirm'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        taskId: TASK_ID,
        stepId: STEP_ID_1,
        workerId: WORKER_ID,
        qtyPicked: 4,
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
      expect(echo).toContain(`workerId=${WORKER_ID}`);
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
      expect(echo).toContain(`workerId=${WORKER_ID}`);
      // should NOT be on a step sub-path
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
    // Task has no step matching STEP_ID_1
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

    // Decrease below required (3 → 1)
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

    // Drive to 0
    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));
    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));
    fireEvent.click(screen.getByTestId('pick-step-qty-decrease'));

    expect((screen.getByTestId('pick-step-confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
