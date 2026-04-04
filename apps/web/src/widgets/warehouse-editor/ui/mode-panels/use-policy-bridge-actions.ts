import type { LocationStorageSnapshotRow } from '@wos/domain';
import { useEffect, useMemo, useState } from 'react';
import type { useCreateProductLocationRole } from '@/entities/product-location-role/api/mutations';
import type { LocationProductAssignment } from '@/entities/product-location-role/api/queries';
import { getUnassignedStockPolicyCandidate } from './cell-placement-inspector.lib';

export function usePolicyBridgeActions({
  selectedCellId,
  locationId,
  locationRows,
  policyAssignments,
  createProductLocationRole
}: {
  selectedCellId: string | null;
  locationId: string | null;
  locationRows: LocationStorageSnapshotRow[];
  policyAssignments: LocationProductAssignment[];
  createProductLocationRole: ReturnType<typeof useCreateProductLocationRole>;
}) {
  const [policyBridgeError, setPolicyBridgeError] = useState<string | null>(null);
  const [optimisticPolicyBridgeRoles, setOptimisticPolicyBridgeRoles] = useState<
    Array<'primary_pick' | 'reserve'>
  >([]);

  const basePolicyBridgeCandidate = useMemo(
    () => getUnassignedStockPolicyCandidate(locationRows, policyAssignments),
    [locationRows, policyAssignments]
  );
  const policyBridgeCandidate = useMemo(() => {
    if (!basePolicyBridgeCandidate) {
      return null;
    }

    const missingPrimaryPick =
      basePolicyBridgeCandidate.missingPrimaryPick &&
      !optimisticPolicyBridgeRoles.includes('primary_pick');
    const missingReserve =
      basePolicyBridgeCandidate.missingReserve &&
      !optimisticPolicyBridgeRoles.includes('reserve');

    if (!missingPrimaryPick && !missingReserve) {
      return null;
    }

    return {
      ...basePolicyBridgeCandidate,
      missingPrimaryPick,
      missingReserve
    };
  }, [basePolicyBridgeCandidate, optimisticPolicyBridgeRoles]);

  useEffect(() => {
    setPolicyBridgeError(null);
    setOptimisticPolicyBridgeRoles([]);
  }, [selectedCellId, locationId, basePolicyBridgeCandidate?.product.id]);

  const handleAssignPolicyRole = async (role: 'primary_pick' | 'reserve') => {
    if (!locationId || !policyBridgeCandidate || createProductLocationRole.isPending) {
      return;
    }

    setPolicyBridgeError(null);

    try {
      await createProductLocationRole.mutateAsync({
        locationId,
        productId: policyBridgeCandidate.product.id,
        role
      });
      setOptimisticPolicyBridgeRoles((current) =>
        current.includes(role) ? current : [...current, role]
      );
    } catch (error) {
      setPolicyBridgeError(
        error instanceof Error
          ? error.message
          : 'Could not assign a location role for this product.'
      );
    }
  };

  return {
    policyBridgeCandidate,
    policyBridgeError,
    isAssignPending: createProductLocationRole.isPending,
    handleAssignPolicyRole
  };
}
