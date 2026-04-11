/**
 * StorageNavigator Placeholder Fixtures
 *
 * Fixture data for testing StorageNavigator component in isolation.
 * This is NOT real warehouse data — it's mock data for component structure validation.
 *
 * Real data loading and API integration deferred to PR3+.
 */

export interface LocationItem {
  id: string;
  level: number;
  status: 'empty' | 'occupied' | 'full';
  containerId?: string;
}

/**
 * Mock locations grouped by level.
 * Each level has ~9-10 locations with varying statuses.
 */
export const mockLocationsByLevel: Record<number, LocationItem[]> = {
  1: [
    { id: '01-A.02.01', level: 1, status: 'empty' },
    { id: '01-A.02.02', level: 1, status: 'occupied', containerId: 'XYZ-001' },
    { id: '01-A.02.03', level: 1, status: 'empty' },
    { id: '01-A.02.04', level: 1, status: 'occupied', containerId: 'ABC-042' },
    { id: '01-A.02.05', level: 1, status: 'empty' },
    { id: '01-A.02.06', level: 1, status: 'full' },
    { id: '01-A.02.07', level: 1, status: 'empty' },
    { id: '01-A.02.08', level: 1, status: 'occupied', containerId: 'DEF-008' },
    { id: '01-A.02.09', level: 1, status: 'empty' },
  ],
  2: [
    { id: '01-A.03.01', level: 2, status: 'occupied', containerId: 'PQRS-101' },
    { id: '01-A.03.02', level: 2, status: 'empty' },
    { id: '01-A.03.03', level: 2, status: 'empty' },
    { id: '01-A.03.04', level: 2, status: 'occupied', containerId: 'UVWX-104' },
    { id: '01-A.03.05', level: 2, status: 'empty' },
    { id: '01-A.03.06', level: 2, status: 'full' },
    { id: '01-A.03.07', level: 2, status: 'empty' },
    { id: '01-A.03.08', level: 2, status: 'empty' },
    { id: '01-A.03.09', level: 2, status: 'occupied', containerId: 'YZ-109' },
    { id: '01-A.03.10', level: 2, status: 'empty' },
  ],
  3: [
    { id: '01-A.04.01', level: 3, status: 'empty' },
    { id: '01-A.04.02', level: 3, status: 'empty' },
    { id: '01-A.04.03', level: 3, status: 'occupied', containerId: 'MNO-303' },
    { id: '01-A.04.04', level: 3, status: 'full' },
    { id: '01-A.04.05', level: 3, status: 'empty' },
    { id: '01-A.04.06', level: 3, status: 'occupied', containerId: 'PQR-306' },
    { id: '01-A.04.07', level: 3, status: 'empty' },
    { id: '01-A.04.08', level: 3, status: 'empty' },
    { id: '01-A.04.09', level: 3, status: 'occupied', containerId: 'STU-309' },
  ],
};

/**
 * All locations flattened (for reference, not used by component)
 */
export const allMockLocations: LocationItem[] = Object.values(mockLocationsByLevel).flat();
