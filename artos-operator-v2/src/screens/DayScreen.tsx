import React, { useMemo } from 'react';
import { Order, OrderError } from '../types';
import { summarizeDay } from '../utils';
import { Download, CheckCircle2, TrendingDown, Clock, Package, AlertTriangle } from 'lucide-react';

interface DayScreenProps {
  orders: Order[];
  errors: OrderError[];
}

export default function DayScreen({ orders, errors }: DayScreenProps) {
  const stats = useMemo(() => summarizeDay(orders, errors), [orders, errors]);

  const handleExport = (type: string) => {
    // Prototype only toast behavior
    const el = document.createElement('div');
    el.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl font-medium text-sm z-50 flex items-center gap-2';
    el.innerHTML = `<span class="bg-blue-500 w-2 h-2 rounded-full"></span> ייצוא ל-${type} יעבוד בגרסה הסופית`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => document.body.removeChild(el), 300);
    }, 2500);
  };

  return (
    <div className="p-4 pb-8 flex flex-col gap-6" dir="rtl">
      
      <div className="flex flex-col text-right px-2 mt-2">
        <h2 className="font-bold text-2xl text-gray-900">סיכום משמרת</h2>
        <p className="text-gray-500 font-medium">ביצועים סטטיסטיים להיום</p>
      </div>

      {/* Main KPI */}
      <div className="bg-gray-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-10 -mt-10 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shrink-0">
             <CheckCircle2 size={32} className="text-white" />
          </div>
          <div className="flex flex-col text-right">
             <span className="text-gray-300 font-medium text-sm">הסתיימו (נמסרו לאריזה)</span>
             <span className="font-black text-4xl leading-none">{stats.doneToday} <span className="text-xl text-gray-400 font-medium">/ {stats.total}</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-right">
        
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-sm font-bold text-blue-600 flex items-center gap-1.5"><Package size={16}/> פעילים</span>
          <span className="text-3xl font-bold">{stats.activeOrders}</span>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5"><Clock size={16}/> ממתינים לבדיקה</span>
          <span className="text-3xl font-bold">{stats.waitingCheck}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-sm font-bold text-red-600 flex items-center gap-1.5"><TrendingDown size={16}/> החזרות לתיקון</span>
          <span className="text-3xl font-bold">{stats.returned}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5"><AlertTriangle size={16}/> אחוז תקלות</span>
          <span className="text-3xl font-bold">{stats.errorRate}</span>
        </div>

      </div>

      <div className="h-px bg-gray-200 my-2" />

      {/* Export Section */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-gray-900 px-2 text-right">ייצוא נתונים</h3>
        <div className="flex gap-3">
          <button 
            onClick={() => handleExport('Excel')}
            className="flex-1 bg-white border-2 border-green-600 text-green-700 font-bold rounded-xl h-14 flex items-center justify-center gap-2 active:bg-green-50 transition-colors shadow-sm"
          >
            <Download size={20} />
            Excel
          </button>
          <button 
            onClick={() => handleExport('CSV')}
            className="flex-1 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl h-14 flex items-center justify-center gap-2 active:bg-gray-50 transition-colors shadow-sm"
          >
            <Download size={20} />
            CSV
          </button>
        </div>
      </div>

    </div>
  );
}
