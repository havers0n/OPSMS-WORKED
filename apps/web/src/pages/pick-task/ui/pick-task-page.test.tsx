import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Container, ContainerType, PickStepDetail, PickStepStatus, PickTaskDetail } from '@wos/domain';
import type { CreateContainerResult } from '@/features/container-create/api/mutations';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkerSafeMutationErrorMessage } from '@/entities/pick-task/lib/worker-safe-error';
import { PickTaskPage } from './pick-task-page';

const TASK_ID = 'task-1';
const ORDER_ID = 'order-1';
const WORKER_CONTAINER_ID = 'container-1';
const CONTAINER_TYPE_ID = 'container-type-1';

const mocks = vi.hoisted(() => ({
  state: {
    taskFixture: undefined as PickTaskDetail | undefined,
    allocatedTaskFixture: undefined as PickTaskDetail | undefined,
    nextTaskFixtureAfterExecute: null as PickTaskDetail | null,
    nextTaskFixtureAfterSkip: null as PickTaskDetail | null,
    deferCanonicalRefreshAfterExecute: false,
    deferCanonicalRefreshAfterSkip: false,
    allocateFailure: null as Error | null,
    executeFailure: null as Error | null,
    skipFailure: null as Error | null,
    createFailure: null as Error | null,
    orderDetail: { externalNumber: 'ORD-42' } as { externalNumber: string } | null,
    containers: [] as Container[],
    containerTypes: [] as ContainerType[],
    createResult: undefined as CreateContainerResult | undefined
  },
  spies: {
    allocate: vi.fn(),
    execute: vi.fn(),
    skip: vi.fn(),
    create: vi.fn()
  }
}));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeStep(
  seq: number,
  status: PickStepStatus,
  overrides: Partial<PickStepDetail> = {}
): PickStepDetail {
  return {
    id: `step-${seq}`,
    taskId: TASK_ID,
    tenantId: 'tenant-1',
    orderId: ORDER_ID,
    orderNumber: 'O-1001',
    orderLineId: null,
    sequenceNo: seq,
    sku: `SKU-${seq}`,
    itemName: `Item ${seq}`,
    qtyRequired: seq === 1 ? 3 : 1,
    qtyPicked: status === 'picked' ? 3 : status === 'skipped' ? 0 : status === 'needs_replenishment' ? 0 : 0,
    status,
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
    sourceLocationId: null,
    sourceLocationCode: null,
    ...overrides
  };
}

function makeTask(allocated = false): PickTaskDetail {
  const pendingStep = makeStep(1, 'pending', allocated
    ? {
        sourceCellAddress: 'A-01-01',
        sourceCellId: 'cell-1',
        sourceFloorId: 'floor-1',
        sourceLocationId: 'loc-1',
        sourceLocationCode: 'LOC-1'
      }
    : {
        sourceCellAddress: null,
        sourceCellId: null,
        sourceFloorId: null,
        sourceLocationId: null,
        sourceLocationCode: null
      });

  return {
    id: TASK_ID,
    taskNumber: 'T-0042',
    tenantId: 'tenant-1',
    sourceType: 'order',
    sourceId: ORDER_ID,
    status: 'in_progress',
    assignedTo: 'worker-1',
    startedAt: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    totalSteps: 4,
    completedSteps: allocated ? 3 : 0,
    steps: [
      pendingStep,
      makeStep(2, 'picked', {
        qtyRequired: 1,
        qtyPicked: 1,
        sourceCellAddress: 'B-01-02',
        sourceCellId: 'cell-2',
        sourceFloorId: 'floor-1',
        sourceLocationId: 'loc-2',
        sourceLocationCode: 'LOC-2'
      }),
      makeStep(3, 'skipped', {
        qtyRequired: 1,
        qtyPicked: 0,
        sourceCellAddress: 'C-01-03',
        sourceCellId: 'cell-3',
        sourceFloorId: 'floor-1',
        sourceLocationId: 'loc-3',
        sourceLocationCode: 'LOC-3'
      }),
      makeStep(4, 'needs_replenishment', {
        qtyRequired: 1,
        qtyPicked: 0,
        sourceCellAddress: null,
        sourceCellId: null,
        sourceFloorId: null,
        sourceLocationId: null,
        sourceLocationCode: null
      })
    ]
  };
}

