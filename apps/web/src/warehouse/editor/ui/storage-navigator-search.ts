import type { LocationStorageSnapshotRow } from '@wos/domain';

export type CellBadge =
  | { kind: 'container'; label: string }
  | { kind: 'aggregate'; label: string }
  | null;

export type SearchMatchCategory = 'none' | 'location' | 'container' | 'product';

export type ProductSubtitlePresentation =
  | {
      kind: 'single-product';
      productName: string;
      sku: string | null;
      quantityLabel: string | null;
      matchedContainerCount: number;
    }
  | {
      kind: 'multiple-products';
      count: number;
    };

export type CellSearchPresentation = {
  matches: boolean;
  matchCategory: SearchMatchCategory;
  badge: CellBadge;
  subtitle: ProductSubtitlePresentation | null;
};

type MatchCandidate = {
  priority: number;
  category: Exclude<SearchMatchCategory, 'none'>;
  containerId: string | null;
  productKey: string | null;
  rowIndex: number | null;
};

const locationSeparatorPattern = /[\s.-]+/g;

function normalizeSearchToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCompactLocation(value: string): string {
  return normalizeSearchToken(value).replace(locationSeparatorPattern, '');
}

function asNonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function getContainerDisplayCode(
  row: Pick<LocationStorageSnapshotRow, 'externalCode' | 'systemCode' | 'containerId'>
): string {
  return row.externalCode ?? row.systemCode ?? row.containerId;
}

function getProductKey(row: LocationStorageSnapshotRow): string | null {
  const productId = asNonEmptyString(row.product?.id);
  if (productId) return `product:${productId}`;

  const sku = asNonEmptyString(row.product?.sku);
  if (sku) return `sku:${normalizeSearchToken(sku)}`;

  const externalProductId = asNonEmptyString(row.product?.externalProductId);
  if (externalProductId) return `external:${normalizeSearchToken(externalProductId)}`;

  const itemRef = asNonEmptyString(row.itemRef);
  if (itemRef) return `item:${normalizeSearchToken(itemRef)}`;

  const productName = asNonEmptyString(row.product?.name);
  if (productName) return `name:${normalizeSearchToken(productName)}`;

  return null;
}

function resolveDefaultBadge(rows: LocationStorageSnapshotRow[], aggregateLabel: string): CellBadge {
  if (rows.length === 0) return null;

  const containers = new Map<string, LocationStorageSnapshotRow>();
  for (const row of rows) {
    if (!containers.has(row.containerId)) {
      containers.set(row.containerId, row);
    }
  }

  if (containers.size === 1) {
    return { kind: 'container', label: getContainerDisplayCode(Array.from(containers.values())[0]) };
  }

  return { kind: 'aggregate', label: aggregateLabel };
}

function resolveMatchedContainerBadge(
  rows: LocationStorageSnapshotRow[],
  matchedContainerIds: Set<string>,
  aggregateLabel: string
): CellBadge {
  if (matchedContainerIds.size === 0) return resolveDefaultBadge(rows, aggregateLabel);
  if (matchedContainerIds.size > 1) return { kind: 'aggregate', label: aggregateLabel };

  const matchedContainerId = Array.from(matchedContainerIds)[0];
  const matchedRow = rows.find((row) => row.containerId === matchedContainerId);
  if (!matchedRow) return resolveDefaultBadge(rows, aggregateLabel);

  return { kind: 'container', label: getContainerDisplayCode(matchedRow) };
}

function resolveAggregatedQuantityLabel(rows: LocationStorageSnapshotRow[]): string | null {
  if (rows.length === 0) return null;

  let totalQuantity = 0;
  let resolvedUom: string | null = null;

  for (const row of rows) {
    if (typeof row.quantity !== 'number' || !Number.isFinite(row.quantity) || row.quantity < 0) {
      return null;
    }

    const uom = asNonEmptyString(row.uom);
    if (!uom) return null;

    if (resolvedUom === null) {
      resolvedUom = uom;
    } else if (resolvedUom !== uom) {
      return null;
    }

    totalQuantity += row.quantity;
  }

  if (resolvedUom === null || totalQuantity <= 0) return null;
  return `${formatQuantity(totalQuantity)} ${resolvedUom}`;
}

function pushValueMatchCandidate(
  candidates: MatchCandidate[],
  query: string,
  value: string | null,
  match: Omit<MatchCandidate, 'priority'>
      & { exactPriority: number; partialPriority: number }
): void {
  if (!value) return;

  const normalizedValue = normalizeSearchToken(value);
  if (normalizedValue === query) {
    candidates.push({
      priority: match.exactPriority,
      category: match.category,
      containerId: match.containerId,
      productKey: match.productKey,
      rowIndex: match.rowIndex
    });
    return;
  }

  if (normalizedValue.includes(query)) {
    candidates.push({
      priority: match.partialPriority,
      category: match.category,
      containerId: match.containerId,
      productKey: match.productKey,
      rowIndex: match.rowIndex
    });
  }
}

