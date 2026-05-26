import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ManualShiftDaySummaryByError,
  ManualShiftLine,
  ManualShiftLineEvent,
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderError,
  ManualShiftOrderEvent,
  ManualShiftSession,
  ManualShiftWorker,
  ManualShiftWorkerRole
} from '@wos/domain';

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
  size: ManualShiftOrder['size'];
  status: ManualShiftOrder['status'];
  started_at: string | null;
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
  'id,tenant_id,shift_id,name,sort_order,created_at,deleted_at,deleted_by_profile_id,deleted_by_name,delete_reason';
const workerColumns =
  'id,tenant_id,shift_id,name,role,active,sort_order,created_at,updated_at';
const orderColumns =
  'id,tenant_id,shift_id,line_id,order_number,customer_name,point_name,pallet_count,picker_name,picker_worker_id,checker_name,line_count,size,status,started_at,waiting_check_at,checked_at,finished_at,comment,created_at,updated_at,deleted_at,deleted_by_profile_id,deleted_by_name,delete_reason';
const lineEventColumns =
  'id,tenant_id,shift_id,line_id,event_type,actor_name,actor_profile_id,payload,created_at';
const eventColumns =
  'id,tenant_id,shift_id,line_id,order_id,event_type,actor_name,actor_profile_id,from_status,to_status,payload,created_at';
const errorColumns =
  'id,tenant_id,shift_id,line_id,order_id,type,comment,created_by_name,created_at,fixed_at';

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
    size: row.size,
    status: row.status,
    startedAt: row.started_at,
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
  waitingCheckAt?: string | null;
  checkedAt?: string | null;
  finishedAt?: string | null;
  deletedAt?: string | null;
  deletedByProfileId?: string | null;
  deletedByName?: string | null;
  deleteReason?: string | null;
};

export type ManualShiftLinePatch = {
  name?: string;
  sortOrder?: number;
  deletedAt?: string | null;
  deletedByProfileId?: string | null;
  deletedByName?: string | null;
  deleteReason?: string | null;
};

export type ManualShiftsRepo = {
  listShiftWorkers(shiftId: string): Promise<ManualShiftWorker[]>;
  findWorkerById(workerId: string): Promise<ManualShiftWorker | null>;
  createWorker(input: {
    tenantId: string;
    shiftId: string;
    name: string;
    role: ManualShiftWorkerRole;
    sortOrder: number;
  }): Promise<ManualShiftWorker>;
  updateWorker(workerId: string, patch: {
    name?: string;
    role?: ManualShiftWorkerRole;
    active?: boolean;
    sortOrder?: number;
  }): Promise<ManualShiftWorker | null>;
  findActiveShiftByDate(tenantId: string, date: string): Promise<ManualShiftSession | null>;
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
    size: ManualShiftOrder['size'];
    status: ManualShiftOrder['status'];
    startedAt: string | null;
    comment: string | null;
  }): Promise<ManualShiftOrder>;
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

    async createWorker(input) {
      const { data, error } = await supabase
        .from('manual_shift_workers')
        .insert({
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          name: input.name,
          role: input.role,
          sort_order: input.sortOrder
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
        .order('created_at', { ascending: true });

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
        .order('created_at', { ascending: true });

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
    }
  };
}

export function mapManualShiftLineRowToDomain(
  row: ManualShiftLineRow,
  status: ManualShiftLine['status']
) {
  return mapLineRow(row, status);
}
