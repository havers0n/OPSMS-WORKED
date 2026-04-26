export type PlanningWarningSeverity = 'info' | 'warning' | 'error';

export type PlanningWarningCode =
  | 'EMPTY_WORKLOAD'
  | 'EMPTY_WAVE'
  | 'POST_SORT_REQUIRED'
  | 'ORDER_SEPARATION_NOT_PRESERVED'
  | 'CART_REQUIRED_FOR_CLUSTER'
  | 'DISTANCE_MODE_FALLBACK'
  | 'UNKNOWN_SOURCE_LOCATION'
  | 'UNKNOWN_WEIGHT'
  | 'UNKNOWN_VOLUME'
  | 'MISSING_DIMENSIONS'
  | 'WORKLOAD_EXCEEDS_PICK_LINES'
  | 'WORKLOAD_EXCEEDS_WEIGHT'
  | 'WORKLOAD_EXCEEDS_VOLUME'
  | 'WORKLOAD_EXCEEDS_LOCATIONS'
  | 'WORKLOAD_EXCEEDS_ZONES'
  | 'WORK_PACKAGE_SPLIT_BY_ZONE'
  | 'WORK_PACKAGE_SPLIT_BY_AISLE_OR_LOCATION'
  | 'WORK_PACKAGE_SPLIT_BY_WEIGHT'
  | 'WORK_PACKAGE_SPLIT_BY_VOLUME'
  | 'WORK_PACKAGE_SPLIT_BY_PICK_LINES'
  | 'HAZMAT_PRESENT'
  | 'UNRESOLVED_PLANNING_LINES_PRESENT'
  | 'NO_AVAILABLE_INVENTORY'
  | 'NO_PRIMARY_PICK_LOCATION'
  | 'MISSING_PRODUCT'
  | 'MISSING_SOURCE_LOCATION'
  | 'UNSUPPORTED_UOM'
  | 'MISSING_ORDER_LINE';

export type PlanningWarningSource =
  | 'domain'
  | 'builder'
  | 'bff'
  | 'wave'
  | 'route'
  | 'split'
  | 'complexity';

export type PlanningWarning = {
  code: PlanningWarningCode;
  severity: PlanningWarningSeverity;
  message: string;
  source?: PlanningWarningSource;
  details?: Record<string, unknown>;
};

export function createPlanningWarning(
  code: PlanningWarningCode,
  message: string,
  options?: {
    severity?: PlanningWarningSeverity;
    source?: PlanningWarning['source'];
    details?: Record<string, unknown>;
  }
): PlanningWarning {
  return {
    code,
    severity: options?.severity ?? 'warning',
    message,
    source: options?.source,
    details: options?.details
  };
}

export function dedupePlanningWarnings(warnings: PlanningWarning[]): PlanningWarning[] {
  const seen = new Set<string>();
  const uniqueWarnings: PlanningWarning[] = [];

  for (const warning of warnings) {
    const key = `${warning.code}:${warning.message}:${JSON.stringify(warning.details ?? {})}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueWarnings.push(warning);
    }
  }

  return uniqueWarnings;
}

export function warningMessages(warnings: PlanningWarning[]): string[] {
  return warnings.map((warning) => warning.message);
}
