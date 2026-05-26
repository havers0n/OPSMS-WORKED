import React, { useState } from 'react';
import { Order, ErrorType } from '../types';
import { getErrorTypeLabel } from '../utils';
import { ArrowRight, MessageSquare } from 'lucide-react';

interface ErrorFlowProps {
  order: Order;
  onClose: () => void;
  onSubmit: (type: ErrorType, comment?: string) => void;
}

export default function ErrorFlow({ order, onClose, onSubmit }: ErrorFlowProps) {
  const [selectedType, setSelectedType] = useState<ErrorType | null>(null);
  const [comment, setComment] = useState('');

  const errorTypes: ErrorType[] = [
    'wrong_quantity',
    'wrong_item',
    'missing_item',
    'bad_packing',
    'small_items_loose',
    'damaged',
    'other'
  ];

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col h-full anim-slide-up" dir="rtl">
      
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={onClose} className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500">
          <ArrowRight size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-xl text-red-700">דיווח תקלה</h2>
        </div>
        <span className="font-bold text-gray-700 font-mono text-sm">{order.orderNumber}</span>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 flex flex-col gap-6">
        
        <div>
          <h3 className="text-xl font-bold mb-4">מה הבעיה בהזמנה?</h3>
          <div className="grid grid-cols-2 gap-3">
            {errorTypes.map(type => {
              const isSelected = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`border-2 rounded-xl p-4 text-right transition-all flex items-center min-h-[80px]
                    ${isSelected 
                      ? 'border-red-600 bg-red-50 text-red-900 shadow-sm' 
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 active:bg-gray-50'
                    }`}
                >
                  <span className={`font-bold leading-tight ${isSelected ? 'text-lg' : 'text-base'}`}>
                    {getErrorTypeLabel(type)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700 flex items-center gap-2">
            הערה חופשית (אופציונלי) <MessageSquare size={16} />
          </label>
          <textarea 
            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-base focus:border-red-500 focus:ring-1 focus:ring-red-500"
            rows={3}
            placeholder="פרט איזה פריט, כמות וכו'..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        </div>

      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white pb-safe shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
        <button
          disabled={!selectedType}
          onClick={() => selectedType && onSubmit(selectedType, comment)}
          className={`w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center transition-all
            ${selectedType 
              ? 'bg-red-600 text-white active:scale-[0.98]' 
              : 'bg-gray-200 text-gray-400'
            }`}
        >
          חזרה לתיקון
        </button>
      </footer>
    </div>
  );
}
