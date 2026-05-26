/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { initialOrders, initialErrors, initialEvents, mockPickers, mockLines } from './mock-data';
import { Order, OrderError, OrderEvent, OrderStatus, ErrorType } from './types';
import MobileShell from './components/MobileShell';
import QueueScreen from './screens/QueueScreen';
import CheckScreen from './screens/CheckScreen';
import PeopleScreen from './screens/PeopleScreen';
import DayScreen from './screens/DayScreen';
import OrderDetail from './screens/OrderDetail';
import AddOrder from './screens/AddOrder';
import ErrorFlow from './screens/ErrorFlow';

export default function App() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [errors, setErrors] = useState<OrderError[]>(initialErrors);
  const [events, setEvents] = useState<OrderEvent[]>(initialEvents);
  const [lines, setLines] = useState<string[]>(mockLines);
  
  const [activeTab, setActiveTab] = useState<'queue' | 'check' | 'people' | 'day'>('queue');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [errorFlowOrderId, setErrorFlowOrderId] = useState<string | null>(null);

  const updateOrder = (id: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const addEvent = (orderId: string, type: string, actor: string = 'System') => {
    const event: OrderEvent = {
      id: Math.random().toString(36).substr(2, 9),
      orderId,
      type,
      actor,
      createdAt: Date.now()
    };
    setEvents(prev => [...prev, event]);
  };

  const handleCreateOrder = (order: Order) => {
    setOrders(prev => [...prev, order]);
    addEvent(order.id, 'created', 'Manager');
    setIsAddingOrder(false);
  };

  const handleAddError = (orderId: string, type: ErrorType, comment?: string) => {
    const newError: OrderError = {
      id: Math.random().toString(36).substr(2, 9),
      orderId,
      type,
      comment,
      createdAt: Date.now()
    };
    setErrors(prev => [...prev, newError]);
    
    // Update order
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'returned',
          errorIds: [...o.errorIds, newError.id]
        };
      }
      return o;
    }));
    
    addEvent(orderId, 'error_reported', 'Checker');
    setErrorFlowOrderId(null);
  };

  const activeOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) : undefined;
  const flowOrder = errorFlowOrderId ? orders.find(o => o.id === errorFlowOrderId) : undefined;

  return (
    <MobileShell 
      activeTab={activeTab} 
      onChangeTab={setActiveTab}
      onAddOrder={activeTab === 'queue' || activeTab === 'day' ? () => setIsAddingOrder(true) : undefined}
      orders={orders}
      errors={errors}
    >
      {isAddingOrder ? (
        <AddOrder 
          onClose={() => setIsAddingOrder(false)} 
          onCreate={handleCreateOrder}
          pickers={mockPickers}
          lines={lines}
          onAddLine={(newLine) => setLines(prev => [...prev, newLine])}
        />
      ) : flowOrder ? (
        <ErrorFlow
          order={flowOrder}
          onClose={() => setErrorFlowOrderId(null)}
          onSubmit={(type, comment) => handleAddError(flowOrder.id, type, comment)}
        />
      ) : activeOrder ? (
        <OrderDetail 
          order={activeOrder}
          errors={errors.filter(e => activeOrder.errorIds.includes(e.id))}
          pickers={mockPickers}
          onClose={() => setSelectedOrderId(null)}
          onOpenErrorFlow={() => {
            setSelectedOrderId(null);
            setErrorFlowOrderId(activeOrder.id);
          }}
          onUpdateOrder={(updates) => {
             updateOrder(activeOrder.id, updates);
             if (updates.status) {
               addEvent(activeOrder.id, `status_changed_${updates.status}`);
             }
          }}
        />
      ) : (
        <>
          {activeTab === 'queue' && (
            <QueueScreen 
              orders={orders} 
              pickers={mockPickers} 
              onSelectOrder={setSelectedOrderId} 
            />
          )}
          {activeTab === 'check' && (
            <CheckScreen 
              orders={orders} 
              pickers={mockPickers} 
              onCheck={(id) => {
                updateOrder(id, { status: 'ready_packing', checkedAt: Date.now() });
                addEvent(id, 'checked_ok', 'Checker');
              }}
              onError={(id) => setErrorFlowOrderId(id)}
            />
          )}
          {activeTab === 'people' && (
            <PeopleScreen 
              orders={orders} 
              pickers={mockPickers} 
              errors={errors} 
            />
          )}
          {activeTab === 'day' && (
            <DayScreen 
              orders={orders} 
              errors={errors} 
            />
          )}
        </>
      )}
    </MobileShell>
  );
}
