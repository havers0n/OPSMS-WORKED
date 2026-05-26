import React, { useState } from 'react';
import { Order, OrderError, Picker, OrderStatus } from '../types';
import { getStatusLabel, getStatusColor, getElapsedTime, getErrorTypeLabel } from '../utils';
import { ArrowRight, Clock, MapPin, Package, User, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface OrderDetailProps {
  order: Order;
  errors: OrderError[];
  pickers: Picker[];
  onClose: () => void;
  onUpdateOrder: (updates: Partial<Order>) => void;
  onOpenErrorFlow: () => void;
}

export default function OrderDetail({ order, errors, pickers, onClose, onUpdateOrder, onOpenErrorFlow }: OrderDetailProps) {
  const picker = pickers.find(p => p.id === order.pickerId);
  const [selectedPickerId, setSelectedPickerId] = useState(order.pickerId || '');

  const handleAction = (updates: Partial<Order>) => {
    onUpdateOrder(updates);
    // don't auto close unless it's done? Prototype can just stay on screen and reflect new status.
  };

  const currentErrors = errors.filter(e => !e.fixedAt);

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col h-full anim-slide-in" dir="rtl">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={onClose} className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors">
          <ArrowRight size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-xl">{order.orderNumber}</h2>
        </div>
        <div className={`px-3 py-1.5 text-sm font-bold rounded-lg border ${getStatusColor(order.status)} shrink-0`}>
          {getStatusLabel(order.status)}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        
        {/* Main Info Card */}
        <div className="bg-white border text-right border-gray-200 rounded-2xl p-5 flex flex-col gap-5 shadow-sm">
          
          <div className="flex items-center gap-3">
            <MapPin className="text-gray-400" size={20} />
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 font-medium">קו חלוקה/איזור</span>
              <span className="font-bold text-lg">{order.kav}</span>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center gap-3">
            <User className="text-gray-400" size={20} />
            <div className="flex flex-col w-full">
              <span className="text-sm text-gray-500 font-medium">עובד מלקט</span>
              {order.status === 'new' ? (
                <div className="flex items-center gap-2 mt-1">
                  <select 
                    className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 font-medium"
                    value={selectedPickerId}
                    onChange={e => setSelectedPickerId(e.target.value)}
                  >
                    <option value="" disabled>בחר עובד לליקוט</option>
                    {pickers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {selectedPickerId && selectedPickerId !== order.pickerId && (
                    <button 
                      onClick={() => handleAction({ pickerId: selectedPickerId, status: 'assigned' })}
                      className="bg-gray-900 text-white px-4 py-2.5 rounded-lg font-medium"
                    >
                      שייך
                    </button>
                  )}
                </div>
              ) : (
                <span className="font-bold text-lg">{picker ? picker.name : '—'}</span>
              )}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Package className="text-gray-400" size={20} />
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">גודל ושורות</span>
                <div className="flex items-center gap-2 font-bold text-lg">
                  <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-sm">{order.size}</span>
                  <span>{order.lineCount} שורות</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end border-r border-gray-100 pr-5">
              <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
                 זמן בשלב <Clock size={12} />
              </span>
              <span className="font-bold text-lg" dir="ltr">
                {getElapsedTime(order.status === 'picking' ? order.startedAt : order.status === 'waiting_check' || order.status === 'returned' ? order.waitingCheckAt : order.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Errors Block */}
        {currentErrors.length > 0 && order.status === 'returned' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex flex-col gap-4 text-right">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
              <AlertTriangle size={20} />
              <span>תקלות פתוחות</span>
            </div>
            {currentErrors.map(err => (
              <div key={err.id} className="bg-white rounded-xl p-3 border border-red-100 flex flex-col gap-1 shadow-sm">
                <span className="font-bold text-red-700">{getErrorTypeLabel(err.type)}</span>
                {err.comment && <span className="text-sm text-gray-600">{err.comment}</span>}
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Action Footer */}
      {(order.status !== 'done' && order.status !== 'new') && (
        <footer className="p-4 border-t border-gray-200 bg-white pb-safe flex flex-col gap-3 shrink-0 relative z-10 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          
          {order.status === 'assigned' && (
            <button 
              onClick={() => handleAction({ status: 'picking', startedAt: Date.now() })}
              className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center"
            >
              התחל לקט
            </button>
          )}

          {order.status === 'picking' && (
            <button 
              onClick={() => handleAction({ status: 'waiting_check', waitingCheckAt: Date.now() })}
              className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center"
            >
              העבר לבדיקה
            </button>
          )}

          {order.status === 'waiting_check' && (
            <div className="flex gap-3">
              <button 
                onClick={onOpenErrorFlow}
                className="w-1/2 bg-red-100 text-red-700 border border-red-200 rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <XCircle size={24} />
                תקלה
              </button>
              <button 
                onClick={() => handleAction({ status: 'ready_packing', checkedAt: Date.now() })}
                className="w-1/2 bg-green-500 text-white border border-green-600 rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-sm"
              >
                <CheckCircle size={24} />
                תקין
              </button>
            </div>
          )}

          {order.status === 'returned' && (
            <button 
              onClick={() => handleAction({ status: 'waiting_check' })}
              className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center"
            >
              הכל תוקן, החזר לבדיקה
            </button>
          )}

          {order.status === 'ready_packing' && (
            <button 
              onClick={() => handleAction({ status: 'done', finishedAt: Date.now() })}
              className="w-full bg-gray-900 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center"
            >
              סיים - נמסר לאריזה
            </button>
          )}

        </footer>
      )}

      {order.status === 'new' && selectedPickerId && selectedPickerId === order.pickerId && (
        <footer className="p-4 border-t border-gray-200 bg-white pb-safe flex flex-col gap-3 shrink-0">
          <button 
              onClick={() => handleAction({ status: 'picking', startedAt: Date.now() })}
              className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center"
            >
              התחל לקט מיד
            </button>
        </footer>
      )}
    </div>
  );
}
