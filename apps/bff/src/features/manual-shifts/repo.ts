import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApplyDailyManualShiftImportResponse,
  DailyManualShiftImportPreview,
  ManualShiftMonthlyApplyPlan,
  ManualShiftMonthlyApplyResponse,
  ManualShiftDaySummaryByError,
  ManualShiftLine,
  ManualShiftLineEvent,
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderError,
  ManualShiftOrderAshlama,
  ManualShiftOrderEvent,
  ManualShiftOrderItem,
  ManualShiftSession,
  ManualShiftWorker,
  ManualShiftWorkerRole,
  ManualShiftWorkHierarchyArea,
  ManualShiftWorkHierarchyBucket,
  ManualShiftWorkHierarchyLine,
  ManualShiftWorkHierarchyOrder,
  ManualShiftWorkHierarchyResponse,
  OpenAshlamaBoardItem
} from '@wos/domain';
import { deriveManualShiftLineStatus } from '@wos/domain';

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

export type BindableUser = {
  userId: string;
  displayName: string | null;
  email: string | null;
  boundWorkerId: string | null;
};

type ManualShiftSessionRow = {
  id: string;
  tenant_id: string;
  date: string;
  name: string;
  status: 'active' | 'closed';
  created_by_name: string | null;
  created_at: string;
  closed_at: string | null;
};

type ManualShiftLineRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  name: string;
  distribution_area: string | null;
  sort_order: number;
  created_at: string;
  deleted_at: string | null;
  deleted_by_profile_id: string | null;
  deleted_by_name: string | null;
  delete_reason: string | null;
};

type ManualShiftWorkerRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  name: string;
  role: ManualShiftWorkerRole;
  active: boolean;
  sort_order: number;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ManualShiftOrderRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  line_id: string;
  order_number: string | null;
  customer_name: string | null;
  point_name: string | null;
  pallet_count: number | null;
  picker_name: string | null;
  picker_worker_id: string | null;
  checker_name: string | null;
  line_count: number | null;
  sort_order: number | null;
  size: ManualShiftOrder['size'];
  status: ManualShiftOrder['status'];
  started_at: string | null;
  check_started_at: string | null;
  waiting_check_at: string | null;
  checked_at: string | null;
  finished_at: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by_profile_id: string | null;
  deleted_by_name: string | null;
  delete_reason: string | null;
};

type ManualShiftOrderCheckUnitRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  line_id: string;
  order_id: string;
  unit_number: number;
  status: ManualShiftOrderCheckUnit['status'];
  note: string | null;
  reason: string | null;
  checked_at: string | null;
  returned_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};

type ManualShiftOrderAshlamaRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  line_id: string;
  order_id: string;
  check_unit_id: string | null;
  source: ManualShiftOrderAshlama['source'];
  status: ManualShiftOrderAshlama['status'];
  text: string;
  created_at: string;
  updated_at: string;
};

type ManualShiftOrderItemRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  line_id: string;
  order_id: string;
  sku: string;
  description: string | null;
  category: string | null;
  quantity: number;
  notes: string | null;
  zone: string | null;
  source_sheet: string | null;
  source_rows: number[] | null;
  source_file: string | null;
  sort_order: number;
  created_at: string;
};

type ManualShiftLineEventRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  line_id: string;
  event_type: ManualShiftLineEvent['eventType'];
  actor_name: string | null;
  actor_profile_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type ManualShiftOrderEventRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  line_id: string;
  order_id: string;
  event_type: ManualShiftOrderEvent['eventType'];
  actor_name: string | null;
  actor_profile_id: string | null;
  from_status: ManualShiftOrderEvent['fromStatus'];
  to_status: ManualShiftOrderEvent['toStatus'];
  payload: Record<string, unknown> | null;
  created_at: string;
};

type ManualShiftOrderErrorRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  line_id: string;
  order_id: string;
  type: ManualShiftOrderError['type'];
  comment: string | null;
  created_by_name: string | null;
  created_at: string;
  fixed_at: string | null;
};

type ManualShiftLineSummaryAggRow = {
  line_id: string;
  tenant_id: string;
  shift_id: string;
  name: string;
  distribution_area: string | null;
  sort_order: number;
  status: ManualShiftLine['status'];
  created_at: string;
  deleted_at: string | null;
  deleted_by_profile_id: string | null;
  deleted_by_name: string | null;
  delete_reason: string | null;
  total_orders: number;
  queued_orders: number;
  picking_orders: number;
  waiting_check_orders: number;
  returned_orders: number;
  done_orders: number;
  error_count: number;
};

const sessionColumns =
  'id,tenant_id,date,name,status,created_by_name,created_at,closed_at';
const lineColumns =
  'id,tenant_id,shift_id,name,distribution_area,sort_order,created_at,deleted_at,deleted_by_profile_id,deleted_by_name,delete_reason';
const workerColumns =
  'id,tenant_id,shift_id,name,role,active,sort_order,auth_user_id,created_at,updated_at';
const orderColumns =
  'id,tenant_id,shift_id,line_id,order_number,customer_name,point_name,pallet_count,picker_name,picker_worker_id,checker_name,line_count,sort_order,size,status,started_at,check_started_at,waiting_check_at,checked_at,finished_at,comment,created_at,updated_at,deleted_at,deleted_by_profile_id,deleted_by_name,delete_reason';
const checkUnitColumns =
  'id,tenant_id,shift_id,line_id,order_id,unit_number,status,note,reason,checked_at,returned_at,voided_at,created_at,updated_at';
const ashlamaColumns =
  'id,tenant_id,shift_id,line_id,order_id,check_unit_id,source,status,text,created_at,updated_at';
const itemColumns =
  'id,tenant_id,shift_id,line_id,order_id,sku,description,category,quantity,notes,zone,source_sheet,source_rows,source_file,sort_order,created_at';
