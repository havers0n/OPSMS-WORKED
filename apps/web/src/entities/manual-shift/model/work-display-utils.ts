import type {
  ManualShiftWorkHierarchyLine,
  ManualShiftWorkHierarchyBucket,
  ManualShiftWorkHierarchyWorkBucket
} from '@wos/domain';

export function isTechnicalHierarchyLine(line: ManualShiftWorkHierarchyLine): boolean {
  return (line.lineName ?? line.lineGroupName) === 'default';
}

export function isTechnicalHierarchyBucket(bucket: ManualShiftWorkHierarchyBucket): boolean {
  return bucket.bucketName === 'unassigned' || bucket.displayName === 'unassigned';
}

export function isTechnicalWorkBucket(wb: ManualShiftWorkHierarchyWorkBucket): boolean {
  return wb.workBucketName === 'unassigned';
}

export function getVisibleHierarchyLines(
  lines: ManualShiftWorkHierarchyLine[]
): ManualShiftWorkHierarchyLine[] {
  return lines.filter((l) => !isTechnicalHierarchyLine(l));
}

export function getVisibleHierarchyBuckets(
  buckets: ManualShiftWorkHierarchyBucket[]
): ManualShiftWorkHierarchyBucket[] {
  return buckets.filter((b) => !isTechnicalHierarchyBucket(b));
}