function makeAllocatedStep(
  seq: number,
  status: PickStepStatus,
  overrides: Partial<PickStepDetail> = {}
): PickStepDetail {
  return makeStep(seq, status, {
    sourceCellAddress: `${String.fromCharCode(64 + seq)}-01-0${seq}`,
    sourceCellId: `cell-${seq}`,
    sourceFloorId: 'floor-1',
    sourceLocationId: `loc-${seq}`,
    sourceLocationCode: `LOC-${seq}`,
    qtyRequired: 1,
    qtyPicked: status === 'picked' ? 1 : 0,
    ...overrides
  });
}

function makeTaskFromSteps(steps: PickStepDetail[]): PickTaskDetail {
  const completedSteps = steps.filter((step) => step.status !== 'pending').length;
  return {
    id: TASK_ID,
    taskNumber: 'T-0042',
    tenantId: 'tenant-1',
    sourceType: 'order',
    sourceId: ORDER_ID,
    status: 'in_progress',
    assignedTo: 'worker-1',
    startedAt: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    totalSteps: steps.length,
    completedSteps,
    steps
  };
}

function makeBlockedOnlyTask(): PickTaskDetail {
  const task = makeTask(true);
  task.steps[0] = {
    ...task.steps[0],
    status: 'picked',
    qtyPicked: 3
  };
  task.steps[3] = {
    ...task.steps[3],
    status: 'needs_replenishment'
  };
  return task;
}

function makeSuccessfulTask(): PickTaskDetail {
  const task = makeTask(true);
  task.steps[0] = {
    ...task.steps[0],
    status: 'picked',
    qtyPicked: 3
  };
  task.steps[1] = {
    ...task.steps[1],
    status: 'picked',
    qtyPicked: 1
  };
  task.steps[2] = {
    ...task.steps[2],
    status: 'picked',
    qtyPicked: 1
  };
  task.steps[3] = {
    ...task.steps[3],
    status: 'picked',
    qtyPicked: 1
  };
  task.status = 'completed';
  task.completedAt = '2026-01-02T00:00:00.000Z';
  task.completedSteps = 4;
  return task;
}

function makeMixedProgressTask(): PickTaskDetail {
  const task = makeTask(true);
  task.steps[0] = {
    ...task.steps[0],
    status: 'partial',
    qtyPicked: 2
  };
  task.steps[1] = {
    ...task.steps[1],
    status: 'exception',
    qtyPicked: 0
  };
  task.steps[2] = {
    ...task.steps[2],
    status: 'skipped',
    qtyPicked: 0
  };
  task.steps[3] = {
    ...task.steps[3],
    status: 'needs_replenishment',
    qtyPicked: 0
  };
  task.completedSteps = 3;
  return task;
}

function makeCompletedWithExceptionsTask(): PickTaskDetail {
  const task = makeTask(true);
  task.steps[0] = {
    ...task.steps[0],
    status: 'picked',
    qtyPicked: 3
  };
  task.steps[1] = {
    ...task.steps[1],
    status: 'partial',
    qtyPicked: 0
  };
  task.steps[2] = {
    ...task.steps[2],
    status: 'skipped',
    qtyPicked: 0
  };
  task.steps[3] = {
    ...task.steps[3],
    status: 'exception',
    qtyPicked: 0
  };
  task.status = 'completed_with_exceptions';
  task.completedAt = '2026-01-02T00:00:00.000Z';
  task.completedSteps = 4;
  return task;
}

function makeContainer(): Container {
  return {
    id: WORKER_CONTAINER_ID,
    systemCode: 'TOTE-01',
    externalCode: 'T-01',
    containerTypeId: CONTAINER_TYPE_ID,
    status: 'active',
    operationalRole: 'pick'
  } as Container;
}

function makeContainerType(): ContainerType {
  return {
    id: CONTAINER_TYPE_ID,
    code: 'TOTE',
    description: 'Picking tote',
    supportsPicking: true
  } as ContainerType;
}