const lineEventColumns =
  'id,tenant_id,shift_id,line_id,event_type,actor_name,actor_profile_id,payload,created_at';
const eventColumns =
  'id,tenant_id,shift_id,line_id,order_id,event_type,actor_name,actor_profile_id,from_status,to_status,payload,created_at';
const errorColumns =
  'id,tenant_id,shift_id,line_id,order_id,type,comment,created_by_name,created_at,fixed_at';

const CHECK_UNIT_NUMBER_RETRY_LIMIT = 3;
const CHECK_UNIT_ORDER_NUMBER_CONSTRAINT = 'manual_shift_order_check_units_order_id_unit_number_key';

function isCheckUnitNumberUniqueConflict(error: unknown): boolean {
  const candidate = error as PostgrestLikeError | null;
  if (!candidate || typeof candidate !== 'object') return false;
  if (candidate.code !== '23505') return false;
  const haystack = `${candidate.message ?? ''} ${candidate.details ?? ''}`;
  return haystack.includes(CHECK_UNIT_ORDER_NUMBER_CONSTRAINT);
}

function mapSessionRow(row: ManualShiftSessionRow): ManualShiftSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    date: row.date,
    name: row.name,
    status: row.status,
    createdBy: row.created_by_name,
    createdAt: row.created_at,
    closedAt: row.closed_at
  };
}

function mapLineRow(row: ManualShiftLineRow, status: ManualShiftLine['status']): ManualShiftLine {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    name: row.name,
    distributionArea: row.distribution_area,
    sortOrder: row.sort_order,
    status,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    deletedByProfileId: row.deleted_by_profile_id,
    deletedByName: row.deleted_by_name,
    deleteReason: row.delete_reason
  };
}

function mapLineSummaryAggRow(row: ManualShiftLineSummaryAggRow): ManualShiftLineSummary {
  return {
    line: {
      id: row.line_id,
      tenantId: row.tenant_id,
      shiftId: row.shift_id,
      name: row.name,
      distributionArea: row.distribution_area,
      sortOrder: row.sort_order,
      status: row.status,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      deletedByProfileId: row.deleted_by_profile_id,
      deletedByName: row.deleted_by_name,
      deleteReason: row.delete_reason
    },
    totalOrders: Number(row.total_orders ?? 0),
    queuedOrders: Number(row.queued_orders ?? 0),
    pickingOrders: Number(row.picking_orders ?? 0),
    waitingCheckOrders: Number(row.waiting_check_orders ?? 0),
    returnedOrders: Number(row.returned_orders ?? 0),
    doneOrders: Number(row.done_orders ?? 0),
    errorCount: Number(row.error_count ?? 0)
  };
}

function mapWorkerRow(row: ManualShiftWorkerRow): ManualShiftWorker {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    name: row.name,
    role: row.role,
    active: row.active,
    sortOrder: row.sort_order,
    authUserId: row.auth_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOrderRow(row: ManualShiftOrderRow): ManualShiftOrder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    lineId: row.line_id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    pointName: row.point_name,
    palletCount: row.pallet_count !== null ? Number(row.pallet_count) : null,
    pickerName: row.picker_name,
    pickerWorkerId: row.picker_worker_id,
    checkerName: row.checker_name,
    lineCount: row.line_count,
    sortOrder: row.sort_order,
    size: row.size,
    status: row.status,
    startedAt: row.started_at,
    checkStartedAt: row.check_started_at,
    waitingCheckAt: row.waiting_check_at,
    checkedAt: row.checked_at,
    finishedAt: row.finished_at,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deletedByProfileId: row.deleted_by_profile_id,
    deletedByName: row.deleted_by_name,
    deleteReason: row.delete_reason
  };
}

function mapCheckUnitRow(row: ManualShiftOrderCheckUnitRow): ManualShiftOrderCheckUnit {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    lineId: row.line_id,
    orderId: row.order_id,
    unitNumber: row.unit_number,
    status: row.status,
    note: row.note,
    reason: row.reason,
    checkedAt: row.checked_at,
    returnedAt: row.returned_at,
    voidedAt: row.voided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAshlamaRow(row: ManualShiftOrderAshlamaRow): ManualShiftOrderAshlama {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    lineId: row.line_id,
    orderId: row.order_id,
    checkUnitId: row.check_unit_id,
    source: row.source,
    status: row.status,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOrderItemRow(row: ManualShiftOrderItemRow): ManualShiftOrderItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    lineId: row.line_id,
    orderId: row.order_id,
    sku: row.sku,
    description: row.description,
    category: row.category,
    quantity: Number(row.quantity),
    notes: row.notes,
    zone: row.zone,
    sourceSheet: row.source_sheet,
    sourceRows: row.source_rows,
    sourceFile: row.source_file,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  };
}

type OpenAshlamaBoardItemRow = {
  id: string;
  shift_id: string;
  line_id: string;
  order_id: string;
  check_unit_id: string | null;
  source: string;
  text: string;
  created_at: string;
  manual_shift_orders: { order_number: string | null; point_name: string | null } | null;
  manual_shift_lines: { name: string } | null;
};

function mapOpenAshlamaBoardItemRow(row: OpenAshlamaBoardItemRow): OpenAshlamaBoardItem {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.manual_shift_orders?.order_number ?? null,
    pointName: row.manual_shift_orders?.point_name ?? null,
    lineId: row.line_id,
    lineName: row.manual_shift_lines?.name ?? '',
    text: row.text,
    source: row.source as OpenAshlamaBoardItem['source'],
    checkUnitId: row.check_unit_id,
    createdAt: row.created_at
  };
}

function mapLineEventRow(row: ManualShiftLineEventRow): ManualShiftLineEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    lineId: row.line_id,
    eventType: row.event_type,
    actorName: row.actor_name,
    actorProfileId: row.actor_profile_id,
    payload: row.payload,
    createdAt: row.created_at
  };
}

