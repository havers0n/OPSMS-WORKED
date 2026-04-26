import type { PickTaskCandidate, PickingStrategy } from './picking-planning';
import { createPlanningWarning, warningMessages, type PlanningWarning } from './planning-warning';
import { getDefaultPickingStrategy } from './picking-strategies';

export type ComplexityLevel = 'low' | 'medium' | 'high' | 'critical';

export type WorkloadComplexityLocationRef = {
  id: string;
  zoneId?: string;
  pickZoneId?: string;
  taskZoneId?: string;
  allocationZoneId?: string;
  accessAisleId?: string;
  routeSequence?: number;
};

export type WorkloadComplexityInput = {
  tasks: PickTaskCandidate[];
  locationsById?: Record<string, WorkloadComplexityLocationRef>;
  strategy?: PickingStrategy;
};

export type WorkloadComplexityScore = {
  level: ComplexityLevel;
  score: number;
  pickLines: number;
  uniqueSkuCount: number;
  uniqueLocationCount: number;
  uniqueZoneCount: number;
  uniqueAisleCount: number;
  totalWeightKg: number;
  totalVolumeLiters: number;
  heavyTaskCount: number;
  bulkyTaskCount: number;
  fragileTaskCount: number;
  coldTaskCount: number;
  hazmatTaskCount: number;
  unknownWeightCount: number;
  unknownVolumeCount: number;
  unknownLocationCount: number;
  exceeds: {
    maxPickLines: boolean;
    maxWeightKg: boolean;
    maxVolumeLiters: boolean;
    maxUniqueLocations: boolean;
    maxZones: boolean;
  };
  warnings: string[];
  warningDetails: PlanningWarning[];
};

function getZoneId(location?: WorkloadComplexityLocationRef): string | undefined {
  return location?.taskZoneId ?? location?.pickZoneId ?? location?.zoneId ?? location?.allocationZoneId;
}

function toComplexityLevel(score: number): ComplexityLevel {
  if (score < 40) {
    return 'low';
  }
  if (score < 80) {
    return 'medium';
  }
  if (score < 130) {
    return 'high';
  }
  return 'critical';
}

