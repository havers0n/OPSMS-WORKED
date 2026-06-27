import type { PlanningLine, WorkGroup } from './scheme-types';

export function isTechnicalPlanningLine(line: PlanningLine): boolean {
  return line.name === 'default';
}

export function isTechnicalWorkGroup(group: WorkGroup): boolean {
  return group.name === 'unassigned';
}

export function getVisibleWorkGroups(groups: WorkGroup[]): WorkGroup[] {
  return groups.filter((g) => !isTechnicalWorkGroup(g));
}

export function getVisiblePlanningLines(lines: PlanningLine[]): PlanningLine[] {
  return lines.filter((line) => !isTechnicalPlanningLine(line));
}