function collectMatchCandidates(
  cellAddress: string,
  rows: LocationStorageSnapshotRow[],
  normalizedQuery: string
): MatchCandidate[] {
  if (normalizedQuery === '') return [];

  const candidates: MatchCandidate[] = [];
  const locationValues = new Set<string>([
    cellAddress,
    normalizeCompactLocation(cellAddress)
  ]);

  for (const row of rows) {
    locationValues.add(row.locationCode);
    locationValues.add(normalizeCompactLocation(row.locationCode));
  }

  let hasExactLocationMatch = false;
  let hasPartialLocationMatch = false;
  for (const locationValue of locationValues) {
    const normalizedValue = locationValue.includes('.') || locationValue.includes('-') || locationValue.includes(' ')
      ? normalizeSearchToken(locationValue)
      : locationValue;
    if (normalizedValue === normalizedQuery) {
      hasExactLocationMatch = true;
      break;
    }
    if (normalizedValue.includes(normalizedQuery)) {
      hasPartialLocationMatch = true;
    }
  }

  if (hasExactLocationMatch) {
    candidates.push({
      priority: 1,
      category: 'location',
      containerId: null,
      productKey: null,
      rowIndex: null
    });
  } else if (hasPartialLocationMatch) {
    candidates.push({
      priority: 6,
      category: 'location',
      containerId: null,
      productKey: null,
      rowIndex: null
    });
  }

  rows.forEach((row, rowIndex) => {
    pushValueMatchCandidate(candidates, normalizedQuery, asNonEmptyString(row.externalCode), {
      exactPriority: 2,
      partialPriority: 7,
      category: 'container',
      containerId: row.containerId,
      productKey: null,
      rowIndex
    });
    pushValueMatchCandidate(candidates, normalizedQuery, asNonEmptyString(row.systemCode), {
      exactPriority: 2,
      partialPriority: 7,
      category: 'container',
      containerId: row.containerId,
      productKey: null,
      rowIndex
    });

    const productKey = getProductKey(row);
    pushValueMatchCandidate(candidates, normalizedQuery, asNonEmptyString(row.product?.sku), {
      exactPriority: 3,
      partialPriority: 8,
      category: 'product',
      containerId: row.containerId,
      productKey,
      rowIndex
    });
    pushValueMatchCandidate(candidates, normalizedQuery, asNonEmptyString(row.product?.externalProductId), {
      exactPriority: 4,
      partialPriority: 9,
      category: 'product',
      containerId: row.containerId,
      productKey,
      rowIndex
    });
    pushValueMatchCandidate(candidates, normalizedQuery, asNonEmptyString(row.product?.name), {
      exactPriority: 5,
      partialPriority: 10,
      category: 'product',
      containerId: row.containerId,
      productKey,
      rowIndex
    });
  });

  return candidates;
}

export function resolveCellSearchPresentation(params: {
  cellAddress: string;
  rows: LocationStorageSnapshotRow[];
  normalizedQuery: string;
  aggregateLabel: string;
}): CellSearchPresentation {
  const { cellAddress, rows, normalizedQuery, aggregateLabel } = params;

  if (normalizedQuery === '') {
    return {
      matches: true,
      matchCategory: 'none',
      badge: resolveDefaultBadge(rows, aggregateLabel),
      subtitle: null
    };
  }

  const candidates = collectMatchCandidates(cellAddress, rows, normalizedQuery);
  if (candidates.length === 0) {
    return {
      matches: false,
      matchCategory: 'none',
      badge: resolveDefaultBadge(rows, aggregateLabel),
      subtitle: null
    };
  }

  const winningPriority = Math.min(...candidates.map((candidate) => candidate.priority));
  const winningCandidates = candidates.filter((candidate) => candidate.priority === winningPriority);
  const matchCategory = winningCandidates[0]?.category ?? 'none';

  if (matchCategory === 'location') {
    return {
      matches: true,
      matchCategory,
      badge: resolveDefaultBadge(rows, aggregateLabel),
      subtitle: null
    };
  }

  if (matchCategory === 'container') {
    const matchedContainerIds = new Set(
      winningCandidates
        .map((candidate) => candidate.containerId)
        .filter((containerId): containerId is string => containerId !== null)
    );

    return {
      matches: true,
      matchCategory,
      badge: resolveMatchedContainerBadge(rows, matchedContainerIds, aggregateLabel),
      subtitle: null
    };
  }

  const matchedRows = Array.from(
    new Set(
      winningCandidates
        .map((candidate) => candidate.rowIndex)
        .filter((rowIndex): rowIndex is number => rowIndex !== null)
    )
  ).map((rowIndex) => rows[rowIndex]);

  const matchedRowsByProductKey = new Map<string, LocationStorageSnapshotRow[]>();
  for (const row of matchedRows) {
    const productKey = getProductKey(row);
    if (!productKey) continue;

    const existing = matchedRowsByProductKey.get(productKey);
    if (existing) {
      existing.push(row);
    } else {
      matchedRowsByProductKey.set(productKey, [row]);
    }
  }

  const matchedContainerIds = new Set(matchedRows.map((row) => row.containerId));
  const badge = resolveMatchedContainerBadge(rows, matchedContainerIds, aggregateLabel);

  if (matchedRowsByProductKey.size !== 1) {
    return {
      matches: true,
      matchCategory: 'product',
      badge,
      subtitle: { kind: 'multiple-products', count: matchedRowsByProductKey.size }
    };
  }

  const [productRows] = Array.from(matchedRowsByProductKey.values());
  const representativeRow = productRows[0];
  const productName = representativeRow.product?.name ?? representativeRow.product?.sku ?? representativeRow.product?.externalProductId;

  if (!productName) {
    return {
      matches: true,
      matchCategory: 'product',
      badge,
      subtitle: { kind: 'multiple-products', count: 1 }
    };
  }

  return {
    matches: true,
    matchCategory: 'product',
    badge,
    subtitle: {
      kind: 'single-product',
      productName,
      sku: matchedContainerIds.size === 1 ? representativeRow.product?.sku ?? null : null,
      quantityLabel: resolveAggregatedQuantityLabel(productRows),
      matchedContainerCount: matchedContainerIds.size
    }
  };
}
