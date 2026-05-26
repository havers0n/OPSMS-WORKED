import React, { useState } from 'react';
import { Order, Picker } from '../types';
import { getElapsedTime } from '../utils';
import { CheckCircle2, AlertOctagon, Package, Clock } from 'lucide-react';

interface CheckScreenProps {
  orders: Order[];
  pickers: Picker[];
  onCheck: (id: string) => void;
  onError: (id: string) => void;
}

export default function CheckScreen({ orders, pickers, onCheck, onError }: CheckScreenProps) {
  const waitingOrders = orders.filter(o => o.status === 'waiting_check').sort((a, b) => (a.waitingCheckAt || 0) - (b.waitingCheckAt || 0));
  
  const [successId, setSuccessId] = useState<string | null>(null);

  const handleCheckOk = (id: string) => {
    setSuccessId(id);
    setTimeout(() => {
      onCheck(id);
      setSuccessId(null);
    }, 400); // short delay for visual feedback
  };

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="font-bold text-xl">מצב בדיקה מהירה</h2>
        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-bold">
          {waitingOrders.length} ממתינים
        </span>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {waitingOrders.length === 0 ? (
          <div className="text-center text-gray-500 py-16 flex flex-col items-center gap-4">
             <CheckCircle2 size={48} className="text-gray-300" />
             <span>אין הזמנות הממתינות לבדיקה</span>
          </div>
        ) : (
          waitingOrders.map(order => {
            const picker = pickers.find(p => p.id === order.pickerId);
            const isSuccess = successId === order.id;

            return (
              <div 
                key={order.id} 
                className={`transition-all duration-300 transform rounded-2xl border shadow-sm flex flex-col overflow-hidden text-right
                  ${isSuccess ? 'scale-95 opacity-0 bg-green-50' : 'scale-100 opacity-100 bg-white border-gray-200'}`
                }
              >
                
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-2xl text-gray-900">{order.orderNumber}</span>
                      <span className="text-gray-600 font-medium text-lg">{order.kav}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium text-gray-500">עובד/ת</span>
                      <span className="font-bold">{picker ? picker.name : '—'}</span>
                    </div>
                  </div>

                  <div className="flex bg-gray-50 border border-gray-100 rounded-xl p-3 gap-6">
                    <div className="flex items-center gap-2 font-medium bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex-1">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-800 rounded font-bold text-xs">{order.size}</span>
                      <span className="flex items-center gap-1 text-gray-600"><Package size={16} />{order.lineCount}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center flex-1">
                      <span className="text-[11px] text-gray-500 -mb-0.5">זמן המתנה</span>
                      <span className="font-bold flex items-center gap-1 text-amber-700">
                        {getElapsedTime(order.waitingCheckAt)} <Clock size={14} />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex bg-gray-50 border-t border-gray-200 divide-x divide-x-reverse divide-gray-200 h-16">
                  <button 
                    onClick={() => onError(order.id)}
                    className="w-1/2 flex items-center justify-center gap-2 text-red-600 font-bold active:bg-red-50 transition-colors"
                  >
                    <AlertOctagon size={22} className="shrink-0" />
                    תקלה
                  </button>
                  <button 
                    onClick={() => handleCheckOk(order.id)}
                    className="w-1/2 flex items-center justify-center gap-2 text-green-700 font-bold active:bg-green-50 transition-colors"
                  >
                    <CheckCircle2 size={24} className="shrink-0" />
                    תקין
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