function mapEventRow(row: ManualShiftOrderEventRow): ManualShiftOrderEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    lineId: row.line_id,
    orderId: row.order_id,
    eventType: row.event_type,
    actorName: row.actor_name,
    actorProfileId: row.actor_profile_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    payload: row.payload,
    createdAt: row.created_at
  };
}

function mapErrorRow(row: ManualShiftOrderErrorRow): ManualShiftOrderError {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    lineId: row.line_id,
    orderId: row.order_id,
    type: row.type,
    comment: row.comment,
    createdBy: row.created_by_name,
    createdAt: row.created_at,
    fixedAt: row.fixed_at
  };
}

export type ManualShiftOrderPatch = {
  orderNumber?: string | null;
  customerName?: string | null;
  pointName?: string | null;
  palletCount?: number | null;
  pickerName?: string | null;
  pickerWorkerId?: string | null;
  checkerName?: string | null;
  lineCount?: number | null;
  size?: ManualShiftOrder['size'];
  comment?: string | null;
  status?: ManualShiftOrder['status'];
  startedAt?: string | null;
  checkStartedAt?: string | null;
  waitingCheckAt?: string | null;
  checkedAt?: string | null;
  finishedAt?: string | null;
  deletedAt?: string | null;
  deletedByProfileId?: string | null;
  deletedByName?: string | null;
  deleteReason?: string | null;
};

export type ManualShiftOrderCheckUnitPatch = {
  status?: ManualShiftOrderCheckUnit['status'];
  note?: string | null;
  reason?: string | null;
  checkedAt?: string | null;
  returnedAt?: string | null;
  voidedAt?: string | null;
  updatedByProfileId?: string | null;
  updatedByName?: string | null;
};

export type ManualShiftLinePatch = {
  name?: string;
  sortOrder?: number;
  deletedAt?: string | null;
  deletedByProfileId?: string | null;
  deletedByName?: string | null;
  deleteReason?: string | null;
};

export type MonthlyImportShiftCounts = {
  shiftId: string;
  activeLinesCount: number;
  activeOrdersCount: number;
  softDeletedLinesCount: number;
  softDeletedOrdersCount: number;
};

export type ManualShiftsRepo = {
  listShiftWorkers(shiftId: string): Promise<ManualShiftWorker[]>;
  findWorkerById(workerId: string): Promise<ManualShiftWorker | null>;
  findWorkerByAuthUserId(tenantId: string, authUserId: string): Promise<ManualShiftWorker | null>;
  setWorkerAuthUser(workerId: string, authUserId: string | null): Promise<void>;
  listBindableUsers(tenantId: string): Promise<BindableUser[]>;
  createWorker(input: {
    tenantId: string;
    shiftId: string;
    name: string;
    role: ManualShiftWorkerRole;
    sortOrder: number;
    authUserId?: string | null;
  }): Promise<ManualShiftWorker>;
  updateWorker(workerId: string, patch: {
    name?: string;
    role?: ManualShiftWorkerRole;
    active?: boolean;
    sortOrder?: number;
    authUserId?: string | null;
  }): Promise<ManualShiftWorker | null>;
  findActiveShiftByDate(tenantId: string, date: string): Promise<ManualShiftSession | null>;
  findShiftByDate(tenantId: string, date: string): Promise<ManualShiftSession | null>;
  findShiftById(shiftId: string): Promise<ManualShiftSession | null>;
  createShift(input: {
    tenantId: string;
    date: string;
    name: string;
    createdByProfileId: string | null;
    createdByName: string | null;
  }): Promise<ManualShiftSession>;
  closeShift(shiftId: string, closedAt: string): Promise<ManualShiftSession | null>;
  listShiftLines(shiftId: string): Promise<ManualShiftLineRow[]>;
  listShiftLineSummaries(shiftId: string, tenantId: string): Promise<ManualShiftLineSummary[]>;
  findLineById(lineId: string): Promise<ManualShiftLineRow | null>;
  createLine(input: {
    tenantId: string;
    shiftId: string;
    name: string;
    sortOrder: number;
  }): Promise<ManualShiftLineRow>;
  updateLine(lineId: string, patch: ManualShiftLinePatch): Promise<ManualShiftLineRow | null>;
  listShiftOrders(shiftId: string): Promise<ManualShiftOrder[]>;
  listLineOrders(lineId: string): Promise<ManualShiftOrder[]>;
  findOrderById(orderId: string): Promise<ManualShiftOrder | null>;
  listOrderCheckUnits(orderId: string): Promise<ManualShiftOrderCheckUnit[]>;
  listOrderAshlamot(orderId: string): Promise<ManualShiftOrderAshlama[]>;
  listOpenShiftAshlamot(tenantId: string, shiftId: string): Promise<OpenAshlamaBoardItem[]>;
  listOrderEvents(orderId: string): Promise<ManualShiftOrderEvent[]>;
  listOrderItems(tenantId: string, orderId: string): Promise<ManualShiftOrderItem[]>;
  listOrdersItemRollups(orderIds: string[]): Promise<Map<string, { lineCount: number; totalQuantity: number }>>;
  findOrderCheckUnitById(checkUnitId: string): Promise<ManualShiftOrderCheckUnit | null>;
  findOrderAshlamaById(ashlamaId: string): Promise<ManualShiftOrderAshlama | null>;
  countMonthlyImportShiftRows(input: {
    tenantId: string;
    shiftId: string;
  }): Promise<MonthlyImportShiftCounts>;
  createOrderCheckUnit(input: {
    tenantId: string;
    shiftId: string;
    lineId: string;
    orderId: string;
    status: ManualShiftOrderCheckUnit['status'];
    note: string | null;
    reason: string | null;
    createdByProfileId: string | null;
    createdByName: string | null;
  }): Promise<ManualShiftOrderCheckUnit>;
  updateOrderCheckUnit(
    checkUnitId: string,
    patch: ManualShiftOrderCheckUnitPatch
  ): Promise<ManualShiftOrderCheckUnit | null>;
  createOrderAshlama(input: {
    tenantId: string;
    shiftId: string;
    lineId: string;
    orderId: string;
    checkUnitId: string | null;
    source: ManualShiftOrderAshlama['source'];
    status: ManualShiftOrderAshlama['status'];
    text: string;
    createdByProfileId: string | null;
    createdByName: string | null;
  }): Promise<ManualShiftOrderAshlama>;
  updateOrderAshlama(
    ashlamaId: string,
    patch: {
      status?: ManualShiftOrderAshlama['status'];
      updatedByProfileId?: string | null;
      updatedByName?: string | null;
    }
  ): Promise<ManualShiftOrderAshlama | null>;
  createOrder(input: {
    tenantId: string;
    shiftId: string;
    lineId: string;
    orderNumber: string | null;
    customerName: string | null;
    pointName: string | null;
    palletCount: number | null;
    pickerName: string | null;
    pickerWorkerId: string | null;
    checkerName: string | null;
    lineCount: number | null;
    sortOrder?: number | null;
    size: ManualShiftOrder['size'];
    status: ManualShiftOrder['status'];
    startedAt: string | null;
    comment: string | null;
  }): Promise<ManualShiftOrder>;
  applyDailyImport(input: {
    tenantId: string;
    shiftId: string;
    preview: DailyManualShiftImportPreview;
  }): Promise<ApplyDailyManualShiftImportResponse>;
  applyMonthlyImport(input: {
    tenantId: string;
    shiftId: string;
    selectedDate: string;
    plan: ManualShiftMonthlyApplyPlan;
  }): Promise<ManualShiftMonthlyApplyResponse>;
  updateOrder(orderId: string, patch: ManualShiftOrderPatch): Promise<ManualShiftOrder | null>;
  createOrderEvent(input: {
    tenantId: string;
    shiftId: string;
    lineId: string;
    orderId: string;
    eventType: ManualShiftOrderEvent['eventType'];
    actorProfileId: string | null;
    actorName: string | null;
    fromStatus: ManualShiftOrderEvent['fromStatus'];
    toStatus: ManualShiftOrderEvent['toStatus'];
    payload: Record<string, unknown> | null;
  }): Promise<ManualShiftOrderEvent>;
  createLineEvent(input: {
    tenantId: string;
    shiftId: string;
    lineId: string;
    eventType: ManualShiftLineEvent['eventType'];
    actorProfileId: string | null;
    actorName: string | null;
    payload: Record<string, unknown> | null;
  }): Promise<ManualShiftLineEvent>;
  createOrderError(input: {
    tenantId: string;
    shiftId: string;
    lineId: string;
    orderId: string;
    type: ManualShiftOrderError['type'];
    comment: string | null;
    createdByProfileId: string | null;
    createdByName: string | null;
  }): Promise<ManualShiftOrderError>;
  listShiftErrors(shiftId: string): Promise<ManualShiftOrderError[]>;
  listShiftCheckUnits(shiftId: string): Promise<ManualShiftOrderCheckUnit[]>;
  listShiftAshlamot(shiftId: string): Promise<ManualShiftOrderAshlama[]>;
  listShiftWorkHierarchy(shiftId: string): Promise<ManualShiftWorkHierarchyResponse>;
};

