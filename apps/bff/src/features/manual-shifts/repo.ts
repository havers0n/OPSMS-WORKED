import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApplyDailyManualShiftImportResponse,
  DemandImportAvailableBatchCard,
  DemandImportBatch,
  DemandImportBatchStatus,
  DemandImportDistributionAreaSummary,
  DailyManualShiftImportPreview,
  RawDemandRow,
  RawDemandRowStaging,
  ManualShiftMonthlyApplyPlan,
  ManualShiftMonthlyApplyResponse,
  ManualShiftMonthlyExcludedRow,
  ManualShiftMonthlyReplaceSafety,
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
  ManualShiftWorkHierarchyRouteGroup,
  ManualShiftWorkHierarchyWorkBucket,
  OpenAshlamaBoardItem,
  BucketProductRollupRow,
  DemandPlanningDraft,
  DemandPlanningBucket,
  DemandPlanningAllocation,
  DemandBacklogItem,
  DemandBacklogItemStatus,
  DemandBacklogSourceRow,
  DemandAvailableDemandSnapshot,
  DemandBacklogMergeAction,
  DemandPlanningPublishToShiftResponse,
  DemandPlanningPublication,
  DemandPlanningRevertPublicationResponse,
  DemandBacklogRepairResponse,
  RollingResolverBatch,
  RollingResolverRawRow,
  RollingResolverPublishedAllocation
} from '@wos/domain';

export type ProductControlDemandRow = {
  sku: string;
  description: string | null;
  category: string | null;
  demandQty: number;
  orderCount: number;
  lineCount: number;
};

export type ProductControlWarehouseStockRow = {
  sku: string;
  warehouseQty: number;
  canonicalProductIds: string[];
};
import {
  classifyRouteFragments,
  deriveManualShiftLineStatus,
  type ClassificationConfidence,
  type RouteFragmentInput
} from '@wos/domain';

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
  raw_route_line: string | null;
  route_base: string | null;
  work_bucket_name: string | null;
  work_bucket_type: string | null;
  source_zone: string | null;
  raw_destination_label: string | null;
  delivery_point_id: string | null;
  delivery_point_name: string | null;
  delivery_point_match_status: string;
  delivery_point_alias_text: string | null;
  delivery_point_alias_id: string | null;
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

type DemandImportBatchRow = {
  id: string;
  tenant_id: string;
  source_file: string;
  source_sheet: string;
  uploaded_by: string | null;
  uploaded_at: string;
  status: DemandImportBatchStatus;
  rows_count: number;
  raw_rows_count: number;
  warning_rows_count: number;
  error_rows_count: number;
  special_flow_rows_count: number;
  distribution_areas_count: number;
  distinct_orders_count: number;
  distinct_sku_count: number;
};

type RawDemandRowRow = {
  id: string;
  tenant_id: string;
  batch_id: string;
  source_sheet: string;
  source_row_number: number;
  agent: string | null;
  order_date: string | null;
  customer_name: string | null;
  order_number: string | null;
  sku: string | null;
  description: string | null;
  category: string | null;
  quantity: number | null;
  cost: number | null;
  notes: string | null;
  distribution_area: string | null;
  raw_route_line: string | null;
  planned_delivery_date_raw: string | null;
  planned_delivery_date: string | null;
  planned_route_line: string | null;
  planned_work_bucket: string | null;
  planning_status: RawDemandRow['planningStatus'];
  route_flow: RawDemandRow['routeFlow'];
  product_handling_flow: RawDemandRow['productHandlingFlow'];
  note_date_hints: RawDemandRow['noteDateHints'] | null;
  issues: RawDemandRow['issues'] | null;
  created_at: string;
};

const sessionColumns =
  'id,tenant_id,date,name,status,created_by_name,created_at,closed_at';
const lineColumns =
  'id,tenant_id,shift_id,name,distribution_area,sort_order,created_at,deleted_at,deleted_by_profile_id,deleted_by_name,delete_reason';
const workerColumns =
  'id,tenant_id,shift_id,name,role,active,sort_order,auth_user_id,created_at,updated_at';
const orderColumns =
  'id,tenant_id,shift_id,line_id,order_number,customer_name,point_name,pallet_count,picker_name,picker_worker_id,checker_name,line_count,sort_order,size,status,started_at,check_started_at,waiting_check_at,checked_at,finished_at,comment,created_at,updated_at,deleted_at,deleted_by_profile_id,deleted_by_name,delete_reason,raw_route_line,route_base,work_bucket_name,work_bucket_type,source_zone,raw_destination_label,delivery_point_id,delivery_point_name,delivery_point_match_status,delivery_point_alias_text,delivery_point_alias_id';
const checkUnitColumns =
  'id,tenant_id,shift_id,line_id,order_id,unit_number,status,note,reason,checked_at,returned_at,voided_at,created_at,updated_at';
const ashlamaColumns =
  'id,tenant_id,shift_id,line_id,order_id,check_unit_id,source,status,text,created_at,updated_at';
const itemColumns =
  'id,tenant_id,shift_id,line_id,order_id,sku,description,category,quantity,notes,zone,source_sheet,source_rows,source_file,sort_order,created_at';
const demandImportBatchColumns =
  'id,tenant_id,source_file,source_sheet,uploaded_by,uploaded_at,status,rows_count,raw_rows_count,warning_rows_count,error_rows_count,special_flow_rows_count,distribution_areas_count,distinct_orders_count,distinct_sku_count';
const rawDemandRowColumns =
  'id,tenant_id,batch_id,source_sheet,source_row_number,agent,order_date,customer_name,order_number,sku,description,category,quantity,cost,notes,distribution_area,raw_route_line,planned_delivery_date_raw,planned_delivery_date,planned_route_line,planned_work_bucket,planning_status,route_flow,product_handling_flow,note_date_hints,issues,created_at';
const demandBacklogItemColumns =
  'id,tenant_id,identity_key,status,total_quantity,order_number,customer_name,sku,description,category,distribution_area,product_handling_flow,route_flow,first_seen_at,last_seen_at,last_quantity_changed_at,created_at,updated_at';
const demandBacklogSourceColumns =
  'id,tenant_id,backlog_item_id,raw_demand_row_id,batch_id,merge_action,previous_quantity,new_quantity,quantity_delta,quantity_at_import,created_at';
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

function mapDemandImportBatchRow(row: DemandImportBatchRow): DemandImportBatch {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceFile: row.source_file,
    sourceSheet: row.source_sheet,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    status: row.status,
    rowsCount: Number(row.rows_count ?? 0),
    rawRowsCount: Number(row.raw_rows_count ?? 0),
    warningRowsCount: Number(row.warning_rows_count ?? 0),
    errorRowsCount: Number(row.error_rows_count ?? 0),
    specialFlowRowsCount: Number(row.special_flow_rows_count ?? 0),
    distributionAreasCount: Number(row.distribution_areas_count ?? 0),
    distinctOrdersCount: Number(row.distinct_orders_count ?? 0),
    distinctSkuCount: Number(row.distinct_sku_count ?? 0)
  };
}

function mapRawDemandRow(row: RawDemandRowRow): RawDemandRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    batchId: row.batch_id,
    sourceSheet: row.source_sheet,
    sourceRowNumber: Number(row.source_row_number),
    agent: row.agent,
    orderDate: row.order_date,
    customerName: row.customer_name,
    orderNumber: row.order_number,
    sku: row.sku,
    description: row.description,
    category: row.category,
    quantity: row.quantity !== null ? Number(row.quantity) : null,
    cost: row.cost !== null ? Number(row.cost) : null,
    notes: row.notes,
    distributionArea: row.distribution_area,
    rawRouteLine: row.raw_route_line,
    plannedDeliveryDateRaw: row.planned_delivery_date_raw,
    plannedDeliveryDate: row.planned_delivery_date,
    plannedRouteLine: row.planned_route_line,
    plannedWorkBucket: row.planned_work_bucket,
    planningStatus: row.planning_status,
    routeFlow: row.route_flow,
    productHandlingFlow: row.product_handling_flow,
    noteDateHints: row.note_date_hints ?? [],
    issues: row.issues ?? [],
    createdAt: row.created_at
  };
}

// --- Demand Planning Draft Row types and mappers ---

