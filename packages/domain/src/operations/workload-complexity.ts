import type { PickTaskCandidate, PickingStrategy } from './picking-planning';
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

  const warnings: string[] = [];
  if (exceeds.maxPickLines) {
    warnings.push('Workload exceeds max pick lines.');
  }
  if (exceeds.maxWeightKg) {
    warnings.push('Workload exceeds max weight.');
  }
  if (exceeds.maxVolumeLiters) {
    warnings.push('Workload exceeds max volume.');
  }
  if (exceeds.maxUniqueLocations) {
    warnings.push('Workload touches too many unique locations.');
  }
  if (exceeds.maxZones) {
    warnings.push('Workload touches too many zones.');
  }
  if (unknownWeightCount > 0) {
    warnings.push('Some tasks are missing weight.');
  }
  if (unknownVolumeCount > 0) {
    warnings.push('Some tasks are missing volume.');
  }
  if (unknownLocationCount > 0) {
    warnings.push('Some tasks have unknown source locations.');
  }

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
    warnings
  };
}