vi.mock('@/entities/pick-task/api/queries', async () => {
  const actual = await vi.importActual<typeof import('@/entities/pick-task/api/queries')>(
    '@/entities/pick-task/api/queries'
  );
  return {
    ...actual,
    pickTaskDetailQueryOptions: (taskId: string | null) => ({
      queryKey: actual.pickTaskKeys.detail(taskId),
      queryFn: async () => clone(mocks.state.taskFixture as PickTaskDetail),
      enabled: Boolean(taskId)
    })
  };
});

vi.mock('@/entities/container/api/queries', async () => {
  return {
    containerListQueryOptions: () => ({
      queryKey: ['containers', 'pick'],
      queryFn: async () => clone(mocks.state.containers),
      enabled: true
    }),
    containerTypesQueryOptions: () => ({
      queryKey: ['container-types'],
      queryFn: async () => clone(mocks.state.containerTypes),
      enabled: true
    })
  };
});

vi.mock('@/entities/order/api/queries', async () => {
  return {
    orderQueryOptions: (orderId: string | null) => ({
      queryKey: ['orders', orderId ?? 'none'],
      queryFn: async () => clone(mocks.state.orderDetail),
      enabled: Boolean(orderId)
    })
  };
});

vi.mock('@/entities/pick-task/api/mutations', async () => {
  const actual = await vi.importActual<typeof import('@/entities/pick-task/api/mutations')>(
    '@/entities/pick-task/api/mutations'
  );
  const { useMutation, useQueryClient } = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );
  const { pickTaskKeys } = await vi.importActual<typeof import('@/entities/pick-task/api/queries')>(
    '@/entities/pick-task/api/queries'
  );

  return {
    ...actual,
    useAllocatePickSteps: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async (taskId: string) => {
          mocks.spies.allocate(taskId);
          if (mocks.state.allocateFailure) throw mocks.state.allocateFailure;
          if (!mocks.state.allocatedTaskFixture) throw new Error('Missing allocated task fixture');
          mocks.state.taskFixture = clone(mocks.state.allocatedTaskFixture);
          return { taskId, allocated: 1, needsReplenishment: 1 };
        },
        onSuccess: (result: { taskId: string }) => {
          void queryClient.invalidateQueries({ queryKey: pickTaskKeys.detail(result.taskId) });
        }
      });
    },
    useExecutePickStep: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async (input: { stepId: string; qtyActual: number; pickContainerId: string }) => {
          mocks.spies.execute(input);
          if (mocks.state.executeFailure) throw mocks.state.executeFailure;
          if (
            mocks.state.nextTaskFixtureAfterExecute &&
            !mocks.state.deferCanonicalRefreshAfterExecute
          ) {
            mocks.state.taskFixture = clone(mocks.state.nextTaskFixtureAfterExecute);
            mocks.state.nextTaskFixtureAfterExecute = null;
          }
          return {
            stepId: input.stepId,
            status: 'picked' as const,
            qtyPicked: input.qtyActual,
            taskId: TASK_ID,
            taskStatus: 'in_progress' as const,
            orderStatus: null,
            waveStatus: null,
            movementId: null
          };
        },
        onSuccess: (result: { taskId: string }) => {
          void queryClient.invalidateQueries({ queryKey: pickTaskKeys.detail(result.taskId) });
        }
      });
    },
    useSkipPickStep: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async (input: { stepId: string }) => {
          mocks.spies.skip(input);
          if (mocks.state.skipFailure) throw mocks.state.skipFailure;
          if (
            mocks.state.nextTaskFixtureAfterSkip &&
            !mocks.state.deferCanonicalRefreshAfterSkip
          ) {
            mocks.state.taskFixture = clone(mocks.state.nextTaskFixtureAfterSkip);
            mocks.state.nextTaskFixtureAfterSkip = null;
          }
          return {
            stepId: input.stepId,
            status: 'skipped' as const,
            qtyPicked: 0,
            taskId: TASK_ID,
            taskStatus: 'in_progress' as const,
            orderStatus: null,
            waveStatus: null,
            movementId: null
          };
        },
        onSuccess: (result: { taskId: string }) => {
          void queryClient.invalidateQueries({ queryKey: pickTaskKeys.detail(result.taskId) });
        }
      });
    }
  };
});

