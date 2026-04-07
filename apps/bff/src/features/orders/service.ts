import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderLine, OrderStatus } from '@wos/domain';
import {
  invalidOrderTransition,
  mapReleaseOrderRpcError,
  orderHasNoLinesForReady,
  orderNotEditableForAddLine,
  orderNotEditableForRemoveLine,
  orderNotFound,
  orderReleaseControlledByWave,
  productInactive,
  productNotFound,
  waveNotEditableForOrderCreate,
  waveNotFound
} from './errors.js';
import { isOrderEditableStatus, isOrderTransitionAllowed } from './policies.js';
import { createOrdersRepo, type OrdersRepo } from './repo.js';

export type CreateOrderCommand = {
  tenantId: string;
  externalNumber: string;
  priority: number;
  waveId?: string;
};

export type AddOrderLineCommand = {
  tenantId: string;
  orderId: string;
  productId: string;
  qtyRequired: number;
};

export type RemoveOrderLineCommand = {
  orderId: string;
  lineId: string;
};

export type TransitionOrderStatusCommand = {
  orderId: string;
  status: OrderStatus;
};

export type OrdersService = {
  createOrder(command: CreateOrderCommand): Promise<Order>;
  addOrderLine(command: AddOrderLineCommand): Promise<OrderLine>;
  removeOrderLine(command: RemoveOrderLineCommand): Promise<void>;
  transitionOrderStatus(command: TransitionOrderStatusCommand): Promise<Order>;
};

export function createOrdersServiceFromRepo(repo: OrdersRepo): OrdersService {
  async function runReservationRpc(operation: () => Promise<void>) {
    try {
      await operation();
    } catch (error) {
      const mapped = mapReleaseOrderRpcError(error as { code?: string; message?: string } | null);
      throw mapped ?? error;
    }
  }

  return {
    async createOrder(command) {
      if (command.waveId) {
        const wave = await repo.findWaveForOrderCreate(command.waveId);

        if (!wave || wave.tenantId !== command.tenantId) {
          throw waveNotFound(command.waveId);
        }

        if (wave.status !== 'draft' && wave.status !== 'ready') {
          throw waveNotEditableForOrderCreate();
        }
      }

      const orderId = await repo.createOrder({
        tenantId: command.tenantId,
        externalNumber: command.externalNumber,
        priority: command.priority,
        waveId: command.waveId ?? null
      });

      const order = await repo.findOrderResponse(orderId);
      if (!order) {
        throw orderNotFound(orderId);
      }

      return order;
    },

    async addOrderLine(command) {
      const order = await repo.findOrderEditableSnapshot(command.orderId);

      if (!order) {
        throw orderNotFound(command.orderId);
      }

      if (!isOrderEditableStatus(order.status)) {
        throw orderNotEditableForAddLine(order.status);
      }

      const product = await repo.findProductForOrderLine(command.productId);

      if (!product) {
        throw productNotFound();
      }

      if (!product.isActive) {
        throw productInactive();
      }

      return repo.createOrderLine({
        orderId: command.orderId,
        tenantId: command.tenantId,
        productId: product.id,
        sku: product.sku ?? product.externalProductId,
        name: product.name,
        qtyRequired: command.qtyRequired
      });
    },

    async removeOrderLine(command) {
      const order = await repo.findOrderEditableSnapshot(command.orderId);

      if (!order) {
        throw orderNotFound(command.orderId);
      }

      if (!isOrderEditableStatus(order.status)) {
        throw orderNotEditableForRemoveLine(order.status);
      }

      await repo.removeOrderLine(command.orderId, command.lineId);
    },

    async transitionOrderStatus(command) {
      const order = await repo.findOrderStatusSnapshot(command.orderId);

      if (!order) {
        throw orderNotFound(command.orderId);
      }

      if (!isOrderTransitionAllowed(order.status, command.status)) {
        throw invalidOrderTransition(order.status, command.status);
      }

      if (command.status === 'ready') {
        const lineCount = await repo.countOrderLines(command.orderId);

        if (!lineCount) {
          throw orderHasNoLinesForReady();
        }

        await runReservationRpc(() => repo.commitOrderReservations(command.orderId));
      }

      if (command.status === 'released') {
        if (order.waveId) {
          throw orderReleaseControlledByWave();
        }

        try {
          await repo.runReleaseOrder(command.orderId);
        } catch (error) {
          const mapped = mapReleaseOrderRpcError(error as { code?: string; message?: string } | null);
          throw mapped ?? error;
        }

        const releasedOrder = await repo.findOrderResponse(command.orderId);
        if (!releasedOrder) {
          throw orderNotFound(command.orderId);
        }

        return releasedOrder;
      }

      if (command.status === 'draft' && order.status === 'ready') {
        await runReservationRpc(() => repo.rollbackReadyOrderToDraft(command.orderId));
      } else if (command.status === 'cancelled') {
        await runReservationRpc(() => repo.cancelOrderWithUnreserve(command.orderId));
      } else if (command.status === 'closed') {
        await runReservationRpc(() => repo.closeOrderWithUnreserve(command.orderId));
      } else if (command.status !== 'ready') {
        await repo.updateOrderStatus(command.orderId, {
          status: command.status
        });
      }

      const updatedOrder = await repo.findOrderResponse(command.orderId);
      if (!updatedOrder) {
        throw orderNotFound(command.orderId);
      }

      return updatedOrder;
    }
  };
}

export function createOrdersService(supabase: SupabaseClient): OrdersService {
  return createOrdersServiceFromRepo(createOrdersRepo(supabase));
}
