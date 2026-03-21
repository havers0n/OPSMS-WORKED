import type { SupabaseClient } from '@supabase/supabase-js';
import type { Wave, WaveStatus } from '@wos/domain';
import {
  invalidWaveTransition,
  mapWaveMembershipRpcError,
  mapReleaseWaveRpcError,
  waveHasBlockingOrders,
  waveHasNoOrdersForReady,
  waveHasNoOrdersForRelease,
  waveNotFound
} from './errors.js';
import { isWaveTransitionAllowed } from './policies.js';
import { createWavesRepo, type WavesRepo } from './repo.js';

export type CreateWaveCommand = {
  tenantId: string;
  name: string;
};

export type TransitionWaveStatusCommand = {
  waveId: string;
  status: WaveStatus;
};

export type WaveMembershipCommand = {
  waveId: string;
  orderId: string;
};

export type WavesService = {
  createWave(command: CreateWaveCommand): Promise<Wave>;
  transitionWaveStatus(command: TransitionWaveStatusCommand): Promise<Wave>;
  attachOrderToWave(command: WaveMembershipCommand): Promise<Wave>;
  detachOrderFromWave(command: WaveMembershipCommand): Promise<Wave>;
};

export function createWavesServiceFromRepo(repo: WavesRepo): WavesService {
  return {
    async createWave(command) {
      const waveId = await repo.createWave({
        tenantId: command.tenantId,
        name: command.name
      });

      const wave = await repo.findWaveResponse(waveId);

      if (!wave) {
        throw waveNotFound(waveId);
      }

      return wave;
    },

    async transitionWaveStatus(command) {
      const wave = await repo.findWaveResponse(command.waveId);

      if (!wave) {
        throw waveNotFound(command.waveId);
      }

      if (!isWaveTransitionAllowed(wave.status, command.status)) {
        throw invalidWaveTransition(wave.status, command.status);
      }

      if (command.status === 'ready' && wave.totalOrders === 0) {
        throw waveHasNoOrdersForReady();
      }

      if (command.status === 'released') {
        if (wave.totalOrders === 0) {
          throw waveHasNoOrdersForRelease();
        }

        if (wave.blockingOrderCount > 0) {
          throw waveHasBlockingOrders();
        }

        try {
          await repo.runReleaseWave(command.waveId);
        } catch (error) {
          const mapped = mapReleaseWaveRpcError(error as { code?: string; message?: string } | null);
          throw mapped ?? error;
        }

        const releasedWave = await repo.findWaveResponse(command.waveId);

        if (!releasedWave) {
          throw waveNotFound(command.waveId);
        }

        return releasedWave;
      }

      await repo.updateWaveStatus(command.waveId, {
        status: command.status,
        closedAt: command.status === 'closed' ? new Date().toISOString() : undefined
      });

      const updatedWave = await repo.findWaveResponse(command.waveId);

      if (!updatedWave) {
        throw waveNotFound(command.waveId);
      }

      return updatedWave;
    },

    async attachOrderToWave(command) {
      try {
        await repo.attachOrderToWave(command.waveId, command.orderId);
      } catch (error) {
        const mapped = mapWaveMembershipRpcError(
          error as { code?: string; message?: string } | null,
          { waveId: command.waveId, orderId: command.orderId }
        );
        throw mapped ?? error;
      }

      const wave = await repo.findWaveResponse(command.waveId);

      if (!wave) {
        throw waveNotFound(command.waveId);
      }

      return wave;
    },

    async detachOrderFromWave(command) {
      try {
        await repo.detachOrderFromWave(command.waveId, command.orderId);
      } catch (error) {
        const mapped = mapWaveMembershipRpcError(
          error as { code?: string; message?: string } | null,
          { waveId: command.waveId, orderId: command.orderId }
        );
        throw mapped ?? error;
      }

      const wave = await repo.findWaveResponse(command.waveId);

      if (!wave) {
        throw waveNotFound(command.waveId);
      }

      return wave;
    }
  };
}

export function createWavesService(supabase: SupabaseClient): WavesService {
  return createWavesServiceFromRepo(createWavesRepo(supabase));
}
