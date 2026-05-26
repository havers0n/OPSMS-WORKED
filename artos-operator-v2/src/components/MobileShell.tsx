import React from 'react';
import { ListTodo, CheckSquare, Users, Calendar, Plus } from 'lucide-react';
import { Order, OrderError } from '../types';

interface MobileShellProps {
  children: React.ReactNode;
  activeTab: 'queue' | 'check' | 'people' | 'day';
  onChangeTab: (tab: 'queue' | 'check' | 'people' | 'day') => void;
  onAddOrder?: () => void;
  orders: Order[];
  errors: OrderError[];
}

export default function MobileShell({ children, activeTab, onChangeTab, onAddOrder, orders }: MobileShellProps) {
  const activeOrdersCount = orders.filter(o => ['new', 'assigned', 'picking'].includes(o.status)).length;
  const waitingCheckCount = orders.filter(o => o.status === 'waiting_check').length;
  const returnedCount = orders.filter(o => o.status === 'returned').length;

  const todayStr = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center text-gray-900" dir="rtl">
      <div className="w-full max-w-[430px] h-[100dvh] bg-white flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <h1 className="font-semibold text-lg tracking-tight">Artos Operator</h1>
            <span className="text-sm text-gray-500 font-medium">{todayStr}</span>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>פעילים: {activeOrdersCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>בדיקה: {waitingCheckCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>תיקון: {returnedCount}</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto w-full relative pb-20">
          {children}
        </main>

        {/* Floating Action Button */}
        {onAddOrder && (
          <button 
            onClick={onAddOrder}
            className="absolute bottom-20 left-4 w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-30"
          >
            <Plus size={28} />
          </button>
        )}

        {/* Bottom Navigation */}
        <nav className="fixed md:absolute bottom-0 w-full max-w-[430px] bg-white border-t border-gray-200 flex justify-around items-center h-16 shrink-0 z-40 pb-safe">
          <button 
            onClick={() => onChangeTab('queue')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'queue' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <ListTodo size={24} />
            <span className="text-[11px] font-medium">תור</span>
          </button>
          
          <button 
            onClick={() => onChangeTab('check')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'check' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <div className="relative">
              <CheckSquare size={24} />
              {waitingCheckCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {waitingCheckCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium">בדיקה</span>
          </button>
          
          <button 
            onClick={() => onChangeTab('people')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'people' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <Users size={24} />
            <span className="text-[11px] font-medium">עובדים</span>
          </button>
          
          <button 
            onClick={() => onChangeTab('day')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'day' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <Calendar size={24} />
            <span className="text-[11px] font-medium">יום</span>
          </button>
        </nav>
        
      </div>
    </div>
  );
}
