import React, { useMemo } from 'react';
import { Order, Picker, OrderError } from '../types';
import { summarizePickers, getElapsedTime } from '../utils';
import { CheckCircle2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';

interface PeopleScreenProps {
  orders: Order[];
  pickers: Picker[];
  errors: OrderError[];
}

export default function PeopleScreen({ orders, pickers, errors }: PeopleScreenProps) {
  const pickerStats = useMemo(() => summarizePickers(orders, pickers, errors), [orders, pickers, errors]);

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      <h2 className="font-bold text-xl px-2 mb-2">מצב עובדים</h2>

      <div className="flex flex-col gap-3">
        {pickerStats.map(stat => (
          <div key={stat.id} className="bg-white border text-right border-gray-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
            
            <div className="flex justify-between items-center bg-gray-50 -mx-4 -mt-4 p-4 border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                  {stat.name.charAt(0)}
                </div>
                <span className="font-bold text-lg">{stat.name}</span>
              </div>
              <div className="text-sm font-bold bg-white px-3 py-1 rounded-full border border-gray-200 text-gray-700 shadow-sm">
                {stat.doneTodayCount} הסתיימו
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-blue-600 mb-0.5">פעילים</span>
                <span className="text-2xl font-bold text-blue-900">{stat.activeCount}</span>
              </div>
              
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-amber-700 mb-0.5">בבדיקה</span>
                <span className="text-2xl font-bold text-amber-900">{stat.waitingCheckCount}</span>
              </div>
              
              <div className={`border rounded-xl p-2.5 flex flex-col items-center justify-center text-center ${stat.returnedCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                <span className={`text-xs font-bold mb-0.5 ${stat.returnedCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>בתיקון</span>
                <span className={`text-2xl font-bold ${stat.returnedCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>{stat.returnedCount}</span>
              </div>
            </div>

            {stat.currentActiveOrder && (
              <div className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg p-3 border border-gray-100">
                <Clock className="text-gray-400" size={16} />
                <div className="flex flex-col flex-1">
                  <span className="font-medium text-gray-500 text-xs">מלקט עכשיו</span>
                  <div className="flex justify-between items-center">
                     <span className="font-bold">{stat.currentActiveOrder.orderNumber}</span>
                     <span className="font-bold text-blue-700" dir="ltr">{getElapsedTime(stat.currentActiveOrder.startedAt)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {!stat.currentActiveOrder && stat.activeCount === 0 && stat.returnedCount === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 font-medium justify-center bg-green-50 rounded-lg py-2">
                <CheckCircle2 size={16} /> פנוי/ה
              </div>
            )}

            {stat.errorCountToday > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 justify-end pt-1">
                <AlertCircle size={14} className="text-gray-400" />
                <span>{stat.errorCountToday} תקלות היום</span>
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}
