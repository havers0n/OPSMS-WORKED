import { describe, expect, it } from 'vitest';
import { deriveWaveBlockers, getBlockerReasonLabel } from './wave-blockers';
import type { Wave } from '@wos/domain';

describe('Wave Blockers', () => {
  describe('deriveWaveBlockers', () => {
    it('returns no blockers for empty wave', () => {
      const wave: Pick<Wave, 'orders'> = {
        orders: []
      };
      const result = deriveWaveBlockers(wave);
      expect(result.blocked).toBe(false);
      expect(result.count).toBe(0);
      expect(result.blockers).toEqual([]);
    });

    it('identifies draft orders as blockers', () => {
      const wave: Pick<Wave, 'orders'> = {
        orders: [
          {
            id: '1',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-001',
            status: 'draft',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: null,
            closedAt: null,
            lineCount: 1,
            unitCount: 10,
            pickedUnitCount: 0
          }
        ]
      };
      const result = deriveWaveBlockers(wave);
      expect(result.blocked).toBe(true);
      expect(result.count).toBe(1);
      expect(result.blockers[0].reason).toBe('draft');
      expect(result.blockers[0].externalNumber).toBe('ORD-001');
    });

    it('identifies empty orders as blockers', () => {
      const wave: Pick<Wave, 'orders'> = {
        orders: [
          {
            id: '1',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-002',
            status: 'ready',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: null,
            closedAt: null,
            lineCount: 0,
            unitCount: 0,
            pickedUnitCount: 0
          }
        ]
      };
      const result = deriveWaveBlockers(wave);
      expect(result.blocked).toBe(true);
      expect(result.count).toBe(1);
      expect(result.blockers[0].reason).toBe('empty_order');
    });

    it('identifies partial orders as blockers', () => {
      const wave: Pick<Wave, 'orders'> = {
        orders: [
          {
            id: '1',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-003',
            status: 'partial',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: null,
            closedAt: null,
            lineCount: 5,
            unitCount: 10,
            pickedUnitCount: 3
          }
        ]
      };
      const result = deriveWaveBlockers(wave);
      expect(result.blocked).toBe(true);
      expect(result.count).toBe(1);
      expect(result.blockers[0].reason).toBe('not_ready');
    });

    it('does not block on ready orders', () => {
      const wave: Pick<Wave, 'orders'> = {
        orders: [
          {
            id: '1',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-004',
            status: 'ready',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: null,
            closedAt: null,
            lineCount: 5,
            unitCount: 10,
            pickedUnitCount: 0
          }
        ]
      };
      const result = deriveWaveBlockers(wave);
      expect(result.blocked).toBe(false);
      expect(result.count).toBe(0);
    });

    it('does not block on released orders', () => {
      const wave: Pick<Wave, 'orders'> = {
        orders: [
          {
            id: '1',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-005',
            status: 'released',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: '2026-04-08T00:05:00Z',
            closedAt: null,
            lineCount: 5,
            unitCount: 10,
            pickedUnitCount: 0
          }
        ]
      };
      const result = deriveWaveBlockers(wave);
      expect(result.blocked).toBe(false);
    });

    it('does not block on closed orders', () => {
      const wave: Pick<Wave, 'orders'> = {
        orders: [
          {
            id: '1',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-006',
            status: 'closed',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: '2026-04-08T00:05:00Z',
            closedAt: '2026-04-08T00:10:00Z',
            lineCount: 5,
            unitCount: 10,
            pickedUnitCount: 10
          }
        ]
      };
      const result = deriveWaveBlockers(wave);
      expect(result.blocked).toBe(false);
    });

    it('handles mixed blockers and non-blockers', () => {
      const wave: Pick<Wave, 'orders'> = {
        orders: [
          {
            id: '1',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-DRAFT',
            status: 'draft',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: null,
            closedAt: null,
            lineCount: 5,
            unitCount: 10,
            pickedUnitCount: 0
          },
          {
            id: '2',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-READY',
            status: 'ready',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: null,
            closedAt: null,
            lineCount: 5,
            unitCount: 10,
            pickedUnitCount: 0
          },
          {
            id: '3',
            tenantId: 'tenant-1',
            externalNumber: 'ORD-EMPTY',
            status: 'ready',
            priority: 0,
            waveId: null,
            waveName: null,
            createdAt: '2026-04-08T00:00:00Z',
            releasedAt: null,
            closedAt: null,
            lineCount: 0,
            unitCount: 0,
            pickedUnitCount: 0
          }
        ]
      };
      const result = deriveWaveBlockers(wave);
      expect(result.blocked).toBe(true);
      expect(result.count).toBe(2);
      expect(result.blockers.map(b => b.externalNumber)).toContain('ORD-DRAFT');
      expect(result.blockers.map(b => b.externalNumber)).toContain('ORD-EMPTY');
    });
  });

  describe('getBlockerReasonLabel', () => {
    it('returns correct labels for all reason codes', () => {
      expect(getBlockerReasonLabel('draft')).toBe('Not committed');
      expect(getBlockerReasonLabel('empty_order')).toBe('No lines');
      expect(getBlockerReasonLabel('not_ready')).toBe('Not ready');
      expect(getBlockerReasonLabel('unknown_release_blocker')).toBe('Unknown issue');
    });
  });
});
