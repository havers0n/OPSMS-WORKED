import React, { useState, useMemo } from 'react';
import { Order, Picker } from '../types';
import { getStatusLabel, getStatusColor, getElapsedTime } from '../utils';
import { AlertCircle, Clock, Package } from 'lucide-react';

interface QueueScreenProps {
  orders: Order[];
  pickers: Picker[];
  onSelectOrder: (id: string) => void;
}

export default function QueueScreen({ orders, pickers, onSelectOrder }: QueueScreenProps) {
  const [filterKav, setFilterKav] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active'); // active = not done/ready
  const [search, setSearch] = useState('');

  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    if (filterKav !== 'all') {
      filtered = filtered.filter(o => o.kav === filterKav);
    }

    if (filterStatus === 'active') {
      filtered = filtered.filter(o => !['ready_packing', 'done'].includes(o.status));
    } else if (filterStatus !== 'all') {
      filtered = filtered.filter(o => o.status === filterStatus);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(o => {
        const pName = pickers.find(p => p.id === o.pickerId)?.name || '';
        return o.orderNumber.toLowerCase().includes(q) || 
               o.kav.toLowerCase().includes(q) || 
               pName.toLowerCase().includes(q);
      });
    }

    // Sort order
    const priority: Record<string, number> = {
      returned: 1,
      waiting_check: 2,
      picking: 3,
      assigned: 4,
      new: 5,
      ready_packing: 6,
      done: 7
    };

    return filtered.sort((a, b) => priority[a.status] - priority[b.status] || b.createdAt - a.createdAt);
  }, [orders, filterKav, filterStatus, search, pickers]);

  const uniqueKavs = Array.from(new Set(orders.map(o => o.kav)));

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <input 
          type="search"
          placeholder="חיפוש הזמנה, עובד, קו..."
          className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 min-h-[48px] text-base"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
          <select 
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 min-h-[48px] text-sm shrink-0 font-medium"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="active">פעילים</option>
            <option value="all">הכל</option>
            <option value="returned">בתיקון</option>
            <option value="waiting_check">ממתינים לבדיקה</option>
            <option value="picking">בליקוט</option>
          </select>

          <select 
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 min-h-[48px] text-sm shrink-0 font-medium"
            value={filterKav}
            onChange={e => setFilterKav(e.target.value)}
          >
            <option value="all">כל הקווים</option>
            {uniqueKavs.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center text-gray-500 py-10">אין הזמנות תואמות</div>
        ) : (
          filteredOrders.map(order => {
            const picker = pickers.find(p => p.id === order.pickerId);
            const isError = order.status === 'returned';
            
            // Calculate time based on status
            let timeRef = order.createdAt;
            if (['picking', 'assigned'].includes(order.status) && order.startedAt) timeRef = order.startedAt;
            else if (order.status === 'waiting_check' && order.waitingCheckAt) timeRef = order.waitingCheckAt;
            else if (order.status === 'returned' && order.waitingCheckAt) timeRef = order.waitingCheckAt; // approximate

            return (
              <button 
                key={order.id}
                onClick={() => onSelectOrder(order.id)}
                className={`bg-white border text-right rounded-xl p-4 flex flex-col gap-3 active:bg-gray-50 transition-colors w-full text-base ${isError ? 'border-red-300 shadow-[0_2px_10px_rgba(239,68,68,0.1)]' : 'border-gray-200 shadow-sm'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-gray-900">{order.orderNumber}</span>
                      {isError && <AlertCircle size={18} className="text-red-500" strokeWidth={2.5} />}
                    </div>
                    <span className="text-gray-600 font-medium">{order.kav}</span>
                  </div>
                  
                  <div className={`px-2.5 py-1 text-sm font-bold rounded-md border ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-1.5 flex-1 font-medium">
                    <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs">
                      {picker ? picker.name.charAt(0) : '?'}
                    </span>
                    {picker ? picker.name : 'לא שויך'}
                  </div>
                  <div className="flex items-center gap-3 font-medium">
                    <div className="flex items-center gap-1 items-stretch">
                       <span className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-700 rounded text-[10px] font-bold">{order.size}</span>
                       <span className="flex items-center text-gray-500 gap-1"><Package size={14} />{order.lineCount}</span>
                    </div>
                    <div className="flex items-center gap-1 rtl:flex-row-reverse text-gray-500">
                      <span>{getElapsedTime(timeRef)}</span>
                      <Clock size={14} />
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

    </div>
  );
}
