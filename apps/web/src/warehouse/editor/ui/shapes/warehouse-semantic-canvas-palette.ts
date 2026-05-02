import type { CellVisualPalette } from './rack-cells-visual-state';

const FALLBACK_TOKENS = {
  '--wh-surface-subtle': 'rgba(244, 248, 251, 0.92)',
  '--wh-border': 'rgba(148, 163, 184, 0.28)',
  '--wh-border-strong': 'rgba(71, 85, 105, 0.2)',
  '--wh-selected-fill': 'rgba(15, 106, 142, 0.18)',
  '--wh-selected-border': '#0f6a8e',
  '--wh-focused-fill': 'rgba(45, 118, 168, 0.1)',
  '--wh-focused-border': '#5c92bb',
  '--wh-locate-target-fill': 'rgba(0, 122, 92, 0.18)',
  '--wh-locate-target-border': '#007a5c',
  '--wh-search-hit-fill': 'rgba(211, 141, 0, 0.14)',
  '--wh-search-hit-border': '#b7791f',
  '--wh-occupied-fill': 'rgba(0, 122, 92, 0.14)',
  '--wh-occupied-border': '#218367',
  '--wh-empty-fill': 'rgba(98, 108, 125, 0.1)',
  '--wh-empty-border': '#728197',
  '--wh-blocked-fill': 'rgba(120, 61, 18, 0.16)',
  '--wh-blocked-border': '#9a5d1b',
  '--wh-reserved-fill': 'rgba(178, 156, 224, 0.34)',
  '--wh-reserved-border': '#7b67ad',
  '--wh-reserved-dot': 'rgba(92, 71, 143, 0.28)',
  '--wh-warning-fill': 'rgba(214, 158, 46, 0.18)',
  '--wh-warning-border': '#b7791f',
  '--wh-conflict-fill': 'rgba(198, 88, 49, 0.16)',
  '--wh-conflict-border': '#c05621',
  '--wh-override-fill': 'rgba(86, 44, 145, 0.14)',
  '--wh-override-border': '#6b46c1'
} as const;

function resolveCssVariable(name: keyof typeof FALLBACK_TOKENS): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_TOKENS[name];
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || FALLBACK_TOKENS[name];
}

export function getWarehouseSemanticCellPalette(params?: {
  rackSelected?: boolean;
  faceTone?: 'primary' | 'secondary';
}): CellVisualPalette {
  const rackSelected = params?.rackSelected ?? false;
  const faceTone = params?.faceTone ?? 'primary';
  const baseFill = resolveCssVariable('--wh-surface-subtle');
  const baseStroke =
    faceTone === 'secondary'
      ? resolveCssVariable('--wh-border')
      : resolveCssVariable('--wh-border-strong');

  return {
    baseFill: rackSelected ? resolveCssVariable('--wh-focused-fill') : baseFill,
    baseStroke: rackSelected ? resolveCssVariable('--wh-focused-border') : baseStroke,
    occupiedFill: resolveCssVariable('--wh-occupied-fill'),
    occupiedStroke: resolveCssVariable('--wh-occupied-border'),
    selectedFill: resolveCssVariable('--wh-selected-fill'),
    selectedStroke: resolveCssVariable('--wh-selected-border'),
    focusedFill: resolveCssVariable('--wh-focused-fill'),
    focusedStroke: resolveCssVariable('--wh-focused-border'),
    locateTargetFill: resolveCssVariable('--wh-locate-target-fill'),
    locateTargetStroke: resolveCssVariable('--wh-locate-target-border'),
    searchHitFill: resolveCssVariable('--wh-search-hit-fill'),
    searchHitStroke: resolveCssVariable('--wh-search-hit-border'),
    workflowSourceFill: resolveCssVariable('--wh-override-fill'),
    workflowSourceStroke: resolveCssVariable('--wh-override-border'),
    blockedFill: resolveCssVariable('--wh-blocked-fill'),
    blockedStroke: resolveCssVariable('--wh-blocked-border'),
    reservedDot: resolveCssVariable('--wh-reserved-dot'),
    stockedFill: resolveCssVariable('--wh-occupied-fill'),
    stockedStroke: resolveCssVariable('--wh-occupied-border'),
    pickActiveFill: resolveCssVariable('--wh-override-fill'),
    pickActiveStroke: resolveCssVariable('--wh-override-border'),
    reservedFill: resolveCssVariable('--wh-reserved-fill'),
    reservedStroke: resolveCssVariable('--wh-reserved-border'),
    quarantinedFill: resolveCssVariable('--wh-conflict-fill'),
    quarantinedStroke: resolveCssVariable('--wh-conflict-border'),
    emptyFill: resolveCssVariable('--wh-empty-fill'),
    emptyStroke: resolveCssVariable('--wh-empty-border')
  };
}

export function getWarehouseCanvasChromeTokens() {
  return {
    background: resolveCssVariable('--wh-surface-subtle'),
    backgroundLocate: resolveCssVariable('--wh-locate-target-fill'),
    backgroundZone: resolveCssVariable('--wh-occupied-fill'),
    backgroundWall: resolveCssVariable('--wh-warning-fill'),
    gridMinor: resolveCssVariable('--wh-border'),
    gridMajor: resolveCssVariable('--wh-border-strong'),
    gridLocate: resolveCssVariable('--wh-locate-target-border'),
    marqueeFill: resolveCssVariable('--wh-selected-fill'),
    marqueeStroke: resolveCssVariable('--wh-selected-border'),
    originStroke: resolveCssVariable('--wh-empty-border')
  };
}