export function createManualShiftsRepo(supabase: SupabaseClient): ManualShiftsRepo {
  return {
    async listShiftWorkers(shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_workers')
        .select(workerColumns)
        .eq('shift_id', shiftId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as ManualShiftWorkerRow[]).map(mapWorkerRow);
    },

    async findWorkerById(workerId) {
      const { data, error } = await supabase
        .from('manual_shift_workers')
        .select(workerColumns)
        .eq('id', workerId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapWorkerRow(data as ManualShiftWorkerRow) : null;
    },

    async findWorkerByAuthUserId(tenantId, authUserId) {
      const { data, error } = await supabase
        .from('manual_shift_workers')
        .select(workerColumns)
        .eq('tenant_id', tenantId)
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapWorkerRow(data as ManualShiftWorkerRow) : null;
    },

    async listBindableUsers(tenantId) {
      const { data, error } = await supabase.rpc('list_manual_shift_bindable_users', {
        p_tenant_id: tenantId
      });

      if (error) throw error;
      return (data ?? []).map((row: {
        user_id: string;
        display_name: string | null;
        email: string | null;
        bound_worker_id: string | null;
      }): BindableUser => ({
        userId: row.user_id,
        displayName: row.display_name,
        email: row.email,
        boundWorkerId: row.bound_worker_id
      }));
    },

    async setWorkerAuthUser(workerId, authUserId) {
      const { error } = await supabase.rpc('set_manual_shift_worker_auth_user', {
        p_worker_id: workerId,
        p_auth_user_id: authUserId
      });

      if (error) throw error;
    },

    async createWorker(input) {
      const { data, error } = await supabase
        .from('manual_shift_workers')
        .insert({
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          name: input.name,
          role: input.role,
          sort_order: input.sortOrder,
          auth_user_id: input.authUserId ?? null
        })
        .select(workerColumns)
        .single();

      if (error) throw error;
      return mapWorkerRow(data as ManualShiftWorkerRow);
    },

    async updateWorker(workerId, patch) {
      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.role !== undefined) payload.role = patch.role;
      if (patch.active !== undefined) payload.active = patch.active;
      if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;
      if (patch.authUserId !== undefined) payload.auth_user_id = patch.authUserId;

      const { data, error } = await supabase
        .from('manual_shift_workers')
        .update(payload)
        .eq('id', workerId)
        .select(workerColumns)
        .maybeSingle();

      if (error) throw error;
      return data ? mapWorkerRow(data as ManualShiftWorkerRow) : null;
    },

    async findActiveShiftByDate(tenantId, date) {
      const { data, error } = await supabase
        .from('manual_shift_sessions')
        .select(sessionColumns)
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapSessionRow(data as ManualShiftSessionRow) : null;
    },

    async findShiftByDate(tenantId, date) {
      const { data, error } = await supabase
        .from('manual_shift_sessions')
        .select(sessionColumns)
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ? mapSessionRow(data as ManualShiftSessionRow) : null;
    },

    async findShiftById(shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_sessions')
        .select(sessionColumns)
        .eq('id', shiftId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapSessionRow(data as ManualShiftSessionRow) : null;
    },

    async createShift(input) {
      const { data, error } = await supabase
        .from('manual_shift_sessions')
        .insert({
          tenant_id: input.tenantId,
          date: input.date,
          name: input.name,
          status: 'active',
          created_by_profile_id: input.createdByProfileId,
          created_by_name: input.createdByName
        })
        .select(sessionColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapSessionRow(data as ManualShiftSessionRow);
    },

    async closeShift(shiftId, closedAt) {
      const { data, error } = await supabase
        .from('manual_shift_sessions')
        .update({
          status: 'closed',
          closed_at: closedAt
        })
        .eq('id', shiftId)
        .select(sessionColumns)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapSessionRow(data as ManualShiftSessionRow) : null;
    },

    async listShiftLines(shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_lines')
        .select(lineColumns)
        .eq('shift_id', shiftId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as ManualShiftLineRow[];
    },

    async listShiftLineSummaries(shiftId, tenantId) {
      const { data, error } = await supabase.rpc('manual_shift_list_line_summaries', {
        p_shift_id: shiftId,
        p_tenant_id: tenantId
      });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ManualShiftLineSummaryAggRow[]).map(mapLineSummaryAggRow);
    },

    async findLineById(lineId) {
      const { data, error } = await supabase
        .from('manual_shift_lines')
        .select(lineColumns)
        .eq('id', lineId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as ManualShiftLineRow | null) ?? null;
    },

    async createLine(input) {
      const { data, error } = await supabase
        .from('manual_shift_lines')
        .insert({
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          name: input.name,
          sort_order: input.sortOrder
        })
        .select(lineColumns)
        .single();

      if (error) {
        throw error;
      }

      return data as ManualShiftLineRow;
    },

    async updateLine(lineId, patch) {
      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;
      if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt;
      if (patch.deletedByProfileId !== undefined) payload.deleted_by_profile_id = patch.deletedByProfileId;
      if (patch.deletedByName !== undefined) payload.deleted_by_name = patch.deletedByName;
      if (patch.deleteReason !== undefined) payload.delete_reason = patch.deleteReason;

      const { data, error } = await supabase
        .from('manual_shift_lines')
        .update(payload)
        .eq('id', lineId)
        .select(lineColumns)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as ManualShiftLineRow | null) ?? null;
    },

    async listShiftOrders(shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_orders')
        .select(orderColumns)
        .eq('shift_id', shiftId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ManualShiftOrderRow[]).map(mapOrderRow);
    },

    async listLineOrders(lineId) {
      const { data, error } = await supabase
        .from('manual_shift_orders')
        .select(orderColumns)
        .eq('line_id', lineId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ManualShiftOrderRow[]).map(mapOrderRow);
    },

    async findOrderById(orderId) {
      const { data, error } = await supabase
        .from('manual_shift_orders')
        .select(orderColumns)
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapOrderRow(data as ManualShiftOrderRow) : null;
    },

    async listOrderCheckUnits(orderId) {
      const { data, error } = await supabase
        .from('manual_shift_order_check_units')
        .select(checkUnitColumns)
        .eq('order_id', orderId)
        .order('unit_number', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ManualShiftOrderCheckUnitRow[]).map(mapCheckUnitRow);
    },

    async findOrderCheckUnitById(checkUnitId) {
      const { data, error } = await supabase
        .from('manual_shift_order_check_units')
        .select(checkUnitColumns)
        .eq('id', checkUnitId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapCheckUnitRow(data as ManualShiftOrderCheckUnitRow) : null;
    },

    async listOrderAshlamot(orderId) {
      const { data, error } = await supabase
        .from('manual_shift_order_ashlamot')
        .select(ashlamaColumns)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data ?? []) as ManualShiftOrderAshlamaRow[]).map(mapAshlamaRow);
    },

    async listOpenShiftAshlamot(tenantId, shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_order_ashlamot')
        .select(
          'id,shift_id,line_id,order_id,check_unit_id,source,text,created_at,' +
          'manual_shift_orders!inner(order_number,point_name),' +
          'manual_shift_lines!inner(name)'
        )
        .eq('tenant_id', tenantId)
        .eq('shift_id', shiftId)
        .eq('status', 'open')
        .filter('manual_shift_orders.deleted_at', 'is', null)
        .filter('manual_shift_lines.deleted_at', 'is', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as unknown as OpenAshlamaBoardItemRow[]).map(mapOpenAshlamaBoardItemRow);
    },

    async listOrderEvents(orderId) {
      const { data, error } = await supabase
        .from('manual_shift_order_events')
        .select(eventColumns)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data ?? []) as ManualShiftOrderEventRow[]).map(mapEventRow);
    },

    async listOrderItems(tenantId, orderId) {
      const { data, error } = await supabase
        .from('manual_shift_order_items')
        .select(itemColumns)
        .eq('tenant_id', tenantId)
        .eq('order_id', orderId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as ManualShiftOrderItemRow[]).map(mapOrderItemRow);
    },

    async listOrdersItemRollups(orderIds) {
      if (orderIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from('manual_shift_order_items')
        .select('order_id, quantity')
        .in('order_id', orderIds);

      if (error) throw error;

      const rows = (data ?? []) as Array<{ order_id: string; quantity: number }>;
      const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();

      for (const row of rows) {
        let entry = rollups.get(row.order_id);
        if (!entry) {
          entry = { lineCount: 0, totalQuantity: 0 };
          rollups.set(row.order_id, entry);
        }
        entry.lineCount += 1;
        entry.totalQuantity += row.quantity;
      }

      return rollups;
    },

    async countMonthlyImportShiftRows({ tenantId, shiftId }) {
      const [
        activeLinesResult,
        softDeletedLinesResult,
        activeOrdersResult,
        softDeletedOrdersResult
      ] = await Promise.all([
        supabase
          .from('manual_shift_lines')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId)
          .is('deleted_at', null),
        supabase
          .from('manual_shift_lines')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId)
          .not('deleted_at', 'is', null),
        supabase
          .from('manual_shift_orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId)
          .is('deleted_at', null),
        supabase
          .from('manual_shift_orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId)
          .not('deleted_at', 'is', null)
      ]);

      const errors = [
        activeLinesResult.error,
        softDeletedLinesResult.error,
        activeOrdersResult.error,
        softDeletedOrdersResult.error
      ].filter(Boolean);

      if (errors.length > 0) {
        throw errors[0];
      }

      return {
        shiftId,
        activeLinesCount: activeLinesResult.count ?? 0,
        activeOrdersCount: activeOrdersResult.count ?? 0,
        softDeletedLinesCount: softDeletedLinesResult.count ?? 0,
        softDeletedOrdersCount: softDeletedOrdersResult.count ?? 0
      };
    },

    async findOrderAshlamaById(ashlamaId) {
      const { data, error } = await supabase
        .from('manual_shift_order_ashlamot')
        .select(ashlamaColumns)
        .eq('id', ashlamaId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapAshlamaRow(data as ManualShiftOrderAshlamaRow) : null;
    },

    async createOrderCheckUnit(input) {
      for (let attempt = 1; attempt <= CHECK_UNIT_NUMBER_RETRY_LIMIT; attempt += 1) {
        const { count, error: countError } = await supabase
          .from('manual_shift_order_check_units')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', input.orderId);

        if (countError) {
          throw countError;
        }

        const nextUnitNumber = (count ?? 0) + 1;

        const { data, error } = await supabase
          .from('manual_shift_order_check_units')
          .insert({
            tenant_id: input.tenantId,
            shift_id: input.shiftId,
            line_id: input.lineId,
            order_id: input.orderId,
            unit_number: nextUnitNumber,
            status: input.status,
            note: input.note,
            reason: input.reason,
            created_by_profile_id: input.createdByProfileId,
            created_by_name: input.createdByName,
            updated_by_profile_id: input.createdByProfileId,
            updated_by_name: input.createdByName
          })
          .select(checkUnitColumns)
          .single();

        if (!error) {
          return mapCheckUnitRow(data as ManualShiftOrderCheckUnitRow);
        }

        if (!isCheckUnitNumberUniqueConflict(error)) {
          throw error;
        }

        if (attempt === CHECK_UNIT_NUMBER_RETRY_LIMIT) {
          const wrapped = new Error('MANUAL_SHIFT_ORDER_CHECK_UNIT_NUMBER_CONFLICT');
          (wrapped as Error & { cause?: unknown }).cause = error;
          throw wrapped;
        }
      }

      throw new Error('MANUAL_SHIFT_ORDER_CHECK_UNIT_NUMBER_CONFLICT');
    },

    async updateOrderCheckUnit(checkUnitId, patch) {
      const payload: Record<string, unknown> = {};
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.note !== undefined) payload.note = patch.note;
      if (patch.reason !== undefined) payload.reason = patch.reason;
      if (patch.checkedAt !== undefined) payload.checked_at = patch.checkedAt;
      if (patch.returnedAt !== undefined) payload.returned_at = patch.returnedAt;
      if (patch.voidedAt !== undefined) payload.voided_at = patch.voidedAt;
      if (patch.updatedByProfileId !== undefined) payload.updated_by_profile_id = patch.updatedByProfileId;
      if (patch.updatedByName !== undefined) payload.updated_by_name = patch.updatedByName;

      const { data, error } = await supabase
        .from('manual_shift_order_check_units')
        .update(payload)
        .eq('id', checkUnitId)
        .select(checkUnitColumns)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapCheckUnitRow(data as ManualShiftOrderCheckUnitRow) : null;
    },

    async createOrderAshlama(input) {
      const { data, error } = await supabase
        .from('manual_shift_order_ashlamot')
        .insert({
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          line_id: input.lineId,
          order_id: input.orderId,
          check_unit_id: input.checkUnitId,
          source: input.source,
          status: input.status,
          text: input.text,
          created_by_profile_id: input.createdByProfileId,
          created_by_name: input.createdByName,
          updated_by_profile_id: input.createdByProfileId,
          updated_by_name: input.createdByName
        })
        .select(ashlamaColumns)
        .single();

      if (error) throw error;
      return mapAshlamaRow(data as ManualShiftOrderAshlamaRow);
    },

    async updateOrderAshlama(ashlamaId, patch) {
      const payload: Record<string, unknown> = {};
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.updatedByProfileId !== undefined) payload.updated_by_profile_id = patch.updatedByProfileId;
      if (patch.updatedByName !== undefined) payload.updated_by_name = patch.updatedByName;

      const { data, error } = await supabase
        .from('manual_shift_order_ashlamot')
        .update(payload)
        .eq('id', ashlamaId)
        .select(ashlamaColumns)
        .maybeSingle();

      if (error) throw error;
      return data ? mapAshlamaRow(data as ManualShiftOrderAshlamaRow) : null;
    },

    async createOrder(input) {
      const { data, error } = await supabase
        .from('manual_shift_orders')
        .insert({
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          line_id: input.lineId,
          order_number: input.orderNumber,
          customer_name: input.customerName,
          point_name: input.pointName,
          pallet_count: input.palletCount,
          picker_name: input.pickerName,
          picker_worker_id: input.pickerWorkerId,
          checker_name: input.checkerName,
          line_count: input.lineCount,
          sort_order: input.sortOrder ?? null,
          size: input.size,
          status: input.status,
          started_at: input.startedAt,
          comment: input.comment
        })
        .select(orderColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapOrderRow(data as ManualShiftOrderRow);
    },

    async applyDailyImport(input) {
      const { data, error } = await supabase.rpc('manual_shift_apply_daily_import', {
        p_tenant_id: input.tenantId,
        p_shift_id: input.shiftId,
        p_preview: input.preview
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return {
        shiftId: row.shift_id,
        linesCreated: Number(row.lines_created ?? 0),
        ordersCreated: Number(row.orders_created ?? 0)
      };
    },

    async applyMonthlyImport(input) {
      const { data, error } = await supabase.rpc('manual_shift_apply_monthly_import', {
        p_tenant_id: input.tenantId,
        p_shift_id: input.shiftId,
        p_selected_date: input.selectedDate,
        p_plan: input.plan
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return {
        shiftId: row.shift_id,
        selectedDate: input.selectedDate,
        linesCreated: Number(row.lines_created ?? 0),
        ordersCreated: Number(row.orders_created ?? 0),
        orderItemsCreated: Number(row.order_items_created ?? 0),
        appliedGroups: Number(row.applied_groups ?? input.plan.appliedGroups),
        skippedGroups: Number(row.skipped_groups ?? input.plan.skippedGroups),
        skippedNegativeQuantityRows: Number(row.skipped_negative_quantity_rows ?? input.plan.skippedNegativeQuantityRows),
        skippedZeroQuantityRows: Number(row.skipped_zero_quantity_rows ?? input.plan.skippedZeroQuantityRows),
        warningSummary: input.plan.warningSummary,
        warnings: input.plan.preview.warnings,
        previewTotals: input.plan.preview.totals,
        previewAnomalies: input.plan.preview.anomalies
      };
    },

    async updateOrder(orderId, patch) {
      const payload: Record<string, unknown> = {};
      if (patch.orderNumber !== undefined) payload.order_number = patch.orderNumber;
      if (patch.customerName !== undefined) payload.customer_name = patch.customerName;
      if (patch.pointName !== undefined) payload.point_name = patch.pointName;
      if (patch.palletCount !== undefined) payload.pallet_count = patch.palletCount;
      if (patch.pickerName !== undefined) payload.picker_name = patch.pickerName;
      if (patch.pickerWorkerId !== undefined) payload.picker_worker_id = patch.pickerWorkerId;
      if (patch.checkerName !== undefined) payload.checker_name = patch.checkerName;
      if (patch.lineCount !== undefined) payload.line_count = patch.lineCount;
      if (patch.size !== undefined) payload.size = patch.size;
      if (patch.comment !== undefined) payload.comment = patch.comment;
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.startedAt !== undefined) payload.started_at = patch.startedAt;
      if (patch.checkStartedAt !== undefined) payload.check_started_at = patch.checkStartedAt;
      if (patch.waitingCheckAt !== undefined) payload.waiting_check_at = patch.waitingCheckAt;
      if (patch.checkedAt !== undefined) payload.checked_at = patch.checkedAt;
      if (patch.finishedAt !== undefined) payload.finished_at = patch.finishedAt;
      if (patch.deletedAt !== undefined) payload.deleted_at = patch.deletedAt;
      if (patch.deletedByProfileId !== undefined) payload.deleted_by_profile_id = patch.deletedByProfileId;
      if (patch.deletedByName !== undefined) payload.deleted_by_name = patch.deletedByName;
      if (patch.deleteReason !== undefined) payload.delete_reason = patch.deleteReason;

      const { data, error } = await supabase
        .from('manual_shift_orders')
        .update(payload)
        .eq('id', orderId)
        .select(orderColumns)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapOrderRow(data as ManualShiftOrderRow) : null;
    },

    async createOrderEvent(input) {
      const { data, error } = await supabase
        .from('manual_shift_order_events')
        .insert({
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          line_id: input.lineId,
          order_id: input.orderId,
          event_type: input.eventType,
          actor_profile_id: input.actorProfileId,
          actor_name: input.actorName,
          from_status: input.fromStatus,
          to_status: input.toStatus,
          payload: input.payload
        })
        .select(eventColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapEventRow(data as ManualShiftOrderEventRow);
    },

    async createLineEvent(input) {
      const { data, error } = await supabase
        .from('manual_shift_line_events')
        .insert({
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          line_id: input.lineId,
          event_type: input.eventType,
          actor_profile_id: input.actorProfileId,
          actor_name: input.actorName,
          payload: input.payload
        })
        .select(lineEventColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapLineEventRow(data as ManualShiftLineEventRow);
    },

    async createOrderError(input) {
      const { data, error } = await supabase
        .from('manual_shift_order_errors')
        .insert({
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          line_id: input.lineId,
          order_id: input.orderId,
          type: input.type,
          comment: input.comment,
          created_by_profile_id: input.createdByProfileId,
          created_by_name: input.createdByName
        })
        .select(errorColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapErrorRow(data as ManualShiftOrderErrorRow);
    },

    async listShiftErrors(shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_order_errors')
        .select(errorColumns)
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ManualShiftOrderErrorRow[]).map(mapErrorRow);
    },

    async listShiftCheckUnits(shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_order_check_units')
        .select(checkUnitColumns)
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as ManualShiftOrderCheckUnitRow[]).map(mapCheckUnitRow);
    },

    async listShiftAshlamot(shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_order_ashlamot')
        .select(ashlamaColumns)
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as ManualShiftOrderAshlamaRow[]).map(mapAshlamaRow);
    },

    async listShiftWorkHierarchy(shiftId) {
      const [lineRows, orders, checkUnits, ashlamot] = await Promise.all([
        this.listShiftLines(shiftId),
        this.listShiftOrders(shiftId),
        this.listShiftCheckUnits(shiftId),
        this.listShiftAshlamot(shiftId)
      ]);

      const orderIds = orders.map((o) => o.id);
      const rollups = orderIds.length > 0
        ? await this.listOrdersItemRollups(orderIds)
        : new Map<string, { lineCount: number; totalQuantity: number }>();

      return buildShiftWorkHierarchy(shiftId, lineRows, orders, rollups, checkUnits, ashlamot);
    }
  };
}

export function mapManualShiftLineRowToDomain(
  row: ManualShiftLineRow,
  status: ManualShiftLine['status']
) {
  return mapLineRow(row, status);
}

function computeStatusBreakdown(
  orders: ReadonlyArray<{ status: string }>
): {
  queued: number;
  picking: number;
  waitingCheck: number;
  returned: number;
  done: number;
} {
  return {
    queued: orders.filter((o) => o.status === 'queued').length,
    picking: orders.filter((o) => o.status === 'picking').length,
    waitingCheck: orders.filter((o) => o.status === 'waiting_check').length,
    returned: orders.filter((o) => o.status === 'returned').length,
    done: orders.filter((o) => o.status === 'done').length
  };
}

function buildShiftWorkHierarchy(
  shiftId: string,
  lineRows: ManualShiftLineRow[],
  orders: ManualShiftOrder[],
  rollups: Map<string, { lineCount: number; totalQuantity: number }>,
  checkUnits: ManualShiftOrderCheckUnit[],
  ashlamot: ManualShiftOrderAshlama[]
): ManualShiftWorkHierarchyResponse {
  const checkUnitsByOrderId = new Map<string, ManualShiftOrderCheckUnit[]>();
  for (const cu of checkUnits) {
    const list = checkUnitsByOrderId.get(cu.orderId) ?? [];
    list.push(cu);
    checkUnitsByOrderId.set(cu.orderId, list);
  }

  const ashlamotByOrderId = new Map<string, ManualShiftOrderAshlama[]>();
  for (const a of ashlamot) {
    const list = ashlamotByOrderId.get(a.orderId) ?? [];
    list.push(a);
    ashlamotByOrderId.set(a.orderId, list);
  }

  const ordersByLineId = new Map<string, ManualShiftOrder[]>();
  for (const order of orders) {
    const list = ordersByLineId.get(order.lineId) ?? [];
    list.push(order);
    ordersByLineId.set(order.lineId, list);
  }

  const lines: ManualShiftWorkHierarchyLine[] = [];
  for (const row of lineRows) {
    const lineOrders = ordersByLineId.get(row.id) ?? [];

    const bucketsMap = new Map<string | null, ManualShiftOrder[]>();
    for (const order of lineOrders) {
      const bucketName = order.pointName;
      const list = bucketsMap.get(bucketName) ?? [];
      list.push(order);
      bucketsMap.set(bucketName, list);
    }

    const buckets: ManualShiftWorkHierarchyBucket[] = [];
    for (const [bucketName, bucketOrders] of bucketsMap) {
      const hierarchyOrders: ManualShiftWorkHierarchyOrder[] = bucketOrders.map((o) => {
        const rollup = rollups.get(o.id);
        const totalQuantity = rollup ? rollup.totalQuantity : 0;
        const orderCheckUnits = checkUnitsByOrderId.get(o.id) ?? [];
        const orderAshlamot = ashlamotByOrderId.get(o.id) ?? [];
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          pointName: o.pointName,
          status: o.status,
          totalQuantity,
          hasAshlama: orderAshlamot.some((a) => a.status === 'open'),
          hasCheckUnits: orderCheckUnits.length > 0
        };
      });

      buckets.push({
        bucketName,
        displayName: bucketName ?? 'קו ראשי',
        totalOrders: bucketOrders.length,
        totalQuantity: hierarchyOrders.reduce((s, o) => s + o.totalQuantity, 0),
        statusBreakdown: computeStatusBreakdown(bucketOrders),
        orders: hierarchyOrders
      });
    }

    buckets.sort((a, b) => {
      if (a.bucketName === null) return -1;
      if (b.bucketName === null) return 1;
      return a.bucketName.localeCompare(b.bucketName);
    });

    lines.push({
      lineId: row.id,
      lineGroupName: row.name,
      distributionArea: row.distribution_area,
      status: deriveManualShiftLineStatus(lineOrders),
      totalBuckets: buckets.length,
      totalOrders: lineOrders.length,
      totalQuantity: buckets.reduce((s, b) => s + b.totalQuantity, 0),
      statusBreakdown: computeStatusBreakdown(lineOrders),
      buckets
    });
  }

  const areasMap = new Map<string | null, ManualShiftWorkHierarchyLine[]>();
  for (const line of lines) {
    const area = line.distributionArea;
    const list = areasMap.get(area) ?? [];
    list.push(line);
    areasMap.set(area, list);
  }

  const areas: ManualShiftWorkHierarchyArea[] = [];
  for (const [areaName, areaLines] of areasMap) {
    const areaOrders = areaLines.flatMap((l) => l.buckets.flatMap((b) => b.orders));
    areas.push({
      areaName,
      displayName: areaName ?? 'ללא איזור',
      totalLines: areaLines.length,
      totalBuckets: areaLines.reduce((s, l) => s + l.totalBuckets, 0),
      totalOrders: areaOrders.length,
      totalQuantity: areaLines.reduce((s, l) => s + l.totalQuantity, 0),
      statusBreakdown: computeStatusBreakdown(areaOrders.map((o) => ({ status: o.status }))),
      lines: areaLines
    });
  }

  areas.sort((a, b) => {
    if (a.areaName === null) return -1;
    if (b.areaName === null) return 1;
    return a.areaName.localeCompare(b.areaName);
  });

  return {
    shiftId,
    areas
  };
}