export function estimateWorkloadComplexity(input: WorkloadComplexityInput): WorkloadComplexityScore {
  const strategy = input.strategy ?? getDefaultPickingStrategy();
  const locationsById = input.locationsById ?? {};

  const skuIds = new Set<string>();
  const locationIds = new Set<string>();
  const zoneIds = new Set<string>();
  const aisleIds = new Set<string>();

  let totalWeightKg = 0;
  let totalVolumeLiters = 0;
  let unknownWeightCount = 0;
  let unknownVolumeCount = 0;
  let unknownLocationCount = 0;

  let heavyTaskCount = 0;
  let bulkyTaskCount = 0;
  let fragileTaskCount = 0;
  let coldTaskCount = 0;
  let hazmatTaskCount = 0;

  for (const task of input.tasks) {
    skuIds.add(task.skuId);

    const locationId = task.fromLocationId;
    if (locationId) {
      locationIds.add(locationId);
      const location = locationsById[locationId];

      if (location) {
        const zoneId = getZoneId(location);
        if (zoneId) {
          zoneIds.add(zoneId);
        }

        if (location.accessAisleId) {
          aisleIds.add(location.accessAisleId);
        }
      } else {
        unknownLocationCount += 1;
      }
    } else {
      unknownLocationCount += 1;
    }

    if (typeof task.weightKg === 'number') {
      totalWeightKg += task.weightKg;
    } else {
      unknownWeightCount += 1;
    }

    if (typeof task.volumeLiters === 'number') {
      totalVolumeLiters += task.volumeLiters;
    } else {
      unknownVolumeCount += 1;
    }

    switch (task.handlingClass) {
      case 'heavy':
        heavyTaskCount += 1;
        break;
      case 'bulky':
        bulkyTaskCount += 1;
        break;
      case 'fragile':
        fragileTaskCount += 1;
        break;
      case 'cold':
      case 'frozen':
        coldTaskCount += 1;
        break;
      case 'hazmat':
        hazmatTaskCount += 1;
        break;
      default:
        break;
    }
  }

  const pickLines = input.tasks.length;
  const uniqueLocationCount = locationIds.size;
  const uniqueZoneCount = zoneIds.size;

  const exceeds = {
    maxPickLines:
      strategy.splitPolicy.maxPickLines !== undefined && pickLines > strategy.splitPolicy.maxPickLines,
    maxWeightKg:
      strategy.splitPolicy.maxWeightKg !== undefined && totalWeightKg > strategy.splitPolicy.maxWeightKg,
    maxVolumeLiters:
      strategy.splitPolicy.maxVolumeLiters !== undefined &&
      totalVolumeLiters > strategy.splitPolicy.maxVolumeLiters,
    maxUniqueLocations:
      strategy.splitPolicy.maxUniqueLocations !== undefined &&
      uniqueLocationCount > strategy.splitPolicy.maxUniqueLocations,
    maxZones: strategy.splitPolicy.maxZones !== undefined && uniqueZoneCount > strategy.splitPolicy.maxZones
  };

  const exceededThresholdCount = Object.values(exceeds).filter(Boolean).length;

  const score =
    pickLines * 1 +
    uniqueLocationCount * 2 +
    uniqueZoneCount * 8 +
    aisleIds.size * 4 +
    totalWeightKg * 0.5 +
    totalVolumeLiters * 0.05 +
    heavyTaskCount * 4 +
    bulkyTaskCount * 5 +
    fragileTaskCount * 3 +
    coldTaskCount * 3 +
    hazmatTaskCount * 8 +
    unknownWeightCount * 2 +
    unknownVolumeCount * 2 +
    unknownLocationCount * 5 +
    exceededThresholdCount * 15;

  const warningDetails: PlanningWarning[] = [];
  if (exceeds.maxPickLines) {
    warningDetails.push(createPlanningWarning('WORKLOAD_EXCEEDS_PICK_LINES', 'Workload exceeds max pick lines.', { source: 'complexity' }));
  }
  if (exceeds.maxWeightKg) {
    warningDetails.push(createPlanningWarning('WORKLOAD_EXCEEDS_WEIGHT', 'Workload exceeds max weight.', { source: 'complexity' }));
  }
  if (exceeds.maxVolumeLiters) {
    warningDetails.push(createPlanningWarning('WORKLOAD_EXCEEDS_VOLUME', 'Workload exceeds max volume.', { source: 'complexity' }));
  }
  if (exceeds.maxUniqueLocations) {
    warningDetails.push(createPlanningWarning('WORKLOAD_EXCEEDS_LOCATIONS', 'Workload touches too many unique locations.', { source: 'complexity' }));
  }
  if (exceeds.maxZones) {
    warningDetails.push(createPlanningWarning('WORKLOAD_EXCEEDS_ZONES', 'Workload touches too many zones.', { source: 'complexity' }));
  }
  if (unknownWeightCount > 0) {
    warningDetails.push(createPlanningWarning('UNKNOWN_WEIGHT', 'Some tasks are missing weight.', { source: 'complexity', details: { count: unknownWeightCount } }));
  }
  if (unknownVolumeCount > 0) {
    warningDetails.push(createPlanningWarning('UNKNOWN_VOLUME', 'Some tasks are missing volume.', { source: 'complexity', details: { count: unknownVolumeCount } }));
  }
  if (unknownLocationCount > 0) {
    warningDetails.push(createPlanningWarning('UNKNOWN_SOURCE_LOCATION', 'Some tasks have unknown source locations.', { source: 'complexity', details: { count: unknownLocationCount } }));
  }
  const warnings = warningMessages(warningDetails);

  return {
    level: toComplexityLevel(score),
    score,
    pickLines,
    uniqueSkuCount: skuIds.size,
    uniqueLocationCount,
    uniqueZoneCount,
    uniqueAisleCount: aisleIds.size,
    totalWeightKg,
    totalVolumeLiters,
    heavyTaskCount,
    bulkyTaskCount,
    fragileTaskCount,
    coldTaskCount,
    hazmatTaskCount,
    unknownWeightCount,
    unknownVolumeCount,
    unknownLocationCount,
    exceeds,
    warnings,
    warningDetails
  };
}