vi.mock('@/features/container-create/api/mutations', async () => {
  const actual = await vi.importActual<typeof import('@/features/container-create/api/mutations')>(
    '@/features/container-create/api/mutations'
  );
  const { useMutation } = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );
  return {
    ...actual,
    useCreateContainer: () => {
      return useMutation({
        mutationFn: async (input: { containerTypeId: string; externalCode?: string; operationalRole?: 'storage' | 'pick' }) => {
          mocks.spies.create(input);
          if (mocks.state.createFailure) throw mocks.state.createFailure;
          return mocks.state.createResult as CreateContainerResult;
        }
      });
    }
  };
});

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  const queryClient = makeQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/operations/pick-tasks/${TASK_ID}`]}>
        <Routes>
          <Route path="/operations/pick-tasks/:id" element={<PickTaskPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { queryClient, ...rendered };
}

async function selectPickContainer() {
  fireEvent.click(await screen.findByRole('button', { name: /TOTE-01/ }));
}

async function refreshCanonicalTask(queryClient: QueryClient, task: PickTaskDetail) {
  mocks.state.taskFixture = clone(task);
  await act(async () => {
    await queryClient.refetchQueries();
  });
}

function expectGuidedExecutionHandoffState() {
  expect(screen.getByText('Updating task...')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm pick' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Problem / skip step' })).not.toBeInTheDocument();
}

beforeEach(() => {
  mocks.spies.allocate.mockReset();
  mocks.spies.execute.mockReset();
  mocks.spies.skip.mockReset();
  mocks.spies.create.mockReset();
  mocks.state.allocateFailure = null;
  mocks.state.executeFailure = null;
  mocks.state.skipFailure = null;
  mocks.state.createFailure = null;
  mocks.state.nextTaskFixtureAfterExecute = null;
  mocks.state.nextTaskFixtureAfterSkip = null;
  mocks.state.deferCanonicalRefreshAfterExecute = false;
  mocks.state.deferCanonicalRefreshAfterSkip = false;
  mocks.state.orderDetail = { externalNumber: 'ORD-42' };
  mocks.state.containers = [makeContainer()];
  mocks.state.containerTypes = [makeContainerType()];
  mocks.state.createResult = {
    containerId: 'container-created',
    systemCode: 'TOTE-NEW',
    externalCode: null,
    containerTypeId: CONTAINER_TYPE_ID,
    status: 'active',
    operationalRole: 'pick'
  };
  mocks.state.taskFixture = makeTask(false);
  mocks.state.allocatedTaskFixture = makeTask(true);
});

describe('PickTaskPage', () => {
  it('keeps allocation phase in front of container selection and execution, then reveals the next phase after allocation', async () => {
    renderPage();

    expect(await screen.findByText('Allocate steps')).toBeInTheDocument();
    expect(screen.queryByText('Pick container')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm pick')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Allocate steps' }));

    await waitFor(() => expect(mocks.spies.allocate).toHaveBeenCalledWith(TASK_ID));
    expect(await screen.findByText('Pick container')).toBeInTheDocument();
    expect(screen.queryByText('Allocate steps')).not.toBeInTheDocument();
  });

  it('shows guided picking after a container is selected', async () => {
    mocks.state.taskFixture = makeTask(true);
    renderPage();

    expect(await screen.findByText('Pick container')).toBeInTheDocument();
    await selectPickContainer();

    expect(await screen.findByText('Confirm pick')).toBeInTheDocument();
    expect(screen.getByText('Picking into:')).toBeInTheDocument();
  });

  it('renders one actionable step as the primary guided card with a sticky mobile CTA', async () => {
    mocks.state.taskFixture = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { qtyRequired: 3, itemName: 'Active item' }),
      makeAllocatedStep(2, 'picked', { itemName: 'Done item' }),
      makeAllocatedStep(3, 'needs_replenishment', { itemName: 'Blocked item' })
    ]);
    renderPage();

    await selectPickContainer();

    expect(screen.getByTestId('guided-pick-step-card')).toBeInTheDocument();
    expect(screen.getByTestId('guided-pick-sticky-actions')).toBeInTheDocument();
    expect(screen.getByText('Source location')).toBeInTheDocument();
    expect(screen.getByText('Active item')).toBeInTheDocument();
    expect(screen.queryByText('Done item')).not.toBeInTheDocument();
  });

  it('uses the canonical execute hook and immediately advances to the next guided actionable step while the snapshot is stale', async () => {
    mocks.state.taskFixture = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { itemName: 'First item', qtyRequired: 2 }),
      makeAllocatedStep(2, 'pending', { itemName: 'Next actionable' }),
      makeAllocatedStep(3, 'picked', { itemName: 'Already picked' })
    ]);
    renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pick' }));

    await waitFor(() =>
      expect(mocks.spies.execute).toHaveBeenCalledWith(
        expect.objectContaining({ stepId: 'step-1', pickContainerId: WORKER_CONTAINER_ID })
      )
    );
    expect(await screen.findByText('Next actionable')).toBeInTheDocument();
    expect(screen.queryByText('First item')).not.toBeInTheDocument();
    expect(screen.queryByText('Already picked')).not.toBeInTheDocument();
  });

  it('auto-advance skips needs_replenishment steps', async () => {
    mocks.state.taskFixture = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { itemName: 'First pending' }),
      makeAllocatedStep(2, 'needs_replenishment', { itemName: 'Blocked middle' }),
      makeAllocatedStep(3, 'pending', { itemName: 'Second pending' })
    ]);
    renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pick' }));

    expect(await screen.findByText('Second pending')).toBeInTheDocument();
    expect(screen.queryByText('Blocked middle')).not.toBeInTheDocument();
  });

  it('manual next navigation skips non-actionable steps when secondary navigation is used', async () => {
    mocks.state.taskFixture = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { itemName: 'Step one' }),
      makeAllocatedStep(2, 'picked', { itemName: 'Picked middle' }),
      makeAllocatedStep(3, 'exception', { itemName: 'Excepted middle' }),
      makeAllocatedStep(4, 'pending', { itemName: 'Step four' })
    ]);
    renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));

    expect(await screen.findByText('Step four')).toBeInTheDocument();
    expect(screen.queryByText('Picked middle')).not.toBeInTheDocument();
    expect(screen.queryByText('Excepted middle')).not.toBeInTheDocument();
  });

  it('uses the canonical skip hook and advances to the next guided actionable step', async () => {
    mocks.state.taskFixture = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { itemName: 'Skip me' }),
      makeAllocatedStep(2, 'pending', { itemName: 'After skip' })
    ]);
    renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Problem / skip step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm skip' }));

    await waitFor(() => expect(mocks.spies.skip).toHaveBeenCalledWith({ stepId: 'step-1' }));
    expect(await screen.findByText('After skip')).toBeInTheDocument();
  });

  it('shows a neutral stale-completion handoff after the final execute until canonical refresh confirms completion', async () => {
    const pendingOnlyTask = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { itemName: 'Last step', qtyRequired: 2 })
    ]);
    const completedTask = makeTaskFromSteps([
      makeAllocatedStep(1, 'picked', { itemName: 'Last step', qtyRequired: 2, qtyPicked: 2 })
    ]);
    completedTask.status = 'completed';
    completedTask.completedAt = '2026-01-02T00:00:00.000Z';
    mocks.state.taskFixture = pendingOnlyTask;
    mocks.state.deferCanonicalRefreshAfterExecute = true;
    const { queryClient } = renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pick' }));

    await waitFor(() =>
      expect(mocks.spies.execute).toHaveBeenCalledWith(expect.objectContaining({ stepId: 'step-1' }))
    );
    expectGuidedExecutionHandoffState();
    expect(screen.queryByText('Last step')).not.toBeInTheDocument();

    await refreshCanonicalTask(queryClient, completedTask);
    expect(await screen.findByText('Task complete')).toBeInTheDocument();
  });

  it('shows a neutral stale-blocked handoff after the final execute until canonical refresh confirms blocked state', async () => {
    const pendingThenBlockedTask = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { itemName: 'Last actionable' }),
      makeAllocatedStep(2, 'needs_replenishment', { itemName: 'Still blocked' })
    ]);
    const blockedTask = makeTaskFromSteps([
      makeAllocatedStep(1, 'picked', { itemName: 'Last actionable', qtyPicked: 1 }),
      makeAllocatedStep(2, 'needs_replenishment', { itemName: 'Still blocked' })
    ]);
    mocks.state.taskFixture = pendingThenBlockedTask;
    mocks.state.deferCanonicalRefreshAfterExecute = true;
    const { queryClient } = renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pick' }));

    await waitFor(() =>
      expect(mocks.spies.execute).toHaveBeenCalledWith(expect.objectContaining({ stepId: 'step-1' }))
    );
    expectGuidedExecutionHandoffState();
    expect(screen.queryByText('Last actionable')).not.toBeInTheDocument();

    await refreshCanonicalTask(queryClient, blockedTask);
    expect(await screen.findByText('All remaining steps need replenishment')).toBeInTheDocument();
    expect(screen.queryByText('Task complete')).not.toBeInTheDocument();
  });

  it('shows a neutral stale-completion handoff after the final skip until canonical refresh confirms completion', async () => {
    const pendingOnlyTask = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { itemName: 'Skippable last step' })
    ]);
    const skippedTask = makeTaskFromSteps([
      makeAllocatedStep(1, 'skipped', { itemName: 'Skippable last step', qtyPicked: 0 })
    ]);
    skippedTask.status = 'completed_with_exceptions';
    skippedTask.completedAt = '2026-01-02T00:00:00.000Z';
    mocks.state.taskFixture = pendingOnlyTask;
    mocks.state.deferCanonicalRefreshAfterSkip = true;
    const { queryClient } = renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Problem / skip step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm skip' }));

    await waitFor(() => expect(mocks.spies.skip).toHaveBeenCalledWith({ stepId: 'step-1' }));
    expectGuidedExecutionHandoffState();
    expect(screen.queryByText('Skippable last step')).not.toBeInTheDocument();

    await refreshCanonicalTask(queryClient, skippedTask);
    expect(await screen.findByText('Task complete with exceptions')).toBeInTheDocument();
  });

  it('keeps multiple successful stale actions excluded until canonical refresh reconciles them', async () => {
    const initialTask = makeTaskFromSteps([
      makeAllocatedStep(1, 'pending', { itemName: 'First stale action' }),
      makeAllocatedStep(2, 'pending', { itemName: 'Second stale action' })
    ]);
    const completedTask = makeTaskFromSteps([
      makeAllocatedStep(1, 'picked', { itemName: 'First stale action', qtyPicked: 1 }),
      makeAllocatedStep(2, 'picked', { itemName: 'Second stale action', qtyPicked: 1 })
    ]);
    completedTask.status = 'completed';
    completedTask.completedAt = '2026-01-02T00:00:00.000Z';
    mocks.state.taskFixture = initialTask;
    mocks.state.deferCanonicalRefreshAfterExecute = true;
    const { queryClient } = renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pick' }));

    await waitFor(() =>
      expect(mocks.spies.execute).toHaveBeenCalledWith(expect.objectContaining({ stepId: 'step-1' }))
    );
    expect(await screen.findByText('Second stale action')).toBeInTheDocument();
    expect(screen.queryByText('First stale action')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm pick' }));

    await waitFor(() =>
      expect(mocks.spies.execute).toHaveBeenCalledWith(expect.objectContaining({ stepId: 'step-2' }))
    );
    expectGuidedExecutionHandoffState();
    expect(screen.queryByText('First stale action')).not.toBeInTheDocument();
    expect(screen.queryByText('Second stale action')).not.toBeInTheDocument();

    await refreshCanonicalTask(queryClient, completedTask);
    expect(await screen.findByText('Task complete')).toBeInTheDocument();
  });

  it('renders worker-facing progress buckets with partial and exception called out separately', async () => {
    mocks.state.taskFixture = makeMixedProgressTask();
    renderPage();

    expect(await screen.findByText((_, element) => element?.textContent === 'Picked 0')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Partial 1')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Skipped 1')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Exception 1')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Blocked 1')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Remaining 0')).toBeInTheDocument();
    expect(screen.queryByText(/Completed 2/i)).not.toBeInTheDocument();
  });

  it('renders partial and exception counts in the completion summary for exception-complete tasks', async () => {
    mocks.state.taskFixture = makeCompletedWithExceptionsTask();
    renderPage();

    expect(await screen.findByText('Task complete with exceptions')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Picked 1')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Partial 1')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Skipped 1')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Exception 1')).toBeInTheDocument();
    expect(screen.queryByText('No actionable steps remain')).not.toBeInTheDocument();
  });

  it('renders blocked UI when only blocked steps remain and does not show success copy', async () => {
    mocks.state.taskFixture = makeBlockedOnlyTask();
    renderPage();

    expect(await screen.findByText('All remaining steps need replenishment')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Blocked 1')).toBeInTheDocument();
    expect(screen.queryByText('Task complete')).not.toBeInTheDocument();
    expect(screen.queryByText('No actionable steps remain')).not.toBeInTheDocument();
  });

  it('shows the completion summary for a truly completed task', async () => {
    mocks.state.taskFixture = makeSuccessfulTask();
    renderPage();

    expect(await screen.findByText('Task complete')).toBeInTheDocument();
    expect(screen.queryByText('All remaining steps need replenishment')).not.toBeInTheDocument();
    expect(screen.queryByText('No actionable steps remain')).not.toBeInTheDocument();
  });

  it('replaces raw allocation errors with worker-safe copy', async () => {
    mocks.state.allocateFailure = new Error('backend allocation details leaked');
    renderPage();

    expect(await screen.findByText('Allocate steps')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Allocate steps' }));

    expect(await screen.findByText('Unable to allocate steps. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('backend allocation details leaked')).not.toBeInTheDocument();
  });

  it('replaces raw execution errors with worker-safe copy', async () => {
    mocks.state.taskFixture = makeTask(true);
    mocks.state.executeFailure = new Error('backend execution details leaked');
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /TOTE-01/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pick' }));

    expect(await screen.findByText('Unable to confirm this pick. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('backend execution details leaked')).not.toBeInTheDocument();
    expect(mocks.spies.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        stepId: 'step-1',
        qtyActual: 3,
        pickContainerId: WORKER_CONTAINER_ID
      })
    );
  });

  it('replaces raw skip errors with worker-safe copy', async () => {
    mocks.state.taskFixture = makeTask(true);
    mocks.state.skipFailure = new Error('backend skip details leaked');
    renderPage();

    await selectPickContainer();
    fireEvent.click(screen.getByRole('button', { name: 'Problem / skip step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm skip' }));

    expect(await screen.findByText('Unable to skip this step. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('backend skip details leaked')).not.toBeInTheDocument();
    expect(mocks.spies.skip).toHaveBeenCalledWith({ stepId: 'step-1' });
  });

  it('uses the create-container hook and hides raw create errors', async () => {
    mocks.state.taskFixture = makeTask(true);
    mocks.state.createFailure = new Error('backend create details leaked');
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Create new' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create & select' }));

    expect(await screen.findByText('Unable to create a pick container. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('backend create details leaked')).not.toBeInTheDocument();
    expect(mocks.spies.create).toHaveBeenCalledWith(
      expect.objectContaining({
        containerTypeId: CONTAINER_TYPE_ID,
        operationalRole: 'pick'
      })
    );
  });
});

describe('getWorkerSafeMutationErrorMessage', () => {
  it('always returns the worker-safe fallback', () => {
    expect(
      getWorkerSafeMutationErrorMessage(new Error('raw backend text'), 'Safe fallback')
    ).toBe('Safe fallback');
  });
});