type DemandPlanningDraftRow = {
  id: string;
  tenant_id: string;
  batch_id: string | null;
  source_kind: string;
  status: string;
  source_scope?: string;
  target_date: string | null;
  target_shift_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapDemandPlanningDraftRow(row: DemandPlanningDraftRow): DemandPlanningDraft {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    batchId: row.batch_id,
    sourceKind: (row.source_kind ?? 'batch') as DemandPlanningDraft['sourceKind'],
    status: row.status as DemandPlanningDraft['status'],
    sourceScope: (row.source_scope ?? 'all') as DemandPlanningDraft['sourceScope'],
    targetDate: row.target_date,
    targetShiftId: row.target_shift_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type DemandPlanningBucketRow = {
  id: string;
  tenant_id: string;
  draft_id: string;
  batch_id: string | null;
  distribution_area: string | null;
  planning_line_name: string;
  bucket_name: string;
  bucket_kind: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function mapDemandPlanningBucketRow(row: DemandPlanningBucketRow): DemandPlanningBucket {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    draftId: row.draft_id,
    batchId: row.batch_id,
    distributionArea: row.distribution_area,
    planningLineName: row.planning_line_name,
    bucketName: row.bucket_name,
    bucketKind: row.bucket_kind as DemandPlanningBucket['bucketKind'],
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type DemandPlanningAllocationRow = {
  id: string;
  tenant_id: string;
  draft_id: string;
  batch_id: string;
  raw_demand_row_id: string;
  bucket_id: string;
  allocated_quantity: number;
  created_at: string;
  updated_at: string;
};

function mapDemandPlanningAllocationRow(row: DemandPlanningAllocationRow): DemandPlanningAllocation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    draftId: row.draft_id,
    batchId: row.batch_id,
    rawDemandRowId: row.raw_demand_row_id,
    bucketId: row.bucket_id,
    allocatedQuantity: Number(row.allocated_quantity),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// --- Demand Planning Publication Row types and mappers ---

type DemandPlanningPublicationRow = {
  id: string;
  tenant_id: string;
  batch_id: string | null;
  draft_id: string;
  target_shift_id: string;
  source_kind: string;
  status: string;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
};

function mapDemandPlanningPublicationRow(row: DemandPlanningPublicationRow): DemandPlanningPublication {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    batchId: row.batch_id,
    draftId: row.draft_id,
    targetShiftId: row.target_shift_id,
    sourceKind: (row.source_kind ?? 'batch') as DemandPlanningPublication['sourceKind'],
    status: row.status as DemandPlanningPublication['status'],
    createdAt: row.created_at,
    revertedAt: row.reverted_at,
    revertedBy: row.reverted_by
  };
}

// --- Demand Backlog Row types and mappers ---

type DemandBacklogItemRow = {
  id: string;
  tenant_id: string;
  identity_key: string;
  status: string;
  total_quantity: number;
  order_number: string | null;
  customer_name: string | null;
  sku: string | null;
  description: string | null;
  category: string | null;
  distribution_area: string | null;
  product_handling_flow: string;
  route_flow: string;
  first_seen_at: string;
  last_seen_at: string;
  last_quantity_changed_at: string | null;
  created_at: string;
  updated_at: string;
};

type DemandBacklogSourceRowRaw = {
  id: string;
  tenant_id: string;
  backlog_item_id: string;
  raw_demand_row_id: string;
  batch_id: string;
  merge_action: string;
  previous_quantity: number | null;
  new_quantity: number | null;
  quantity_delta: number | null;
  quantity_at_import: number | null;
  created_at: string;
};

type DemandAvailableDemandPublishedAllocationRow = {
  raw_demand_row_id: string;
  published_quantity: number;
  publication_id: string | null;
};

type DemandAvailableDemandPublicationRow = {
  id: string;
  status: 'applied' | 'reverted';
};

function getEmbeddedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? first as Record<string, unknown> : null;
  }

  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function mapDemandBacklogItemRow(row: DemandBacklogItemRow): DemandBacklogItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    identityKey: row.identity_key,
    status: row.status as DemandBacklogItemStatus,
    totalQuantity: Number(row.total_quantity ?? 0),
    orderNumber: row.order_number,
    customerName: row.customer_name,
    sku: row.sku,
    description: row.description,
    category: row.category,
    distributionArea: row.distribution_area,
    productHandlingFlow: row.product_handling_flow as DemandBacklogItem['productHandlingFlow'],
    routeFlow: row.route_flow as DemandBacklogItem['routeFlow'],
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastQuantityChangedAt: row.last_quantity_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDemandBacklogSourceRow(row: DemandBacklogSourceRowRaw): DemandBacklogSourceRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    backlogItemId: row.backlog_item_id,
    rawDemandRowId: row.raw_demand_row_id,
    batchId: row.batch_id,
    mergeAction: row.merge_action as DemandBacklogMergeAction,
    previousQuantity: row.previous_quantity !== null ? Number(row.previous_quantity) : null,
    newQuantity: row.new_quantity !== null ? Number(row.new_quantity) : null,
    quantityDelta: row.quantity_delta !== null ? Number(row.quantity_delta) : null,
    createdAt: row.created_at
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
    deleteReason: row.delete_reason,
    rawRouteLine: row.raw_route_line,
    routeBase: row.route_base,
    workBucketName: row.work_bucket_name,
    workBucketType: row.work_bucket_type,
    sourceZone: row.source_zone,
    rawDestinationLabel: row.raw_destination_label,
    deliveryPointId: row.delivery_point_id,
    deliveryPointName: row.delivery_point_name,
    deliveryPointMatchStatus: row.delivery_point_match_status === 'not_attempted' || row.delivery_point_match_status === 'matched' || row.delivery_point_match_status === 'unmatched' || row.delivery_point_match_status === 'ambiguous'
      ? (row.delivery_point_match_status as ManualShiftOrder['deliveryPointMatchStatus'])
      : undefined,
    deliveryPointAliasText: row.delivery_point_alias_text,
    deliveryPointAliasId: row.delivery_point_alias_id
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
  rawDestinationLabel?: string | null;
  deliveryPointId?: string | null;
  deliveryPointName?: string | null;
  deliveryPointMatchStatus?: string;
  deliveryPointAliasText?: string | null;
  deliveryPointAliasId?: string | null;
  lineId?: string | null;
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
  findLineByShiftAndName(shiftId: string, lineName: string): Promise<ManualShiftLineRow | null>;
  listPickerSheetItems(lineId: string, workGroupName: string): Promise<ManualShiftOrderItem[]>;
  listPickerSheetLineItems(lineId: string): Promise<{
    orders: Array<{ id: string; workBucketName: string | null; pointName: string | null }>;
    items: ManualShiftOrderItem[];
  }>;
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
  applyDemandDataSheetImport?(input: {
    tenantId: string; sourceFile: string; sourceSheet: string; uploadedBy: string | null;
    summary: Record<string, number>; rows: RawDemandRowStaging[];
  }): Promise<{ batchId: string; repair: DemandBacklogRepairResponse }>;
  repairDemandBacklog?(input: {
    tenantId: string; batchId?: string; dryRun: boolean;
  }): Promise<DemandBacklogRepairResponse>;
  createDemandImportBatch(input: {
    tenantId: string;
    sourceFile: string;
    sourceSheet: string;
    uploadedBy: string | null;
    status: DemandImportBatchStatus;
    rowsCount: number;
    rawRowsCount: number;
    warningRowsCount: number;
    errorRowsCount: number;
    specialFlowRowsCount: number;
    distributionAreasCount: number;
    distinctOrdersCount: number;
    distinctSkuCount: number;
  }): Promise<DemandImportBatch>;
  insertRawDemandRows(input: {
    tenantId: string;
    batchId: string;
    sourceSheet: string;
    rows: RawDemandRowStaging[];
  }): Promise<void>;
  updateDemandImportBatchStatus(input: {
    tenantId: string;
    batchId: string;
    status: DemandImportBatchStatus;
  }): Promise<DemandImportBatch | null>;
  getDemandImportBatch(input: {
    tenantId: string;
    batchId: string;
  }): Promise<DemandImportBatch>;
  listRawDemandRowsByBatch(input: {
    tenantId: string;
    batchId: string;
    limit?: number;
  }): Promise<RawDemandRow[]>;
  listDemandImportBatches(input: {
    tenantId: string;
  }): Promise<DemandImportBatch[]>;
  listAvailableDemandImportBatches(input: {
    tenantId: string;
  }): Promise<DemandImportAvailableBatchCard[]>;
  listDemandBatchDistributionAreaSummary(input: {
    tenantId: string;
    batchId: string;
  }): Promise<DemandImportDistributionAreaSummary[]>;
  applyMonthlyImport(input: {
    tenantId: string;
    shiftId: string;
    selectedDate: string;
    plan: ManualShiftMonthlyApplyPlan;
    mode?: 'initial' | 'replace';
  }): Promise<ManualShiftMonthlyApplyResponse>;
  insertMonthlyImportExcludedRows(input: {
    tenantId: string;
    shiftId: string;
    sourceFile: string;
    sourceSheet: string;
    rows: Array<{
      sourceRowNumber: number;
      exclusionReason: string;
      orderNumber: string | null;
      customerName: string | null;
      sku: string | null;
      description: string | null;
      category: string | null;
      quantity: number | null;
      rawRouteLine: string | null;
      deliveryDate: string | null;
      notes: string | null;
    }>;
  }): Promise<void>;
  checkMonthlyReplaceSafety(input: {
    tenantId: string;
    shiftId: string;
  }): Promise<ManualShiftMonthlyReplaceSafety>;
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
  listShiftOrderItems(shiftId: string): Promise<ManualShiftOrderItem[]>;
  listShiftWorkHierarchy(shiftId: string): Promise<ManualShiftWorkHierarchyResponse>;
  listBucketProductRollup(input: {
    shiftId: string;
    lineId: string;
    bucketName: string;
    distributionArea?: string | null;
    sourceZone?: string | null;
    workBucketName?: string | null;
    sourceLineName?: string | null;
  }): Promise<BucketProductRollupRow[]>;
  listProductControlDemand(shiftId: string): Promise<ProductControlDemandRow[]>;
  listWarehouseStockBySku(skus: string[], tenantId: string): Promise<Map<string, ProductControlWarehouseStockRow>>;

  // Demand Planning Draft
  createDemandPlanningDraft(input: {
    tenantId: string;
    batchId: string;
    createdBy: string | null;
    sourceScope?: 'all' | 'remaining';
    targetDate?: string | null;
    targetShiftId?: string | null;
  }): Promise<DemandPlanningDraft>;
  createRollingDemandPlanningDraft(input: {
    tenantId: string;
    createdBy: string | null;
    targetDate: string;
    targetShiftId: string;
  }): Promise<DemandPlanningDraft>;
  getDemandPlanningDraft(input: {
    tenantId: string;
    draftId: string;
  }): Promise<DemandPlanningDraft | null>;
  updateDemandPlanningDraftStatus(input: {
    tenantId: string;
    draftId: string;
    status: string;
  }): Promise<DemandPlanningDraft | null>;
  deleteDemandPlanningBucketsByDraft(input: {
    tenantId: string;
    draftId: string;
  }): Promise<void>;
  insertDemandPlanningBuckets(input: {
    tenantId: string;
    draftId: string;
    batchId: string | null;
    buckets: Array<{
      distributionArea: string | null;
      planningLineName: string;
      bucketName: string;
      bucketKind: string;
      sortOrder: number;
    }>;
  }): Promise<DemandPlanningBucket[]>;
  listDemandPlanningBuckets(input: {
    tenantId: string;
    draftId: string;
  }): Promise<DemandPlanningBucket[]>;
  deleteDemandPlanningAllocationsByDraft(input: {
    tenantId: string;
    draftId: string;
  }): Promise<void>;
  insertDemandPlanningAllocations(input: {
    tenantId: string;
    draftId: string;
    batchId: string;
    allocations: Array<{
      rawDemandRowId: string;
      bucketId: string;
      allocatedQuantity: number;
      batchId?: string;
    }>;
  }): Promise<DemandPlanningAllocation[]>;
  listDemandPlanningAllocations(input: {
    tenantId: string;
    draftId: string;
  }): Promise<DemandPlanningAllocation[]>;
  listRawDemandRowsByIds(input: {
    tenantId: string;
    rowIds: string[];
  }): Promise<RawDemandRow[]>;
  listPublishedDemandQuantities?(input: {
    tenantId: string;
    batchId: string;
  }): Promise<Array<{ rawDemandRowId: string; publishedQuantity: number }>>;
  publishDemandPlanningDraftToShift(input: {
    tenantId: string;
    draftId: string;
    targetShiftId: string;
  }): Promise<DemandPlanningPublishToShiftResponse>;

  // Demand Planning Publication
  getDemandPlanningPublication(input: {
    tenantId: string;
    publicationId: string;
  }): Promise<DemandPlanningPublication | null>;

  revertDemandPlanningPublication(input: {
    tenantId: string;
    publicationId: string;
  }): Promise<DemandPlanningRevertPublicationResponse>;

  getDemandPlanningDraftPublication(input: {
    tenantId: string;
    draftId: string;
  }): Promise<DemandPlanningPublication | null>;

  // --- Demand Backlog ---

  findBacklogItemByIdentityKey(input: {
    tenantId: string;
    identityKey: string;
  }): Promise<DemandBacklogItem | null>;

  findBacklogSourceLinkByRawRowId(input: {
    tenantId: string;
    rawDemandRowId: string;
  }): Promise<DemandBacklogSourceRow | null>;

  createBacklogItem(input: {
    tenantId: string;
    identityKey: string;
    status: DemandBacklogItemStatus;
    totalQuantity: number;
    orderNumber: string | null;
    customerName: string | null;
    sku: string | null;
    description: string | null;
    category: string | null;
    distributionArea: string | null;
    productHandlingFlow: string;
    routeFlow: string;
  }): Promise<DemandBacklogItem>;

  updateBacklogItem(input: {
    tenantId: string;
    backlogItemId: string;
    patch: {
      totalQuantity?: number;
      status?: DemandBacklogItemStatus;
      description?: string | null;
      category?: string | null;
      lastSeenAt?: string;
      lastQuantityChangedAt?: string | null;
    };
  }): Promise<DemandBacklogItem>;

  createBacklogSourceLink(input: {
    tenantId: string;
    backlogItemId: string;
    rawDemandRowId: string;
    batchId: string;
    mergeAction: DemandBacklogMergeAction;
    previousQuantity: number | null;
    newQuantity: number | null;
    quantityDelta: number | null;
  }): Promise<DemandBacklogSourceRow>;

  listBacklogItems(input: {
    tenantId: string;
    status: 'open' | 'special_flow' | 'requires_review' | 'all';
    distributionArea?: string;
    search?: string;
    sourceBatchId?: string;
    page: number;
    limit: number;
  }): Promise<{ items: DemandBacklogItem[]; total: number }>;

  listBacklogItemAllocationsSum(input: {
    tenantId: string;
    backlogItemIds: string[];
  }): Promise<Array<{ backlogItemId: string; allocatedQuantity: number }>>;

  listBacklogSourceBatches(input: {
    tenantId: string;
    backlogItemIds: string[];
  }): Promise<Array<{
    backlogItemId: string;
    batchId: string;
    sourceFile: string;
    uploadedAt: string;
    mergeAction: string;
    quantityAtImport: number;
    previousQuantity: number | null;
    newQuantity: number | null;
    quantityDelta: number | null;
  }>>;

  getBacklogSummary(input: {
    tenantId: string;
    status: 'open' | 'special_flow' | 'requires_review' | 'all';
    distributionArea?: string;
    search?: string;
    sourceBatchId?: string;
  }): Promise<{
    totalItems: number;
    byStatus: Array<{ label: string; count: number }>;
    byDistributionArea: Array<{ distributionArea: string | null; count: number; totalOpenQuantity: number }>;
    oldestItemSeenAt: string | null;
    newestItemSeenAt: string | null;
    totalOpenQuantity: number;
    totalAllocatedQuantity: number;
  }>;

  getAvailableDemandSnapshot?(input: {
    tenantId: string;
  }): Promise<DemandAvailableDemandSnapshot>;

  countBacklogDistinctBatches(input: {
    tenantId: string;
  }): Promise<number>;

  listBacklogOrderAggregationRows(input: {
    tenantId: string;
  }): Promise<Array<{
    backlogItemId: string;
    backlogItemOrderNumber: string | null;
    backlogItemCustomerName: string | null;
    backlogItemSku: string | null;
    backlogItemDistributionArea: string | null;
    backlogItemTotalQuantity: number;
    backlogItemFirstSeenAt: string;
    backlogItemLastSeenAt: string;
    backlogItemStatus: string;
    rawDemandRowId: string;
    rawRowPlannedDeliveryDate: string | null;
    rawRowRouteLine: string | null;
    rawRowPlanningStatus: string;
    rawRowRouteFlow: string;
    rawRowProductHandlingFlow: string;
    rawRowQuantity: number | null;
    rawRowDescription?: string | null;
    rawRowCategory?: string | null;
    rawRowNotes?: string | null;
    sourceLinkBatchId: string;
    batchSourceFile: string;
    batchUploadedAt?: string;
    batchStatus?: string;
    batchRowsCount?: number;
    publishedQuantity: number;
  }>>;

  listReadyBatches(input: {
    tenantId: string;
  }): Promise<RollingResolverBatch[]>;

  listRawDemandRowsForBatches(input: {
    tenantId: string;
    batchIds: string[];
  }): Promise<RollingResolverRawRow[]>;

  listPublishedAllocationsForRolling(input: {
    tenantId: string;
  }): Promise<RollingResolverPublishedAllocation[]>;
};

function mapBatchRowToRollingResolver(row: DemandImportBatchRow): RollingResolverBatch {
  return {
    id: row.id,
    sourceFile: row.source_file,
    uploadedAt: row.uploaded_at,
    status: row.status,
    rowsCount: Number(row.rows_count ?? 0)
  };
}

function mapRawDemandRowToRollingResolver(row: RawDemandRowRow): RollingResolverRawRow {
  return {
    id: row.id,
    batchId: row.batch_id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    sku: row.sku,
    description: row.description,
    category: row.category,
    quantity: row.quantity !== null ? Number(row.quantity) : null,
    notes: row.notes,
    distributionArea: row.distribution_area,
    rawRouteLine: row.raw_route_line,
    plannedDeliveryDate: row.planned_delivery_date,
    planningStatus: row.planning_status,
    routeFlow: row.route_flow,
    productHandlingFlow: row.product_handling_flow
  };
}

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

    async findLineByShiftAndName(shiftId, lineName) {
      const { data, error } = await supabase
        .from('manual_shift_lines')
        .select(lineColumns)
        .eq('shift_id', shiftId)
        .eq('name', lineName)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as ManualShiftLineRow | null) ?? null;
    },

    async listPickerSheetItems(lineId, workGroupName) {
      const normalizedWorkGroupName = normalizeOptionalString(workGroupName);
      if (normalizedWorkGroupName === null) return [];

      const { data: orders, error: ordersError } = await supabase
        .from('manual_shift_orders')
        .select('id,work_bucket_name,point_name')
        .eq('line_id', lineId)
        .is('deleted_at', null);

      if (ordersError) throw ordersError;

      const matchingOrders = (orders ?? []).filter((row: { work_bucket_name?: string | null; point_name?: string | null }) => {
        const workBucketName = normalizeOptionalString(row.work_bucket_name ?? null);

        if (normalizedWorkGroupName === 'כללי') {
          return workBucketName === null || workBucketName === 'כללי';
        }

        if (workBucketName !== null) {
          return workBucketName === normalizedWorkGroupName;
        }

        const legacyPointName = normalizeOptionalString(row.point_name ?? null);
        return legacyPointName === normalizedWorkGroupName;
      });

      const orderIds = matchingOrders.map((row: { id: string }) => row.id);
      if (orderIds.length === 0) return [];

      const items: ManualShiftOrderItem[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_shift_order_items')
          .select(itemColumns)
          .in('order_id', orderIds)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data ?? []) as ManualShiftOrderItemRow[];
        for (const row of rows) {
          items.push(mapOrderItemRow(row));
        }

        hasMore = rows.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      return items;
    },

    async listPickerSheetLineItems(lineId) {
      const { data: orders, error: ordersError } = await supabase
        .from('manual_shift_orders')
        .select('id,work_bucket_name,point_name')
        .eq('line_id', lineId)
        .is('deleted_at', null);

      if (ordersError) throw ordersError;

      const orderRows = (orders ?? []) as Array<{ id: string; work_bucket_name: string | null; point_name: string | null }>;
      const mappedOrders = orderRows.map((row) => ({
        id: row.id,
        workBucketName: row.work_bucket_name ?? null,
        pointName: row.point_name ?? null,
      }));
      const orderIds = mappedOrders.map((row) => row.id);
      if (orderIds.length === 0) return { orders: mappedOrders, items: [] };

      const items: ManualShiftOrderItem[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_shift_order_items')
          .select(itemColumns)
          .in('order_id', orderIds)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data ?? []) as ManualShiftOrderItemRow[];
        for (const row of rows) {
          items.push(mapOrderItemRow(row));
        }

        hasMore = rows.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      return { orders: mappedOrders, items };
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

      const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_shift_order_items')
          .select('order_id, quantity')
          .in('order_id', orderIds)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data ?? []) as Array<{ order_id: string; quantity: number }>;
        for (const row of rows) {
          let entry = rollups.get(row.order_id);
          if (!entry) {
            entry = { lineCount: 0, totalQuantity: 0 };
            rollups.set(row.order_id, entry);
          }
          entry.lineCount += 1;
          entry.totalQuantity += row.quantity;
        }

        hasMore = rows.length === PAGE_SIZE;
        offset += PAGE_SIZE;
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

    async checkMonthlyReplaceSafety({ tenantId, shiftId }) {
      const [
        activeLinesResult,
        activeOrdersResult,
        startedOrdersResult,
        pickerOrdersResult,
        checkerOrdersResult,
        checkUnitsResult,
        nonImportEventsResult
      ] = await Promise.all([
        supabase
          .from('manual_shift_lines')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId)
          .is('deleted_at', null),
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
          .is('deleted_at', null)
          .neq('status', 'queued'),
        supabase
          .from('manual_shift_orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId)
          .is('deleted_at', null)
          .or('picker_worker_id.not.is.null,picker_name.not.is.null'),
        supabase
          .from('manual_shift_orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId)
          .is('deleted_at', null)
          .not('checker_name', 'is', null),
        supabase
          .from('manual_shift_order_check_units')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId),
        supabase
          .from('manual_shift_order_events')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('shift_id', shiftId)
          .or('event_type.neq.created,and(payload->>source.neq.monthly_xlsx_import)')
      ]);

      const activeLinesCount = activeLinesResult.count ?? 0;
      const activeOrdersCount = activeOrdersResult.count ?? 0;
      const startedOrdersCount = startedOrdersResult.count ?? 0;
      const assignedPickersCount = pickerOrdersResult.count ?? 0;
      const assignedCheckersCount = checkerOrdersResult.count ?? 0;
      const checkUnitsCount = checkUnitsResult.count ?? 0;
      const nonImportEventsCount = nonImportEventsResult.count ?? 0;

      const blockReasons: string[] = [];
      if (startedOrdersCount > 0) blockReasons.push('orders_started');
      if (assignedPickersCount > 0) blockReasons.push('picker_assigned');
      if (assignedCheckersCount > 0) blockReasons.push('checker_assigned');
      if (checkUnitsCount > 0) blockReasons.push('check_units_exist');
      if (nonImportEventsCount > 0) blockReasons.push('non_import_events_exist');

      return {
        canReplace: blockReasons.length === 0,
        activeLinesCount,
        activeOrdersCount,
        startedOrdersCount,
        assignedPickersCount,
        assignedCheckersCount,
        checkUnitsCount,
        nonImportEventsCount,
        blockReasons
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

    async applyDemandDataSheetImport(input) {
      const rows = input.rows.map((row) => ({
        source_row_number: row.sourceRowNumber, agent: row.agent, order_date: row.orderDate,
        customer_name: row.customerName, order_number: row.orderNumber, sku: row.sku,
        description: row.description, category: row.category, quantity: row.quantity, cost: row.cost,
        notes: row.notes, distribution_area: row.distributionArea, raw_route_line: row.rawRouteLine,
        planned_delivery_date_raw: row.plannedDeliveryDateRaw ?? null,
        planned_delivery_date: row.plannedDeliveryDate, planned_route_line: row.plannedRouteLine,
        planned_work_bucket: row.plannedWorkBucket, planning_status: row.planningStatus,
        route_flow: row.routeFlow, product_handling_flow: row.productHandlingFlow,
        note_date_hints: row.noteDateHints, issues: row.issues
      }));
      const { data, error } = await supabase.rpc('apply_demand_datasheet_import', {
        p_tenant_id: input.tenantId, p_source_file: input.sourceFile,
        p_source_sheet: input.sourceSheet, p_uploaded_by: input.uploadedBy,
        p_summary: input.summary, p_rows: rows
      });
      if (error) throw error;
      return data as { batchId: string; repair: DemandBacklogRepairResponse };
    },

    async repairDemandBacklog(input) {
      const { data, error } = await supabase.rpc('repair_demand_backlog', {
        p_tenant_id: input.tenantId, p_batch_id: input.batchId ?? null, p_dry_run: input.dryRun
      });
      if (error) throw error;
      return data as DemandBacklogRepairResponse;
    },

    async createDemandImportBatch(input) {
      const { data, error } = await supabase
        .from('demand_import_batches')
        .insert({
          tenant_id: input.tenantId,
          source_file: input.sourceFile,
          source_sheet: input.sourceSheet,
          uploaded_by: input.uploadedBy,
          status: input.status,
          rows_count: input.rowsCount,
          raw_rows_count: input.rawRowsCount,
          warning_rows_count: input.warningRowsCount,
          error_rows_count: input.errorRowsCount,
          special_flow_rows_count: input.specialFlowRowsCount,
          distribution_areas_count: input.distributionAreasCount,
          distinct_orders_count: input.distinctOrdersCount,
          distinct_sku_count: input.distinctSkuCount
        })
        .select(demandImportBatchColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapDemandImportBatchRow(data as DemandImportBatchRow);
    },

    async insertRawDemandRows(input) {
      if (input.rows.length === 0) return;
      const { error } = await supabase
        .from('raw_demand_rows')
        .insert(input.rows.map((row) => ({
          tenant_id: input.tenantId,
          batch_id: input.batchId,
          source_sheet: input.sourceSheet,
          source_row_number: row.sourceRowNumber,
          agent: row.agent,
          order_date: row.orderDate,
          customer_name: row.customerName,
          order_number: row.orderNumber,
          sku: row.sku,
          description: row.description,
          category: row.category,
          quantity: row.quantity,
          cost: row.cost,
          notes: row.notes,
          distribution_area: row.distributionArea,
          raw_route_line: row.rawRouteLine,
          planned_delivery_date_raw: row.plannedDeliveryDateRaw ?? null,
          planned_delivery_date: row.plannedDeliveryDate,
          planned_route_line: row.plannedRouteLine,
          planned_work_bucket: row.plannedWorkBucket,
          planning_status: row.planningStatus,
          route_flow: row.routeFlow,
          product_handling_flow: row.productHandlingFlow,
          note_date_hints: row.noteDateHints,
          issues: row.issues
        })));

      if (error) {
        throw error;
      }
    },

    async updateDemandImportBatchStatus(input) {
      const { data, error } = await supabase
        .from('demand_import_batches')
        .update({ status: input.status })
        .eq('tenant_id', input.tenantId)
        .eq('id', input.batchId)
        .select(demandImportBatchColumns)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? mapDemandImportBatchRow(data as DemandImportBatchRow) : null;
    },

    async getDemandImportBatch(input) {
      const { data, error } = await supabase
        .from('demand_import_batches')
        .select(demandImportBatchColumns)
        .eq('tenant_id', input.tenantId)
        .eq('id', input.batchId)
        .single();

      if (error) {
        throw error;
      }

      return mapDemandImportBatchRow(data as DemandImportBatchRow);
    },

    async listDemandImportBatches(input) {
      const { data, error } = await supabase
        .from('demand_import_batches')
        .select(demandImportBatchColumns)
        .eq('tenant_id', input.tenantId)
        .in('status', ['draft', 'ready'])
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      return ((data ?? []) as DemandImportBatchRow[]).map(mapDemandImportBatchRow);
    },

    async listAvailableDemandImportBatches(input) {
      const batches = await this.listDemandImportBatches(input);
      if (batches.length === 0) return [];

      const batchIds = batches.map((b) => b.id);

      const { data: rows, error: rowsError } = await supabase
        .from('raw_demand_rows')
        .select('id, batch_id, planning_status, quantity')
        .in('batch_id', batchIds)
        .eq('planning_status', 'unplanned');

      if (rowsError) throw rowsError;

      // Exclude allocations linked to reverted publications (revert-aware consumption)
      const { data: allocations, error: allocError } = await supabase
        .from('demand_planning_published_allocations')
        .select(`
          raw_demand_row_id,
          published_quantity,
          publication:demand_planning_publications!left(status)
        `)
        .in('batch_id', batchIds);

      if (allocError) throw allocError;

      // Filter out allocations from reverted publications before computing remaining quantities
      const activeAllocations = (allocations ?? [])
        .filter((row: any) => {
          if (!row.publication) return true; // legacy allocations without publication link
          return row.publication.status === 'applied';
        })
        .map((row: any) => ({
          raw_demand_row_id: String(row.raw_demand_row_id),
          published_quantity: Number(row.published_quantity)
        }));

      const publishedQtyByRowId = new Map<string, number>();
      for (const alloc of activeAllocations) {
        publishedQtyByRowId.set(
          alloc.raw_demand_row_id,
          (publishedQtyByRowId.get(alloc.raw_demand_row_id) ?? 0) + alloc.published_quantity
        );
      }

      const remainingByBatch = new Map<string, { remainingRows: number; remainingQuantity: number }>();
      for (const row of (rows ?? []) as Array<{ id: string; batch_id: string; planning_status: string; quantity: number | null }>) {
        const publishedQty = publishedQtyByRowId.get(row.id) ?? 0;
        const remainingQty = Math.max(0, (row.quantity ?? 0) - publishedQty);
        if (remainingQty <= 0) continue;

        const entry = remainingByBatch.get(row.batch_id) ?? { remainingRows: 0, remainingQuantity: 0 };
        entry.remainingRows += 1;
        entry.remainingQuantity += remainingQty;
        remainingByBatch.set(row.batch_id, entry);
      }

      return batches.map((batch) => {
        const remaining = remainingByBatch.get(batch.id) ?? { remainingRows: 0, remainingQuantity: 0 };
        return {
          id: batch.id,
          sourceFile: batch.sourceFile,
          sourceSheet: batch.sourceSheet,
          uploadedAt: batch.uploadedAt,
          status: batch.status,
          totalRows: batch.rowsCount,
          totalOrders: batch.distinctOrdersCount,
          remainingRows: remaining.remainingRows,
          remainingQuantity: remaining.remainingQuantity,
          canPlan: remaining.remainingRows > 0
        };
      });
    },

    async listRawDemandRowsByBatch(input) {
      let query = supabase
        .from('raw_demand_rows')
        .select(rawDemandRowColumns)
        .eq('tenant_id', input.tenantId)
        .eq('batch_id', input.batchId)
        .order('source_row_number', { ascending: true });

      if (input.limit !== undefined) {
        query = query.limit(input.limit);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return ((data ?? []) as RawDemandRowRow[]).map(mapRawDemandRow);
    },

    async listDemandBatchDistributionAreaSummary(input) {
      const { data, error } = await supabase
        .from('raw_demand_rows')
        .select('distribution_area,order_number,sku,quantity,planning_status')
        .eq('tenant_id', input.tenantId)
        .eq('batch_id', input.batchId)
        .order('distribution_area', { ascending: true });

      if (error) {
        throw error;
      }

      const summary = new Map<string, {
        distributionArea: string | null;
        rowsCount: number;
        orders: Set<string>;
        skus: Set<string>;
        totalQty: number;
        specialFlowRowsCount: number;
        errorRowsCount: number;
      }>();

      for (const row of (data ?? []) as Array<{
        distribution_area: string | null;
        order_number: string | null;
        sku: string | null;
        quantity: number | null;
        planning_status: RawDemandRow['planningStatus'];
      }>) {
        const key = row.distribution_area ?? '__missing__';
        const entry = summary.get(key) ?? {
          distributionArea: row.distribution_area,
          rowsCount: 0,
          orders: new Set<string>(),
          skus: new Set<string>(),
          totalQty: 0,
          specialFlowRowsCount: 0,
          errorRowsCount: 0
        };
        entry.rowsCount += 1;
        if (row.order_number) entry.orders.add(row.order_number);
        if (row.sku) entry.skus.add(row.sku);
        entry.totalQty += row.quantity == null ? 0 : Number(row.quantity);
        if (row.planning_status === 'special_flow') entry.specialFlowRowsCount += 1;
        if (row.planning_status === 'error') entry.errorRowsCount += 1;
        summary.set(key, entry);
      }

      return Array.from(summary.values())
        .map((entry) => ({
          distributionArea: entry.distributionArea,
          rowsCount: entry.rowsCount,
          ordersCount: entry.orders.size,
          skuCount: entry.skus.size,
          totalQty: entry.totalQty,
          specialFlowRowsCount: entry.specialFlowRowsCount,
          errorRowsCount: entry.errorRowsCount
        }))
        .sort((a, b) => {
          if (a.distributionArea === null) return 1;
          if (b.distributionArea === null) return -1;
          return a.distributionArea.localeCompare(b.distributionArea, 'he');
        });
    },

    async applyMonthlyImport(input) {
      const { data, error } = await supabase.rpc('manual_shift_apply_monthly_import', {
        p_tenant_id: input.tenantId,
        p_shift_id: input.shiftId,
        p_selected_date: input.selectedDate,
        p_plan: input.plan,
        p_mode: input.mode ?? 'initial'
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
        replacedLines: row.replaced_lines != null ? Number(row.replaced_lines) : undefined,
        replacedOrders: row.replaced_orders != null ? Number(row.replaced_orders) : undefined,
        replacedItems: row.replaced_items != null ? Number(row.replaced_items) : undefined,
        appliedGroups: Number(row.applied_groups ?? input.plan.appliedGroups),
        skippedGroups: Number(row.skipped_groups ?? input.plan.skippedGroups),
        skippedNegativeQuantityRows: Number(row.skipped_negative_quantity_rows ?? input.plan.skippedNegativeQuantityRows),
        skippedZeroQuantityRows: Number(row.skipped_zero_quantity_rows ?? input.plan.skippedZeroQuantityRows),
        appliedTotalQuantity: input.plan.appliedTotalQuantity,
        appliedItemLines: input.plan.appliedItemLines,
        excludedRowsCount: input.plan.preview.excludedRows.length,
        warningSummary: input.plan.warningSummary,
        warnings: input.plan.preview.warnings,
        previewTotals: input.plan.preview.totals,
        previewAnomalies: input.plan.preview.anomalies
      };
    },

    async insertMonthlyImportExcludedRows(input) {
      if (input.rows.length === 0) return;
      const dbRows = input.rows.map((row) => ({
        tenant_id: input.tenantId,
        shift_id: input.shiftId,
        source_file: input.sourceFile,
        source_sheet: input.sourceSheet,
        source_row_number: row.sourceRowNumber,
        exclusion_reason: row.exclusionReason,
        order_number: row.orderNumber,
        customer_name: row.customerName,
        sku: row.sku,
        description: row.description,
        category: row.category,
        quantity: row.quantity,
        raw_route_line: row.rawRouteLine,
        delivery_date: row.deliveryDate,
        notes: row.notes
      }));
      const { error } = await supabase
        .from('manual_shift_import_excluded_rows')
        .insert(dbRows);
      if (error) {
        throw error;
      }
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
      if (patch.rawDestinationLabel !== undefined) payload.raw_destination_label = patch.rawDestinationLabel;
      if (patch.deliveryPointId !== undefined) payload.delivery_point_id = patch.deliveryPointId;
      if (patch.deliveryPointName !== undefined) payload.delivery_point_name = patch.deliveryPointName;
      if (patch.deliveryPointMatchStatus !== undefined) payload.delivery_point_match_status = patch.deliveryPointMatchStatus;
      if (patch.deliveryPointAliasText !== undefined) payload.delivery_point_alias_text = patch.deliveryPointAliasText;
      if (patch.deliveryPointAliasId !== undefined) payload.delivery_point_alias_id = patch.deliveryPointAliasId;
      if (patch.lineId !== undefined) payload.line_id = patch.lineId;

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

    async listShiftOrderItems(shiftId) {
      const { data, error } = await supabase
        .from('manual_shift_order_items')
        .select(itemColumns)
        .eq('shift_id', shiftId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as ManualShiftOrderItemRow[]).map(mapOrderItemRow);
    },

    async listShiftWorkHierarchy(shiftId) {
      const [lineRows, orders, checkUnits, ashlamot, items] = await Promise.all([
        this.listShiftLines(shiftId),
        this.listShiftOrders(shiftId),
        this.listShiftCheckUnits(shiftId),
        this.listShiftAshlamot(shiftId),
        this.listShiftOrderItems(shiftId)
      ]);

      const orderIds = orders.map((o) => o.id);
      const rollups = orderIds.length > 0
        ? await this.listOrdersItemRollups(orderIds)
        : new Map<string, { lineCount: number; totalQuantity: number }>();

      return buildShiftWorkHierarchy(shiftId, lineRows, orders, rollups, checkUnits, ashlamot, items);
    },

    async listBucketProductRollup({
      shiftId,
      lineId,
      bucketName,
      distributionArea,
      sourceZone,
      workBucketName,
      sourceLineName
    }) {
      const hasSourceZoneFilter = sourceZone !== undefined;
      const normalizedSourceZone = normalizeOptionalString(sourceZone);
      const normalizedDistributionArea = normalizeOptionalString(distributionArea);
      const normalizedWorkBucketName = normalizeOptionalString(workBucketName);
      const normalizedSourceLineName = normalizeOptionalString(sourceLineName);
      const { data: lineRow, error: lineError } = await supabase
        .from('manual_shift_lines')
        .select('name,distribution_area')
        .eq('shift_id', shiftId)
        .eq('id', lineId)
        .maybeSingle();

      if (lineError) throw lineError;

      if (normalizedDistributionArea !== null) {
        if (normalizeOptionalString(lineRow?.distribution_area ?? null) !== normalizedDistributionArea) {
          return [];
        }
      }

      const chitaLine = isChitaLine(
        getManualShiftLineKind(lineRow?.name ?? normalizedSourceLineName ?? ''),
        lineRow?.name ?? normalizedSourceLineName
      );
      const shouldScopeChitaByOrder = chitaLine && normalizedWorkBucketName !== null;

      let ordersQuery = supabase
        .from('manual_shift_orders')
        .select('id,point_name,work_bucket_name')
        .eq('shift_id', shiftId)
        .eq('line_id', lineId)
        .is('deleted_at', null);

      if (normalizedSourceLineName !== null) {
        ordersQuery = ordersQuery.eq('route_base', normalizedSourceLineName);
      }

      if (hasSourceZoneFilter && !shouldScopeChitaByOrder) {
        ordersQuery =
          normalizedSourceZone === null
            ? ordersQuery.is('source_zone', null)
            : ordersQuery.eq('source_zone', normalizedSourceZone);
      }

      if (shouldScopeChitaByOrder) {
        ordersQuery = ordersQuery.eq('id', normalizedWorkBucketName);
      } else if (normalizedWorkBucketName !== null && normalizedWorkBucketName !== 'כללי') {
        ordersQuery = ordersQuery.eq('work_bucket_name', normalizedWorkBucketName);
      }

      if (!hasSourceZoneFilter && normalizedWorkBucketName === null) {
        if (bucketName === '') {
          ordersQuery = ordersQuery.is('point_name', null);
        } else {
          ordersQuery = ordersQuery.eq('point_name', bucketName);
        }
      }

      const { data: bucketOrders, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;

      const filteredBucketOrders =
        normalizedWorkBucketName === 'כללי'
          ? (bucketOrders ?? []).filter((row: { work_bucket_name?: string | null }) => {
              const workBucket = normalizeOptionalString(row.work_bucket_name ?? null);
              return workBucket === 'כללי' || workBucket === null;
            })
          : (bucketOrders ?? []);

      const orderIds = filteredBucketOrders.map((row: { id: string }) => row.id);
      if (orderIds.length === 0) return [];

      const productMap = new Map<
        string,
        { sku: string; description: string | null; category: string | null; totalQuantity: number; orderIds: Set<string> }
      >();
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_shift_order_items')
          .select('sku, description, category, quantity, order_id')
          .in('order_id', orderIds)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data ?? []) as Array<{
          sku: string;
          description: string | null;
          category: string | null;
          quantity: number;
          order_id: string;
        }>;

        for (const row of rows) {
          const key = row.sku;
          let entry = productMap.get(key);
          if (!entry) {
            entry = { sku: row.sku, description: row.description, category: row.category, totalQuantity: 0, orderIds: new Set() };
            productMap.set(key, entry);
          }
          entry.totalQuantity += row.quantity;
          entry.orderIds.add(row.order_id);
          if (entry.description === null && row.description !== null) {
            entry.description = row.description;
          }
          if (entry.category === null && row.category !== null) {
            entry.category = row.category;
          }
        }

        hasMore = rows.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      const result: BucketProductRollupRow[] = [];
      for (const entry of productMap.values()) {
        result.push({
          sku: entry.sku,
          description: entry.description,
          category: entry.category,
          totalQuantity: entry.totalQuantity,
          orderCount: entry.orderIds.size
        });
      }

      result.sort((a, b) => {
        const qtyDiff = b.totalQuantity - a.totalQuantity;
        if (qtyDiff !== 0) return qtyDiff;
        return a.sku.localeCompare(b.sku);
      });

      return result;
    },

    async listProductControlDemand(shiftId) {
      const PAGE_SIZE = 1000;
      const productMap = new Map<
        string,
        { sku: string; description: string | null; category: string | null; totalQuantity: number; orderIds: Set<string>; lineIds: Set<string> }
      >();
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_shift_order_items')
          .select('sku, description, category, quantity, order_id, line_id')
          .eq('shift_id', shiftId)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data ?? []) as Array<{
          sku: string | null;
          description: string | null;
          category: string | null;
          quantity: number;
          order_id: string;
          line_id: string | null;
        }>;

        for (const row of rows) {
          if (!row.sku || row.sku.trim() === '') continue;
          if (row.quantity <= 0) continue;

          const key = row.sku.trim();
          let entry = productMap.get(key);
          if (!entry) {
            entry = { sku: key, description: row.description, category: row.category, totalQuantity: 0, orderIds: new Set(), lineIds: new Set() };
            productMap.set(key, entry);
          }
          entry.totalQuantity += row.quantity;
          entry.orderIds.add(row.order_id);
          if (row.line_id) {
            entry.lineIds.add(row.line_id);
          }
          if (entry.description === null && row.description !== null) {
            entry.description = row.description;
          }
          if (entry.category === null && row.category !== null) {
            entry.category = row.category;
          }
        }

        hasMore = rows.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      const result: ProductControlDemandRow[] = [];
      for (const entry of productMap.values()) {
        result.push({
          sku: entry.sku,
          description: entry.description,
          category: entry.category,
          demandQty: entry.totalQuantity,
          orderCount: entry.orderIds.size,
          lineCount: entry.lineIds.size
        });
      }

      result.sort((a, b) => {
        const qtyDiff = b.demandQty - a.demandQty;
        if (qtyDiff !== 0) return qtyDiff;
        return a.sku.localeCompare(b.sku);
      });

      return result;
    },

    async listWarehouseStockBySku(skus, tenantId) {
      if (skus.length === 0) return new Map();

      const PAGE_SIZE = 1000;

      // Phase 1: map SKUs to product IDs
      const productsBySku = new Map<string, string[]>();
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const skuChunk = skus.slice(offset, offset + PAGE_SIZE);
        if (skuChunk.length === 0) break;

        const { data, error } = await supabase
          .from('products')
          .select('id, sku')
          .in('sku', skuChunk);

        if (error) throw error;

        for (const row of (data ?? []) as Array<{ id: string; sku: string | null }>) {
          if (!row.sku) continue;
          const existing = productsBySku.get(row.sku);
          if (existing) {
            existing.push(row.id);
          } else {
            productsBySku.set(row.sku, [row.id]);
          }
        }

        offset += PAGE_SIZE;
        hasMore = skuChunk.length === PAGE_SIZE;
      }

      if (productsBySku.size === 0) return new Map<string, ProductControlWarehouseStockRow>();

      // Phase 2: collect all unique product IDs and sum inventory_unit quantities
      const allProductIds = new Set<string>();
      for (const ids of productsBySku.values()) {
        for (const id of ids) {
          allProductIds.add(id);
        }
      }

      const productIdArray = [...allProductIds];
      const stockByProductId = new Map<string, number>();
      offset = 0;
      hasMore = true;

      while (hasMore) {
        const idChunk = productIdArray.slice(offset, offset + PAGE_SIZE);
        if (idChunk.length === 0) break;

        const { data, error } = await supabase
          .from('inventory_unit')
          .select('product_id, quantity')
          .in('product_id', idChunk)
          .eq('tenant_id', tenantId)
          .eq('status', 'available')
          .gt('quantity', 0);

        if (error) throw error;

        for (const row of (data ?? []) as Array<{ product_id: string; quantity: number }>) {
          const current = stockByProductId.get(row.product_id) ?? 0;
          stockByProductId.set(row.product_id, current + Number(row.quantity));
        }

        offset += PAGE_SIZE;
        hasMore = idChunk.length === PAGE_SIZE;
      }

      // Phase 3: map back from product_id to SKU
      const result = new Map<string, ProductControlWarehouseStockRow>();
      for (const [sku, productIds] of productsBySku) {
        let total = 0;
        for (const pid of productIds) {
          total += stockByProductId.get(pid) ?? 0;
        }
        result.set(sku, {
          sku,
          warehouseQty: total,
          canonicalProductIds: [...productIds]
        });
      }

      return result;
    },

    // --- Demand Planning Draft methods ---

    async createDemandPlanningDraft(input) {
      const { data, error } = await supabase
        .from('demand_planning_drafts')
        .insert({
          tenant_id: input.tenantId,
          batch_id: input.batchId,
          source_kind: 'batch',
          created_by: input.createdBy,
          source_scope: input.sourceScope ?? 'all',
          target_date: input.targetDate ?? null,
          target_shift_id: input.targetShiftId ?? null
        })
        .select()
        .single();

      if (error) throw error;

      return mapDemandPlanningDraftRow(data as DemandPlanningDraftRow);
    },

    async createRollingDemandPlanningDraft(input) {
      const { data, error } = await supabase
        .from('demand_planning_drafts')
        .insert({
          tenant_id: input.tenantId,
          batch_id: null,
          source_kind: 'rolling',
          target_date: input.targetDate,
          target_shift_id: input.targetShiftId,
          created_by: input.createdBy,
          source_scope: 'all'
        })
        .select()
        .single();

      if (error) throw error;

      return mapDemandPlanningDraftRow(data as DemandPlanningDraftRow);
    },

    async getDemandPlanningDraft(input) {
      const { data, error } = await supabase
        .from('demand_planning_drafts')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('id', input.draftId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? mapDemandPlanningDraftRow(data as DemandPlanningDraftRow) : null;
    },

    async updateDemandPlanningDraftStatus(input) {
      const { data, error } = await supabase
        .from('demand_planning_drafts')
        .update({ status: input.status })
        .eq('tenant_id', input.tenantId)
        .eq('id', input.draftId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? mapDemandPlanningDraftRow(data as DemandPlanningDraftRow) : null;
    },

    async deleteDemandPlanningBucketsByDraft(input) {
      const { error } = await supabase
        .from('demand_planning_buckets')
        .delete()
        .eq('tenant_id', input.tenantId)
        .eq('draft_id', input.draftId);

      if (error) throw error;
    },

    async insertDemandPlanningBuckets(input) {
      if (input.buckets.length === 0) return [];

      const { data, error } = await supabase
        .from('demand_planning_buckets')
        .insert(input.buckets.map((b, i) => ({
          tenant_id: input.tenantId,
          draft_id: input.draftId,
          batch_id: input.batchId,
          distribution_area: b.distributionArea,
          planning_line_name: b.planningLineName,
          bucket_name: b.bucketName,
          bucket_kind: b.bucketKind,
          sort_order: b.sortOrder
        })))
        .select();

      if (error) throw error;

      return ((data ?? []) as DemandPlanningBucketRow[]).map(mapDemandPlanningBucketRow);
    },

    async listDemandPlanningBuckets(input) {
      const { data, error } = await supabase
        .from('demand_planning_buckets')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('draft_id', input.draftId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return ((data ?? []) as DemandPlanningBucketRow[]).map(mapDemandPlanningBucketRow);
    },

    async deleteDemandPlanningAllocationsByDraft(input) {
      const { error } = await supabase
        .from('demand_planning_allocations')
        .delete()
        .eq('tenant_id', input.tenantId)
        .eq('draft_id', input.draftId);

      if (error) throw error;
    },

    async insertDemandPlanningAllocations(input) {
      if (input.allocations.length === 0) return [];

      const { data, error } = await supabase
        .from('demand_planning_allocations')
        .insert(input.allocations.map((a) => ({
          tenant_id: input.tenantId,
          draft_id: input.draftId,
          batch_id: a.batchId ?? input.batchId,
          raw_demand_row_id: a.rawDemandRowId,
          bucket_id: a.bucketId,
          allocated_quantity: a.allocatedQuantity
        })))
        .select();

      if (error) throw error;

      return ((data ?? []) as DemandPlanningAllocationRow[]).map(mapDemandPlanningAllocationRow);
    },

    async listDemandPlanningAllocations(input) {
      const { data, error } = await supabase
        .from('demand_planning_allocations')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('draft_id', input.draftId);

      if (error) throw error;

      return ((data ?? []) as DemandPlanningAllocationRow[]).map(mapDemandPlanningAllocationRow);
    },

    async listRawDemandRowsByIds(input) {
      if (input.rowIds.length === 0) return [];

      const { data, error } = await supabase
        .from('raw_demand_rows')
        .select(rawDemandRowColumns)
        .eq('tenant_id', input.tenantId)
        .in('id', input.rowIds);

      if (error) throw error;

      return ((data ?? []) as RawDemandRowRow[]).map(mapRawDemandRow);
    },

    async listPublishedDemandQuantities(input) {
      const { data, error } = await supabase
        .from('demand_planning_published_allocations')
        .select(`
          raw_demand_row_id,
          published_quantity,
          publication:demand_planning_publications!left(status)
        `)
        .eq('tenant_id', input.tenantId)
        .eq('batch_id', input.batchId);

      if (error) throw error;

      return (data ?? [])
        .filter((row: any) => {
          if (!row.publication) return true;
          return row.publication.status === 'applied';
        })
        .map((row: any) => ({
          rawDemandRowId: String(row.raw_demand_row_id),
          publishedQuantity: Number(row.published_quantity)
        }));
    },

    async publishDemandPlanningDraftToShift(input) {
      const { data, error } = await supabase.rpc('manual_shift_publish_demand_planning_draft', {
        p_tenant_id: input.tenantId,
        p_draft_id: input.draftId,
        p_target_shift_id: input.targetShiftId
      });

      if (error) throw error;
      return data as DemandPlanningPublishToShiftResponse;
    },

    async getDemandPlanningPublication(input) {
      const { data, error } = await supabase
        .from('demand_planning_publications')
        .select('*')
        .eq('id', input.publicationId)
        .eq('tenant_id', input.tenantId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapDemandPlanningPublicationRow(data as DemandPlanningPublicationRow);
    },

    async revertDemandPlanningPublication(input) {
      const { data, error } = await supabase.rpc('demand_planning_revert_publication', {
        p_tenant_id: input.tenantId,
        p_publication_id: input.publicationId
      });

      if (error) throw error;
      return data as DemandPlanningRevertPublicationResponse;
    },

    async getDemandPlanningDraftPublication(input) {
      const { data, error } = await supabase
        .from('demand_planning_publications')
        .select('*')
        .eq('draft_id', input.draftId)
        .eq('tenant_id', input.tenantId)
        .eq('status', 'applied')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapDemandPlanningPublicationRow(data as DemandPlanningPublicationRow);
    },

    // --- Demand Backlog implementations ---

    async findBacklogItemByIdentityKey(input) {
      const { data, error } = await supabase
        .from('demand_backlog_items')
        .select(demandBacklogItemColumns)
        .eq('tenant_id', input.tenantId)
        .eq('identity_key', input.identityKey)
        .maybeSingle();

      if (error) throw error;
      return data ? mapDemandBacklogItemRow(data as DemandBacklogItemRow) : null;
    },

    async findBacklogSourceLinkByRawRowId(input) {
      const { data, error } = await supabase
        .from('demand_backlog_item_sources')
        .select(demandBacklogSourceColumns)
        .eq('tenant_id', input.tenantId)
        .eq('raw_demand_row_id', input.rawDemandRowId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapDemandBacklogSourceRow(data as DemandBacklogSourceRowRaw) : null;
    },

    async createBacklogItem(input) {
      const { data, error } = await supabase
        .from('demand_backlog_items')
        .insert({
          tenant_id: input.tenantId,
          identity_key: input.identityKey,
          status: input.status,
          total_quantity: input.totalQuantity,
          order_number: input.orderNumber,
          customer_name: input.customerName,
          sku: input.sku,
          description: input.description,
          category: input.category,
          distribution_area: input.distributionArea,
          product_handling_flow: input.productHandlingFlow,
          route_flow: input.routeFlow
        })
        .select(demandBacklogItemColumns)
        .single();

      if (error) throw error;
      return mapDemandBacklogItemRow(data as DemandBacklogItemRow);
    },

    async updateBacklogItem(input) {
      const { data, error } = await supabase
        .from('demand_backlog_items')
        .update({
          ...(input.patch.totalQuantity !== undefined ? { total_quantity: input.patch.totalQuantity } : {}),
          ...(input.patch.status !== undefined ? { status: input.patch.status } : {}),
          ...(input.patch.description !== undefined ? { description: input.patch.description } : {}),
          ...(input.patch.category !== undefined ? { category: input.patch.category } : {}),
          ...(input.patch.lastSeenAt !== undefined ? { last_seen_at: input.patch.lastSeenAt } : {}),
          ...(input.patch.lastQuantityChangedAt !== undefined ? { last_quantity_changed_at: input.patch.lastQuantityChangedAt } : {})
        })
        .eq('tenant_id', input.tenantId)
        .eq('id', input.backlogItemId)
        .select(demandBacklogItemColumns)
        .single();

      if (error) throw error;
      return mapDemandBacklogItemRow(data as DemandBacklogItemRow);
    },

    async createBacklogSourceLink(input) {
      const { data, error } = await supabase
        .from('demand_backlog_item_sources')
        .insert({
          tenant_id: input.tenantId,
          backlog_item_id: input.backlogItemId,
          raw_demand_row_id: input.rawDemandRowId,
          batch_id: input.batchId,
          merge_action: input.mergeAction,
          previous_quantity: input.previousQuantity,
          new_quantity: input.newQuantity,
          quantity_delta: input.quantityDelta,
          quantity_at_import: input.newQuantity
        })
        .select(demandBacklogSourceColumns)
        .single();

      if (error) throw error;
      return mapDemandBacklogSourceRow(data as DemandBacklogSourceRowRaw);
    },

    async listBacklogItems(input) {
      let query = supabase
        .from('demand_backlog_items')
        .select(demandBacklogItemColumns, { count: 'exact', head: false })
        .eq('tenant_id', input.tenantId);

      if (input.status !== 'all') {
        query = query.eq('status', input.status);
      }

      if (input.distributionArea) {
        query = query.eq('distribution_area', input.distributionArea);
      }

      if (input.search) {
        const term = `%${input.search}%`;
        query = query.or(
          `order_number.ilike.${term},customer_name.ilike.${term},sku.ilike.${term},description.ilike.${term}`
        );
      }

      if (input.sourceBatchId) {
        query = query.filter(
          'id', 'in',
          `(select backlog_item_id from demand_backlog_item_sources where batch_id = '${input.sourceBatchId}')`
        );
      }

      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;

      const { data, error, count } = await query
        .order('first_seen_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        items: ((data ?? []) as DemandBacklogItemRow[]).map(mapDemandBacklogItemRow),
        total: count ?? 0
      };
    },

    async listBacklogItemAllocationsSum(input) {
      if (input.backlogItemIds.length === 0) return [];

      const { data, error } = await supabase
        .from('demand_backlog_item_sources')
        .select(`
          backlog_item_id,
          raw_demand_row_id
        `)
        .eq('tenant_id', input.tenantId)
        .in('backlog_item_id', input.backlogItemIds);

      if (error) throw error;

      const sourceRows = (data ?? []) as Array<{ backlog_item_id: string; raw_demand_row_id: string }>;
      const rawRowIds = sourceRows.map(r => r.raw_demand_row_id);

      if (rawRowIds.length === 0) {
        return input.backlogItemIds.map(id => ({ backlogItemId: id, allocatedQuantity: 0 }));
      }

      const { data: allocData, error: allocError } = await supabase
        .from('demand_planning_allocations')
        .select('raw_demand_row_id, allocated_quantity')
        .in('raw_demand_row_id', rawRowIds);

      if (allocError) throw allocError;

      const allocRows = (allocData ?? []) as Array<{ raw_demand_row_id: string; allocated_quantity: number }>;
      const allocByRowId = new Map<string, number>();
      for (const a of allocRows) {
        allocByRowId.set(a.raw_demand_row_id, (allocByRowId.get(a.raw_demand_row_id) ?? 0) + Number(a.allocated_quantity));
      }

      const result = new Map<string, number>();
      for (const id of input.backlogItemIds) {
        result.set(id, 0);
      }
      for (const sr of sourceRows) {
        const alloc = allocByRowId.get(sr.raw_demand_row_id) ?? 0;
        result.set(sr.backlog_item_id, (result.get(sr.backlog_item_id) ?? 0) + alloc);
      }

      return Array.from(result.entries()).map(([backlogItemId, allocatedQuantity]) => ({
        backlogItemId,
        allocatedQuantity
      }));
    },

    async listBacklogSourceBatches(input) {
      if (input.backlogItemIds.length === 0) return [];

      const { data, error } = await supabase
        .from('demand_backlog_item_sources')
        .select(`
          backlog_item_id,
          batch_id,
          merge_action,
          previous_quantity,
          new_quantity,
          quantity_delta,
          quantity_at_import,
          created_at
        `)
        .eq('tenant_id', input.tenantId)
        .in('backlog_item_id', input.backlogItemIds);

      if (error) throw error;

      const sourceRows = (data ?? []) as Array<{
        backlog_item_id: string;
        batch_id: string;
        merge_action: string;
        previous_quantity: number | null;
        new_quantity: number | null;
        quantity_delta: number | null;
        quantity_at_import: number | null;
        created_at: string;
      }>;

      const batchIds = [...new Set(sourceRows.map(r => r.batch_id))];
      if (batchIds.length === 0) return [];

      const { data: batchData, error: batchError } = await supabase
        .from('demand_import_batches')
        .select('id, source_file, uploaded_at')
        .in('id', batchIds);

      if (batchError) throw batchError;

      const batchMap = new Map<string, { source_file: string; uploaded_at: string }>();
      for (const b of (batchData ?? []) as Array<{ id: string; source_file: string; uploaded_at: string }>) {
        batchMap.set(b.id, { source_file: b.source_file, uploaded_at: b.uploaded_at });
      }

      return sourceRows.map(sr => {
        const batch = batchMap.get(sr.batch_id);
        return {
          backlogItemId: sr.backlog_item_id,
          batchId: sr.batch_id,
          sourceFile: batch?.source_file ?? '',
          uploadedAt: batch?.uploaded_at ?? sr.created_at,
          mergeAction: sr.merge_action,
          quantityAtImport: sr.quantity_at_import != null
            ? Number(sr.quantity_at_import)
            : (sr.new_quantity !== null ? Number(sr.new_quantity) : 0),
          previousQuantity: sr.previous_quantity !== null ? Number(sr.previous_quantity) : null,
          newQuantity: sr.new_quantity !== null ? Number(sr.new_quantity) : null,
          quantityDelta: sr.quantity_delta !== null ? Number(sr.quantity_delta) : null
        };
      });
    },

    async getBacklogSummary(input) {
      let query = supabase
        .from('demand_backlog_items')
        .select(demandBacklogItemColumns, { count: 'exact', head: true })
        .eq('tenant_id', input.tenantId);

      if (input.status !== 'all') {
        query = query.eq('status', input.status);
      }

      if (input.distributionArea) {
        query = query.eq('distribution_area', input.distributionArea);
      }

      if (input.search) {
        const term = `%${input.search}%`;
        query = query.or(
          `order_number.ilike.${term},customer_name.ilike.${term},sku.ilike.${term},description.ilike.${term}`
        );
      }

      if (input.sourceBatchId) {
        query = query.filter(
          'id', 'in',
          `(select backlog_item_id from demand_backlog_item_sources where batch_id = '${input.sourceBatchId}')`
        );
      }

      const { count: totalItems, error: countError } = await query;
      if (countError) throw countError;

      const { data: statusData, error: statusError } = await supabase
        .from('demand_backlog_items')
        .select('status, count', { count: 'exact', head: true })
        .eq('tenant_id', input.tenantId);

      if (statusError) throw statusError;

      const { data: byStatusRaw, error: byStatusError } = await supabase
        .from('demand_backlog_items')
        .select('status, count')
        .eq('tenant_id', input.tenantId);

      if (byStatusError) throw byStatusError;

      const statusCounts = new Map<string, number>();
      for (const r of (byStatusRaw ?? []) as Array<{ status: string; count: number }>) {
        statusCounts.set(r.status, Number(r.count ?? 0));
      }

      const byStatus = Array.from(statusCounts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const { data: areaRaw, error: areaError } = await supabase
        .from('demand_backlog_items')
        .select('distribution_area, count, total_quantity')
        .eq('tenant_id', input.tenantId);

      if (areaError) throw areaError;

      const areaMap = new Map<string, { count: number; totalOpenQuantity: number }>();
      for (const r of (areaRaw ?? []) as Array<{ distribution_area: string | null; count: number; total_quantity: number }>) {
        const key = r.distribution_area ?? '__missing__';
        const entry = areaMap.get(key) ?? { count: 0, totalOpenQuantity: 0 };
        entry.count += Number(r.count ?? 0);
        entry.totalOpenQuantity += Number(r.total_quantity ?? 0);
        areaMap.set(key, entry);
      }

      const byDistributionArea = Array.from(areaMap.entries())
        .map(([key, entry]) => ({
          distributionArea: key === '__missing__' ? null : key,
          count: entry.count,
          totalOpenQuantity: entry.totalOpenQuantity
        }))
        .sort((a, b) => {
          if (a.distributionArea === null) return 1;
          if (b.distributionArea === null) return -1;
          return a.distributionArea.localeCompare(b.distributionArea, 'he');
        });

      const { data: oldestRaw, error: oldestError } = await supabase
        .from('demand_backlog_items')
        .select('first_seen_at')
        .eq('tenant_id', input.tenantId)
        .order('first_seen_at', { ascending: true })
        .limit(1);

      if (oldestError) throw oldestError;

      const { data: newestRaw, error: newestError } = await supabase
        .from('demand_backlog_items')
        .select('first_seen_at')
        .eq('tenant_id', input.tenantId)
        .order('first_seen_at', { ascending: false })
        .limit(1);

      if (newestError) throw newestError;

      // Compute tenant-wide allocated quantity
      const { data: sourceLinksRaw, error: sourceLinksError } = await supabase
        .from('demand_backlog_item_sources')
        .select('raw_demand_row_id')
        .eq('tenant_id', input.tenantId);

      if (sourceLinksError) throw sourceLinksError;

      const sourceLinkRowIds = [...new Set((sourceLinksRaw ?? []).map(r => (r as { raw_demand_row_id: string }).raw_demand_row_id))];

      let totalAllocatedQuantity = 0;
      if (sourceLinkRowIds.length > 0) {
        const { data: allocRaw, error: allocError } = await supabase
          .from('demand_planning_allocations')
          .select('allocated_quantity')
          .in('raw_demand_row_id', sourceLinkRowIds);

        if (allocError) throw allocError;

        totalAllocatedQuantity = (allocRaw ?? []).reduce(
          (sum, r) => sum + Number((r as { allocated_quantity: number }).allocated_quantity ?? 0), 0
        );
      }

      // Sum total_quantity for open/requires_review statuses
      const { data: qtyRaw, error: qtyError } = await supabase
        .from('demand_backlog_items')
        .select('total_quantity')
        .eq('tenant_id', input.tenantId)
        .in('status', ['open', 'requires_review']);

      if (qtyError) throw qtyError;

      const totalDemand = (qtyRaw ?? []).reduce(
        (sum, r) => sum + Number((r as { total_quantity: number }).total_quantity ?? 0), 0
      );
      const totalOpenQuantity = Math.max(totalDemand - totalAllocatedQuantity, 0);

      return {
        totalItems: totalItems ?? 0,
        byStatus,
        byDistributionArea,
        oldestItemSeenAt: (oldestRaw?.[0] as { first_seen_at?: string } | undefined)?.first_seen_at ?? null,
        newestItemSeenAt: (newestRaw?.[0] as { first_seen_at?: string } | undefined)?.first_seen_at ?? null,
        totalOpenQuantity,
        totalAllocatedQuantity
      };
    },

    async getAvailableDemandSnapshot(input) {
      const { data: backlogItemsData, error: backlogItemsError } = await supabase
        .from('demand_backlog_items')
        .select(demandBacklogItemColumns)
        .eq('tenant_id', input.tenantId)
        .order('first_seen_at', { ascending: false })
        .order('id', { ascending: false });

      if (backlogItemsError) throw backlogItemsError;

      const { data: sourceLinksData, error: sourceLinksError } = await supabase
        .from('demand_backlog_item_sources')
        .select('backlog_item_id,raw_demand_row_id,batch_id')
        .eq('tenant_id', input.tenantId);

      if (sourceLinksError) throw sourceLinksError;

      const batchIds = [...new Set((sourceLinksData ?? []).map((row) => (row as { batch_id: string }).batch_id))];
      const { data: batchData, error: batchError } = batchIds.length === 0
        ? { data: [], error: null }
        : await supabase
          .from('demand_import_batches')
          .select('id,source_file,uploaded_at')
          .eq('tenant_id', input.tenantId)
          .in('id', batchIds);

      if (batchError) throw batchError;

      const { data: allocationData, error: allocationError } = await supabase
        .from('demand_planning_published_allocations')
        .select('raw_demand_row_id,published_quantity,publication_id')
        .eq('tenant_id', input.tenantId);

      if (allocationError) throw allocationError;

      const { data: publicationData, error: publicationError } = await supabase
        .from('demand_planning_publications')
        .select('id,status')
        .eq('tenant_id', input.tenantId);

      if (publicationError) throw publicationError;

      const publicationStatusById = new Map(
        ((publicationData ?? []) as DemandAvailableDemandPublicationRow[]).map((publication) => [
          publication.id,
          publication.status
        ] as const)
      );

      return {
        backlogItems: ((backlogItemsData ?? []) as DemandBacklogItemRow[]).map(mapDemandBacklogItemRow),
        sourceLinks: (sourceLinksData ?? []).map((row) => ({
          backlogItemId: String((row as { backlog_item_id: string }).backlog_item_id),
          rawDemandRowId: String((row as { raw_demand_row_id: string }).raw_demand_row_id),
          batchId: String((row as { batch_id: string }).batch_id)
        })),
        sourceBatches: ((batchData ?? []) as Array<{ id: string; source_file: string; uploaded_at: string }>).map((batch) => ({
          batchId: batch.id,
          sourceFile: batch.source_file,
          uploadedAt: batch.uploaded_at
        })),
        publishedAllocations: ((allocationData ?? []) as DemandAvailableDemandPublishedAllocationRow[]).map((allocation) => ({
          rawDemandRowId: allocation.raw_demand_row_id,
          publishedQuantity: Number(allocation.published_quantity ?? 0),
          publicationStatus: allocation.publication_id
            ? publicationStatusById.get(allocation.publication_id) ?? null
            : null
        }))
      };
    },

    async countBacklogDistinctBatches(input) {
      const { data, error } = await supabase
        .from('demand_backlog_item_sources')
        .select('batch_id', { count: 'exact', head: true })
        .eq('tenant_id', input.tenantId);

      if (error) throw error;

      const countResult = data as unknown as { count?: number } | null;
      return countResult?.count ?? 0;
    },

    async listReadyBatches(input) {
      const { data, error } = await supabase
        .from('demand_import_batches')
        .select(demandImportBatchColumns)
        .eq('tenant_id', input.tenantId)
        .eq('status', 'ready')
        .order('uploaded_at', { ascending: false })
        .order('id', { ascending: false });

      if (error) throw error;

      return ((data ?? []) as DemandImportBatchRow[]).map(mapBatchRowToRollingResolver);
    },

    async listRawDemandRowsForBatches(input) {
      if (input.batchIds.length === 0) return [];

      const { data, error } = await supabase
        .from('raw_demand_rows')
        .select(rawDemandRowColumns)
        .eq('tenant_id', input.tenantId)
        .in('batch_id', input.batchIds);

      if (error) throw error;

      return ((data ?? []) as RawDemandRowRow[]).map(mapRawDemandRowToRollingResolver);
    },

    async listPublishedAllocationsForRolling(input) {
      const { data, error } = await supabase
        .from('demand_planning_published_allocations')
        .select(`
          raw_demand_row_id,
          published_quantity,
          publication_id,
          raw_demand_row:raw_demand_row_id(
            tenant_id,
            order_number,
            sku,
            customer_name,
            distribution_area,
            planned_delivery_date
          ),
          publication:publication_id(
            tenant_id,
            status,
            reverted_at
          )
        `)
        .eq('tenant_id', input.tenantId);

      if (error) throw error;

      const raw = (data ?? []) as Array<Record<string, unknown>>;

      return raw.flatMap(r => {
        const row = getEmbeddedRecord(r.raw_demand_row);
        if (!row || row.tenant_id !== input.tenantId) return [];

        const publication = getEmbeddedRecord(r.publication);
        const publicationStatus = !r.publication_id
          ? null
          : publication?.tenant_id === input.tenantId
            && publication.status === 'applied'
            && publication.reverted_at == null
            ? 'applied' as const
            : 'reverted' as const;

        return [{
          rawDemandRowId: String(r.raw_demand_row_id ?? ''),
          publishedQuantity: Number(r.published_quantity ?? 0),
          publicationStatus,
          orderNumber: (row.order_number as string | null) ?? null,
          sku: (row.sku as string | null) ?? null,
          customerName: (row.customer_name as string | null) ?? null,
          distributionArea: (row.distribution_area as string | null) ?? null,
          plannedDeliveryDate: (row.planned_delivery_date as string | null) ?? null
        }];
      });
    },

    async listBacklogOrderAggregationRows(input) {
      const { data: backlogItems, error: biError } = await supabase
        .from('demand_backlog_items')
        .select(demandBacklogItemColumns)
        .eq('tenant_id', input.tenantId)
        .order('last_seen_at', { ascending: false })
        .order('id', { ascending: false });

      if (biError) throw biError;
      if (!backlogItems || backlogItems.length === 0) return [];

      const backlogItemIds = (backlogItems as DemandBacklogItemRow[]).map(r => r.id);

      const { data: sourceLinks, error: slError } = await supabase
        .from('demand_backlog_item_sources')
        .select('backlog_item_id, raw_demand_row_id, batch_id')
        .eq('tenant_id', input.tenantId)
        .in('backlog_item_id', backlogItemIds);

      if (slError) throw slError;
      if (!sourceLinks || sourceLinks.length === 0) return [];

      const rawDemandRowIds = [...new Set((sourceLinks as Array<{ raw_demand_row_id: string }>).map(r => r.raw_demand_row_id))];
      const batchIds = [...new Set((sourceLinks as Array<{ batch_id: string }>).map(r => r.batch_id))];

      const { data: rawRows, error: rrError } = await supabase
        .from('raw_demand_rows')
        .select('id, customer_name, order_number, sku, description, category, notes, distribution_area, planned_delivery_date, raw_route_line, planning_status, route_flow, product_handling_flow, quantity')
        .eq('tenant_id', input.tenantId)
        .in('id', rawDemandRowIds);

      if (rrError) throw rrError;

      const { data: batches, error: bError } = await supabase
        .from('demand_import_batches')
        .select('id, source_file, uploaded_at, status, rows_count')
        .eq('tenant_id', input.tenantId)
        .in('id', batchIds);

      if (bError) throw bError;

      const { data: allocations, error: aError } = await supabase
        .from('demand_planning_published_allocations')
        .select('raw_demand_row_id, published_quantity, publication_id')
        .eq('tenant_id', input.tenantId)
        .in('raw_demand_row_id', rawDemandRowIds);

      if (aError) throw aError;

      const { data: publications, error: pError } = await supabase
        .from('demand_planning_publications')
        .select('id, status, reverted_at')
        .eq('tenant_id', input.tenantId);

      if (pError) throw pError;

      const publicationStatusById = new Map<string, string>();
      for (const pub of (publications ?? []) as Array<{ id: string; status: string; reverted_at: string | null }>) {
        if (pub.status === 'applied' && pub.reverted_at == null) {
          publicationStatusById.set(pub.id, 'applied');
        }
      }

      const publishedQtyByRawRowId = new Map<string, number>();
      for (const alloc of (allocations ?? []) as Array<{ raw_demand_row_id: string; published_quantity: number; publication_id: string | null }>) {
        const isApplied = !alloc.publication_id || publicationStatusById.has(alloc.publication_id);
        if (isApplied) {
          publishedQtyByRawRowId.set(
            alloc.raw_demand_row_id,
            (publishedQtyByRawRowId.get(alloc.raw_demand_row_id) ?? 0) + Number(alloc.published_quantity ?? 0)
          );
        }
      }

      const batchMap = new Map<string, { sourceFile: string; uploadedAt: string; status: string; rowsCount: number }>();
      for (const b of (batches ?? []) as Array<{ id: string; source_file: string; uploaded_at: string; status: string; rows_count: number }>) {
        batchMap.set(b.id, { sourceFile: b.source_file, uploadedAt: b.uploaded_at, status: b.status, rowsCount: Number(b.rows_count) });
      }

      const rawRowMap = new Map<string, Record<string, unknown>>();
      for (const rr of (rawRows ?? []) as Array<Record<string, unknown>>) {
        rawRowMap.set(String(rr.id), rr);
      }

      const backlogItemMap = new Map<string, DemandBacklogItemRow>();
      for (const bi of (backlogItems ?? []) as DemandBacklogItemRow[]) {
        backlogItemMap.set(bi.id, bi);
      }

      return (sourceLinks as Array<Record<string, unknown>>).map(sl => {
        const bi = backlogItemMap.get(String(sl.backlog_item_id));
        const rr = rawRowMap.get(String(sl.raw_demand_row_id));
        const publishedQty = publishedQtyByRawRowId.get(String(sl.raw_demand_row_id)) ?? 0;
        const batch = batchMap.get(String(sl.batch_id));

        return {
          backlogItemId: bi?.id ?? '',
          backlogItemOrderNumber: (bi?.order_number as string | null) ?? null,
          backlogItemCustomerName: (bi?.customer_name as string | null) ?? null,
          backlogItemSku: (bi?.sku as string | null) ?? null,
          backlogItemDistributionArea: (bi?.distribution_area as string | null) ?? null,
          backlogItemTotalQuantity: Number(bi?.total_quantity ?? 0),
          backlogItemFirstSeenAt: String(bi?.first_seen_at ?? ''),
          backlogItemLastSeenAt: String(bi?.last_seen_at ?? ''),
          backlogItemStatus: String(bi?.status ?? ''),
          rawDemandRowId: String(sl.raw_demand_row_id ?? ''),
          rawRowPlannedDeliveryDate: (rr?.planned_delivery_date as string | null) ?? null,
          rawRowRouteLine: (rr?.raw_route_line as string | null) ?? null,
          rawRowPlanningStatus: String(rr?.planning_status ?? ''),
          rawRowRouteFlow: String(rr?.route_flow ?? ''),
          rawRowProductHandlingFlow: String(rr?.product_handling_flow ?? ''),
          rawRowQuantity: (rr?.quantity as number | null) ?? null,
          rawRowDescription: (rr?.description as string | null) ?? null,
          rawRowCategory: (rr?.category as string | null) ?? null,
          rawRowNotes: (rr?.notes as string | null) ?? null,
          sourceLinkBatchId: String(sl.batch_id ?? ''),
          batchSourceFile: batch?.sourceFile ?? '',
          batchUploadedAt: batch?.uploadedAt ?? '',
          batchStatus: batch?.status ?? '',
          batchRowsCount: batch?.rowsCount ?? 0,
          publishedQuantity: publishedQty
        };
      });
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

export type ManualShiftSourceZoneLineDiagnostic = {
  lineId: string;
  lineName: string;
  distributionArea: string | null;
  itemZones: string[];
  orderNumbers: string[];
  rowIndexes: number[];
  hasMultipleItemZones: boolean;
  message: string;
  distributionAreaMessage: string | null;
};

export type ManualShiftSourceZoneOrderDiagnostic = {
  orderId: string;
  orderNumber: string;
  lineId: string;
  lineName: string;
  distributionArea: string | null;
  routeBase: string | null;
  rawRouteLine: string | null;
  pointName: string | null;
  itemZones: string[];
  rowIndexes: number[];
  hasMixedItemZones: boolean;
  message: string;
};

export type ManualShiftSourceZoneMismatchDiagnostic = {
  orderId: string;
  orderNumber: string;
  lineId: string;
  lineName: string;
  distributionArea: string | null;
  routeBase: string | null;
  rawRouteLine: string | null;
  pointName: string | null;
  itemZone: string;
  rowIndexes: number[];
  message: string;
};

export type ManualShiftSourceZoneDiagnostics = {
  lines: ManualShiftSourceZoneLineDiagnostic[];
  orders: ManualShiftSourceZoneOrderDiagnostic[];
  mismatches: ManualShiftSourceZoneMismatchDiagnostic[];
};

type ManualShiftSourceZoneLineStats = {
  lineId: string;
  lineName: string;
  distributionArea: string | null;
  itemZones: Set<string>;
  orderNumbers: Set<string>;
  rowIndexes: Set<number>;
};

type ManualShiftSourceZoneOrderStats = {
  orderId: string;
  orderNumber: string;
  lineId: string;
  lineName: string;
  distributionArea: string | null;
  routeBase: string | null;
  rawRouteLine: string | null;
  pointName: string | null;
  itemZones: Set<string>;
  rowIndexes: Set<number>;
};

type ManualShiftSourceZoneMismatchStats = {
  orderId: string;
  orderNumber: string;
  lineId: string;
  lineName: string;
  distributionArea: string | null;
  routeBase: string | null;
  rawRouteLine: string | null;
  pointName: string | null;
  itemZone: string;
  rowIndexes: Set<number>;
};

function compareMaybeString(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a.localeCompare(b, 'he');
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHebrewName(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function inferManualShiftOrderSourceZone(
  itemZones: Array<Pick<ManualShiftOrderItem, 'zone'>>
): string | null {
  const zones = Array.from(
    new Set(
      itemZones
        .map((item) => normalizeOptionalString(item.zone))
        .filter((zone): zone is string => zone !== null)
    )
  );

  return zones.length === 1 ? zones[0] : null;
}

const UNKNOWN_SOURCE_ZONE_KEY = '__unknown_source_zone__';
const UNKNOWN_SOURCE_ZONE_DISPLAY_NAME = 'ללא איזור';

function normalizeSourceZone(sourceZone: string | null | undefined): string | null {
  return normalizeOptionalString(sourceZone);
}

function sourceZoneKey(sourceZone: string | null): string {
  return sourceZone ?? UNKNOWN_SOURCE_ZONE_KEY;
}

function sourceZoneDisplayName(sourceZone: string | null): string {
  return sourceZone ?? UNKNOWN_SOURCE_ZONE_DISPLAY_NAME;
}

function buildEffectiveSourceZoneLookup(input: {
  orders: ManualShiftOrder[];
  items: ManualShiftOrderItem[];
}): Map<string, string | null> {
  const itemZonesByOrderId = new Map<string, Set<string>>();
  for (const item of input.items) {
    const zone = normalizeSourceZone(item.zone);
    if (!zone) continue;
    const zones = itemZonesByOrderId.get(item.orderId) ?? new Set<string>();
    zones.add(zone);
    itemZonesByOrderId.set(item.orderId, zones);
  }

  const lookup = new Map<string, string | null>();
  for (const order of input.orders) {
    const directZone = normalizeSourceZone(order.sourceZone ?? null);
    if (directZone) {
      lookup.set(order.id, directZone);
      continue;
    }

    const inferredZones = itemZonesByOrderId.get(order.id);
    if (inferredZones && inferredZones.size === 1) {
      lookup.set(order.id, inferredZones.values().next().value ?? null);
      continue;
    }

    lookup.set(order.id, null);
  }

  return lookup;
}

export function buildManualShiftSourceZoneDiagnostics(input: {
  lines: ManualShiftLine[];
  orders: ManualShiftOrder[];
  items: ManualShiftOrderItem[];
}): ManualShiftSourceZoneDiagnostics {
  const lineLookup = new Map(input.lines.map((line) => [line.id, line] as const));
  const orderLookup = new Map(input.orders.map((order) => [order.id, order] as const));

  const lines = new Map<string, ManualShiftSourceZoneLineStats>();
  const orders = new Map<string, ManualShiftSourceZoneOrderStats>();
  const mismatches = new Map<string, ManualShiftSourceZoneMismatchStats>();

  for (const item of input.items) {
    const itemZone = normalizeOptionalString(item.zone);
    if (!itemZone) continue;

    const line = lineLookup.get(item.lineId);
    const order = orderLookup.get(item.orderId);
    if (!line || !order) continue;

    const lineEntry = lines.get(line.id) ?? {
      lineId: line.id,
      lineName: line.name,
      distributionArea: line.distributionArea,
      itemZones: new Set<string>(),
      orderNumbers: new Set<string>(),
      rowIndexes: new Set<number>()
    };
    lineEntry.distributionArea ??= line.distributionArea;
    lineEntry.itemZones.add(itemZone);
    lineEntry.orderNumbers.add(order.orderNumber ?? '');
    for (const rowIndex of item.sourceRows ?? []) {
      lineEntry.rowIndexes.add(rowIndex);
    }
    lines.set(line.id, lineEntry);

    const orderEntry = orders.get(order.id) ?? {
      orderId: order.id,
      orderNumber: order.orderNumber ?? '',
      lineId: line.id,
      lineName: line.name,
      distributionArea: line.distributionArea,
      routeBase: order.routeBase ?? null,
      rawRouteLine: order.rawRouteLine ?? null,
      pointName: order.pointName ?? null,
      itemZones: new Set<string>(),
      rowIndexes: new Set<number>()
    };
    orderEntry.distributionArea ??= line.distributionArea;
    orderEntry.routeBase ??= order.routeBase ?? null;
    orderEntry.rawRouteLine ??= order.rawRouteLine ?? null;
    orderEntry.pointName ??= order.pointName ?? null;
    orderEntry.itemZones.add(itemZone);
    for (const rowIndex of item.sourceRows ?? []) {
      orderEntry.rowIndexes.add(rowIndex);
    }
    orders.set(order.id, orderEntry);

    if (line.distributionArea && itemZone !== line.distributionArea) {
      const mismatchKey = `${line.id}\u0001${order.id}\u0001${itemZone}\u0001${line.distributionArea}`;
      const mismatchEntry = mismatches.get(mismatchKey) ?? {
        orderId: order.id,
        orderNumber: order.orderNumber ?? '',
        lineId: line.id,
        lineName: line.name,
        distributionArea: line.distributionArea,
        routeBase: order.routeBase ?? null,
        rawRouteLine: order.rawRouteLine ?? null,
        pointName: order.pointName ?? null,
        itemZone,
        rowIndexes: new Set<number>()
      };
      for (const rowIndex of item.sourceRows ?? []) {
        mismatchEntry.rowIndexes.add(rowIndex);
      }
      mismatches.set(mismatchKey, mismatchEntry);
    }
  }

  const lineDiagnostics = Array.from(lines.values())
    .map((entry) => {
      const itemZones = Array.from(entry.itemZones).sort((a, b) => a.localeCompare(b, 'he'));
      const hasMultipleItemZones = itemZones.length > 1;
      const distributionAreaMessage =
        itemZones.length > 1
          ? (entry.distributionArea && itemZones.includes(entry.distributionArea)
              ? `line.distribution_area = ${entry.distributionArea} does not represent all orders/items`
              : 'line.distribution_area is too coarse to be authoritative')
          : (entry.distributionArea && itemZones[0] !== entry.distributionArea
              ? (entry.lineName === entry.distributionArea
                  ? `${entry.lineName} should not be assumed to be a normal geographic אזור הפצה`
                  : `line.distribution_area = ${entry.distributionArea} does not represent this item`)
              : null);

      return {
        lineId: entry.lineId,
        lineName: entry.lineName,
        distributionArea: entry.distributionArea,
        itemZones,
        orderNumbers: Array.from(entry.orderNumbers).sort((a, b) => a.localeCompare(b, 'he')),
        rowIndexes: Array.from(entry.rowIndexes).sort((a, b) => a - b),
        hasMultipleItemZones,
        message: hasMultipleItemZones
          ? `line ${entry.lineName} has multiple item zones: ${itemZones.join(', ')}`
          : `line ${entry.lineName} has item zone: ${itemZones[0] ?? 'unknown'}`,
        distributionAreaMessage
      } satisfies ManualShiftSourceZoneLineDiagnostic;
    })
    .sort((a, b) => a.lineName.localeCompare(b.lineName, 'he'));

  const orderDiagnostics = Array.from(orders.values())
    .map((entry) => {
      const itemZones = Array.from(entry.itemZones).sort((a, b) => a.localeCompare(b, 'he'));
      const hasMixedItemZones = itemZones.length > 1;

      return {
        orderId: entry.orderId,
        orderNumber: entry.orderNumber,
        lineId: entry.lineId,
        lineName: entry.lineName,
        distributionArea: entry.distributionArea,
        routeBase: entry.routeBase,
        rawRouteLine: entry.rawRouteLine,
        pointName: entry.pointName,
        itemZones,
        rowIndexes: Array.from(entry.rowIndexes).sort((a, b) => a - b),
        hasMixedItemZones,
        message: hasMixedItemZones
          ? `order ${entry.orderNumber} has mixed item zones: ${itemZones.join(', ')}`
          : `routeBase ${entry.routeBase ?? entry.lineName} can have source zone different from ${entry.distributionArea ?? entry.lineName}`
      } satisfies ManualShiftSourceZoneOrderDiagnostic;
    })
    .sort((a, b) => a.lineName.localeCompare(b.lineName, 'he') || a.orderNumber.localeCompare(b.orderNumber, 'he'));

  const mismatchDiagnostics = Array.from(mismatches.values())
    .map((entry) => ({
      orderId: entry.orderId,
      orderNumber: entry.orderNumber,
      lineId: entry.lineId,
      lineName: entry.lineName,
      distributionArea: entry.distributionArea,
      routeBase: entry.routeBase,
      rawRouteLine: entry.rawRouteLine,
      pointName: entry.pointName,
      itemZone: entry.itemZone,
      rowIndexes: Array.from(entry.rowIndexes).sort((a, b) => a - b),
      message: `routeBase ${entry.routeBase ?? entry.lineName} can have source zone different from ${entry.distributionArea ?? entry.lineName}`
    }))
    .sort((a, b) =>
      a.lineName.localeCompare(b.lineName, 'he') ||
      a.orderNumber.localeCompare(b.orderNumber, 'he') ||
      a.itemZone.localeCompare(b.itemZone, 'he') ||
      compareMaybeString(a.distributionArea, b.distributionArea)
    );

  return {
    lines: lineDiagnostics,
    orders: orderDiagnostics,
    mismatches: mismatchDiagnostics
  };
}

const CONFIDENCE_RANK: Record<ClassificationConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function lowestConfidence(values: ClassificationConfidence[]): ClassificationConfidence {
  let lowest: ClassificationConfidence = 'high';
  for (const v of values) {
    if (CONFIDENCE_RANK[v] < CONFIDENCE_RANK[lowest]) lowest = v;
  }
  return lowest;
}

function buildRouteGroupsForLine(
  lineOrders: ManualShiftOrder[],
  rollups: Map<string, { lineCount: number; totalQuantity: number }>,
  checkUnitsByOrderId: Map<string, ManualShiftOrderCheckUnit[]>,
  ashlamotByOrderId: Map<string, ManualShiftOrderAshlama[]>,
  sourceZoneByOrderId: Map<string, string | null>
): ManualShiftWorkHierarchyRouteGroup[] {
  const fragments: RouteFragmentInput[] = lineOrders.map((o) => ({
    orderNumber: o.orderNumber ?? '',
    customerName: o.customerName,
    rawRouteLine: o.rawRouteLine ?? null,
    routeBase: o.routeBase ?? null,
    workBucketName: o.workBucketName ?? null,
    pointName: o.pointName,
  }));

  const classified = classifyRouteFragments(fragments);

  // Build lookup from 5-field composite fragment key to original order.
  // classifyRouteFragments reorders results (groups by orderNumber+routeBase,
  // sorts by first appearance, and within Rule 2 outputs base before
  // category before standalone).  Index-based matching is therefore wrong;
  // we match by fragment identity instead.
  //
  // Each key maps to a queue of orders (preserving input order).
  // Classified results consume the first matching order from its key's queue.
  // This correctly handles both unique keys and rare duplicates (e.g. legacy
  // test data without route fields), because within each key group the
  // classification output preserves the input relative order.
  const makeFragmentKey = (f: {
    orderNumber?: string | null;
    rawRouteLine?: string | null;
    routeBase?: string | null;
    workBucketName?: string | null;
    pointName?: string | null;
  }) =>
    [
      f.orderNumber ?? '',
      f.rawRouteLine ?? '',
      f.routeBase ?? '',
      f.workBucketName ?? '',
      f.pointName ?? '',
    ].join('\u0001');

  const orderQueue = new Map<string, ManualShiftOrder[]>();
  for (const order of lineOrders) {
    const key = makeFragmentKey(order);
    const list = orderQueue.get(key) ?? [];
    list.push(order);
    orderQueue.set(key, list);
  }

  const classifiedOrders = classified.map((c) => {
    const key = makeFragmentKey(c);
    const queue = orderQueue.get(key);
    if (!queue || queue.length === 0) {
      throw new Error(
        `Cannot match classified fragment back to order: ${key}`
      );
    }
    const order = queue.shift()!;
    return { classification: c, order };
  });

  // Defensive: every input order must have been consumed
  for (const [key, queue] of orderQueue) {
    if (queue.length > 0) {
      throw new Error(
        `Unmatched orders remain for fragment key: ${key} (${queue.length} orders)`
      );
    }
  }

  // Group by routeGroupKey
  const distributionGroupMap = new Map<string, typeof classifiedOrders>();
  for (const co of classifiedOrders) {
    const key = co.classification.routeGroupKey;
    const list = distributionGroupMap.get(key) ?? [];
    list.push(co);
    distributionGroupMap.set(key, list);
  }

  const routeGroups: ManualShiftWorkHierarchyRouteGroup[] = [];
  for (const [, rgEntries] of distributionGroupMap) {
    // Group by workBucketKey within this route group
    const workGroupMap = new Map<string, typeof rgEntries>();
    for (const entry of rgEntries) {
      const key = entry.classification.workBucketKey;
      const list = workGroupMap.get(key) ?? [];
      list.push(entry);
      workGroupMap.set(key, list);
    }

    const workBuckets: ManualShiftWorkHierarchyWorkBucket[] = [];
    for (const [, wbEntries] of workGroupMap) {
      const reasonSet = new Set(wbEntries.map((e) => e.classification.classificationReason));
      const confidenceLevels = wbEntries.map((e) => e.classification.classificationConfidence);

      const bucketOrders: ManualShiftWorkHierarchyOrder[] = wbEntries.map((e) => {
        const o = e.order;
        const ru = rollups.get(o.id);
        const totalQuantity = ru ? ru.totalQuantity : 0;
        const orderCheckUnits = checkUnitsByOrderId.get(o.id) ?? [];
        const orderAshlamot = ashlamotByOrderId.get(o.id) ?? [];
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          pointName: o.pointName,
          sourceZone: sourceZoneByOrderId.get(o.id) ?? null,
          status: o.status,
          lineCount: ru ? ru.lineCount : 0,
          totalQuantity,
          hasAshlama: orderAshlamot.some((a) => a.status === 'open'),
          hasCheckUnits: orderCheckUnits.length > 0,
        };
      });

      const wbClassification = wbEntries[0].classification;
      workBuckets.push({
        workBucketKey: wbClassification.workBucketKey,
        workBucketName: wbClassification.workBucketDisplayName,
        workBucketDisplayName: wbClassification.workBucketDisplayName,
        workBucketKind: wbClassification.workBucketKind,
        // @deprecated aliases — business-correct names
        workGroupKey: wbClassification.workGroupKey,
        workGroupName: wbClassification.workBucketDisplayName,
        workGroupDisplayName: wbClassification.workGroupDisplayName,
        workGroupKind: wbClassification.workBucketKind,
        classificationConfidence: lowestConfidence(confidenceLevels),
        classificationReasons: Array.from(reasonSet),
        orderCount: wbEntries.length,
        itemLinesCount: wbEntries.reduce((s, e) => {
          const ru = rollups.get(e.order.id);
          return s + (ru ? ru.lineCount : 0);
        }, 0),
        totalQuantity: bucketOrders.reduce((s, o) => s + o.totalQuantity, 0),
        statusBreakdown: computeStatusBreakdown(wbEntries.map((e) => e.order)),
        orders: bucketOrders,
      });
    }

    const rgAllOrders = rgEntries.map((e) => e.order);
    const rgReasonSet = new Set(rgEntries.map((e) => e.classification.classificationReason));
    const rgConfidenceLevels = rgEntries.map((e) => e.classification.classificationConfidence);

    const rgClassification = rgEntries[0].classification;
    routeGroups.push({
      routeGroupKey: rgClassification.routeGroupKey,
      routeGroupName: rgClassification.routeGroupName,
      routeGroupKind: rgClassification.routeGroupKind,
      // @deprecated aliases — business-correct names
      distributionGroupName: rgClassification.distributionGroupName,
      distributionGroupKind: rgClassification.routeGroupKind,
      classificationConfidence: lowestConfidence(rgConfidenceLevels),
      classificationReasons: Array.from(rgReasonSet),
      orderCount: workBuckets.reduce((s, wb) => s + wb.orderCount, 0),
      itemLinesCount: workBuckets.reduce((s, wb) => s + wb.itemLinesCount, 0),
      totalQuantity: workBuckets.reduce((s, wb) => s + wb.totalQuantity, 0),
      statusBreakdown: computeStatusBreakdown(rgAllOrders),
      workBuckets,
    });
  }

  return routeGroups;
}

function getManualShiftLineKind(lineName: string): 'route' | 'delivery_channel' {
  const normalized = lineName.trim().toLowerCase();
  if (normalized.startsWith("צ'יטה")) return 'delivery_channel';
  return 'route';
}

function isChitaLine(lineKind: 'route' | 'delivery_channel', lineName: string | null | undefined) {
  return lineKind === 'delivery_channel' && normalizeHebrewName(lineName) === "צ'יטה";
}

function getChitaBucketKey(order: Pick<ManualShiftOrder, 'id'>): string {
  return order.id;
}

function getChitaBucketDisplayName(
  order: Pick<ManualShiftOrder, 'id' | 'orderNumber' | 'customerName' | 'pointName'>,
  sourceZone: string | null
): string {
  return (
    normalizeOptionalString(order.orderNumber) ??
    normalizeOptionalString(order.customerName) ??
    normalizeSourceZone(sourceZone) ??
    normalizeOptionalString(order.pointName) ??
    order.id
  );
}

export function buildShiftWorkHierarchy(
  shiftId: string,
  lineRows: ManualShiftLineRow[],
  orders: ManualShiftOrder[],
  rollups: Map<string, { lineCount: number; totalQuantity: number }>,
  checkUnits: ManualShiftOrderCheckUnit[],
  ashlamot: ManualShiftOrderAshlama[],
  items: ManualShiftOrderItem[] = []
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

  const effectiveSourceZoneByOrderId = buildEffectiveSourceZoneLookup({ orders, items });

  const ordersByLineId = new Map<string, ManualShiftOrder[]>();
  for (const order of orders) {
    const list = ordersByLineId.get(order.lineId) ?? [];
    list.push(order);
    ordersByLineId.set(order.lineId, list);
  }

  type LineProjectionRecord = {
    sortOrder: number;
    createdAt: string;
    line: ManualShiftWorkHierarchyLine;
  };

  const areasMap = new Map<string, {
    areaName: string | null;
    displayName: string;
    lines: LineProjectionRecord[];
  }>();

  for (const row of lineRows) {
    const lineOrders = ordersByLineId.get(row.id) ?? [];
    const lineKind = getManualShiftLineKind(row.name);
    const chitaLine = isChitaLine(lineKind, row.name);
    const bucketsMap = new Map<string | null, ManualShiftOrder[]>();
    const lineSourceZones = new Set<string>();

    for (const order of lineOrders) {
      const sourceZone = effectiveSourceZoneByOrderId.get(order.id) ?? null;
      if (sourceZone) {
        lineSourceZones.add(sourceZone);
      }

      const bucketKey = chitaLine ? getChitaBucketKey(order) : (order.pointName ?? null);
      const list = bucketsMap.get(bucketKey) ?? [];
      list.push(order);
      bucketsMap.set(bucketKey, list);
    }

    if (bucketsMap.size === 0) {
      bucketsMap.set(null, []);
    }

    const bucketEntries = chitaLine
      ? Array.from(bucketsMap.entries())
      : Array.from(bucketsMap.entries()).sort(([a], [b]) => {
          if (a === UNKNOWN_SOURCE_ZONE_KEY) return -1;
          if (b === UNKNOWN_SOURCE_ZONE_KEY) return 1;
          if (a === null) return -1;
          if (b === null) return 1;
          return sourceZoneDisplayName(a).localeCompare(sourceZoneDisplayName(b), 'he');
        });

    const buckets: ManualShiftWorkHierarchyBucket[] = [];
    for (const [bucketName, bucketOrders] of bucketEntries) {
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
          sourceZone: effectiveSourceZoneByOrderId.get(o.id) ?? null,
          status: o.status,
          lineCount: rollup ? rollup.lineCount : 0,
          totalQuantity,
          hasAshlama: orderAshlamot.some((a) => a.status === 'open'),
          hasCheckUnits: orderCheckUnits.length > 0,
          rawDestinationLabel: o.rawDestinationLabel ?? null,
          deliveryPointId: o.deliveryPointId ?? null,
          deliveryPointName: o.deliveryPointName ?? null,
          deliveryPointMatchStatus: o.deliveryPointMatchStatus,
          deliveryPointAliasText: o.deliveryPointAliasText ?? null
        };
      });

      const firstOrder = bucketOrders[0] ?? null;
      const bucketSourceZone = firstOrder
        ? (effectiveSourceZoneByOrderId.get(firstOrder.id) ?? null)
        : null;

      buckets.push({
        bucketName: chitaLine
          ? bucketName
          : (bucketName === UNKNOWN_SOURCE_ZONE_KEY ? null : bucketName),
        displayName: chitaLine
          ? (firstOrder ? getChitaBucketDisplayName(firstOrder, bucketSourceZone) : sourceZoneDisplayName(null))
          : (bucketName ?? 'קו ראשי'),
        totalOrders: bucketOrders.length,
        totalQuantity: hierarchyOrders.reduce((s, o) => s + o.totalQuantity, 0),
        statusBreakdown: computeStatusBreakdown(bucketOrders),
        orders: hierarchyOrders
      });
    }

    if (!chitaLine) {
      buckets.sort((a, b) => {
        if (a.bucketName === null) return -1;
        if (b.bucketName === null) return 1;
        return a.bucketName.localeCompare(b.bucketName, 'he');
      });
    }

    const routeGroups = chitaLine
      ? []
      : buildRouteGroupsForLine(
          lineOrders,
          rollups,
          checkUnitsByOrderId,
          ashlamotByOrderId,
          effectiveSourceZoneByOrderId
        );

    const itemLinesCount = lineOrders.reduce((s, order) => {
      const rollup = rollups.get(order.id);
      return s + (rollup ? rollup.lineCount : 0);
    }, 0);
    const uniqueSourceZones = Array.from(lineSourceZones);

    const line: ManualShiftWorkHierarchyLine = {
      lineId: row.id,
      areaLineKey: row.id,
      lineGroupName: row.name,
      // @deprecated alias — use lineName
      lineName: row.name,
      distributionArea: row.distribution_area,
      sourceZone: uniqueSourceZones.length === 1 ? uniqueSourceZones[0] : null,
      lineKind,
      status: deriveManualShiftLineStatus(lineOrders),
      totalBuckets: buckets.length,
      totalOrders: lineOrders.length,
      totalQuantity: buckets.reduce((s, b) => s + b.totalQuantity, 0),
      itemLinesCount,
      statusBreakdown: computeStatusBreakdown(lineOrders),
      buckets,
      routeGroups
    };

    const areaKey = chitaLine ? "צ'יטה" : row.distribution_area;
    const areaMapKey = areaKey ?? '__null_area__';
    const areaEntry = areasMap.get(areaMapKey) ?? {
      areaName: areaKey,
      displayName: chitaLine ? "צ'יטה" : sourceZoneDisplayName(areaKey),
      lines: []
    };
    areaEntry.lines.push({
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      line
    });
    areasMap.set(areaMapKey, areaEntry);
  }

  const areas: ManualShiftWorkHierarchyArea[] = [];
  for (const [, areaEntry] of areasMap) {
    const sortedAreaLines = [...areaEntry.lines].sort((a, b) =>
      a.sortOrder - b.sortOrder ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.line.lineGroupName.localeCompare(b.line.lineGroupName, 'he') ||
      a.line.areaLineKey!.localeCompare(b.line.areaLineKey!)
    );
    const areaLines = sortedAreaLines.map((entry) => entry.line);
    const statusBreakdown = areaLines.reduce((acc, line) => ({
      queued: acc.queued + line.statusBreakdown.queued,
      picking: acc.picking + line.statusBreakdown.picking,
      waitingCheck: acc.waitingCheck + line.statusBreakdown.waitingCheck,
      returned: acc.returned + line.statusBreakdown.returned,
      done: acc.done + line.statusBreakdown.done,
      blocked: (acc.blocked ?? 0) + (line.statusBreakdown.blocked ?? 0)
    }), { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 } as {
      queued: number;
      picking: number;
      waitingCheck: number;
      returned: number;
      done: number;
      blocked?: number;
    });

    areas.push({
      areaName: areaEntry.areaName,
      displayName: areaEntry.displayName,
      totalLines: areaLines.length,
      totalBuckets: areaLines.reduce((s, l) => s + l.totalBuckets, 0),
      totalOrders: areaLines.reduce((s, l) => s + l.totalOrders, 0),
      totalQuantity: areaLines.reduce((s, l) => s + l.totalQuantity, 0),
      itemLinesCount: areaLines.reduce((s, l) => s + (l.itemLinesCount ?? 0), 0),
      statusBreakdown,
      lines: areaLines
    });
  }

  areas.sort((a, b) => {
    if (a.areaName === null) return -1;
    if (b.areaName === null) return 1;
    return a.areaName.localeCompare(b.areaName, 'he');
  });

  return {
    shiftId,
    areas
  };
}
