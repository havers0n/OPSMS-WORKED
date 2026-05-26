import React, { useState, useEffect } from 'react';
import { Order, OrderSize, Picker } from '../types';
import { calculateOrderSize } from '../utils';
import { ArrowRight, Box, Package, User } from 'lucide-react';

interface AddOrderProps {
  onClose: () => void;
  onCreate: (order: Order) => void;
  pickers: Picker[];
  lines: string[];
  onAddLine: (line: string) => void;
}

export default function AddOrder({ onClose, onCreate, pickers, lines, onAddLine }: AddOrderProps) {
  const [orderNumber, setOrderNumber] = useState('');
  const [kav, setKav] = useState('');
  const [pickerId, setPickerId] = useState('');
  const [lineCount, setLineCount] = useState<string>('');
  
  const [autoSize, setAutoSize] = useState<OrderSize>('S');
  const [manualSize, setManualSize] = useState<OrderSize | null>(null);

  const [isAddingKav, setIsAddingKav] = useState(false);
  const [newKav, setNewKav] = useState('');

  useEffect(() => {
    const linesStr = parseInt(lineCount, 10);
    if (!isNaN(linesStr)) {
      setAutoSize(calculateOrderSize(linesStr));
    }
  }, [lineCount]);

  const sizeToUse = manualSize || autoSize;
  const isFormValid = orderNumber.trim() !== '' && kav !== '' && lineCount !== '' && parseInt(lineCount, 10) > 0;

  const handleCreate = (startPicking: boolean) => {
    if (!isFormValid) return;

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      orderNumber,
      kav,
      pickerId: pickerId || undefined,
      lineCount: parseInt(lineCount, 10),
      size: sizeToUse,
      status: startPicking ? 'picking' : (pickerId ? 'assigned' : 'new'),
      createdAt: Date.now(),
      startedAt: startPicking ? Date.now() : undefined,
      errorIds: []
    };

    onCreate(newOrder);
  };

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col h-[100dvh] anim-slide-in" dir="rtl">
      
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={onClose} className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500">
          <ArrowRight size={24} />
        </button>
        <h2 className="font-bold text-xl flex-1 text-gray-900">הזמנה חדשה</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-5 pb-32 flex flex-col gap-6 text-right">
        
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">מספר הזמנה</label>
          <input 
            type="text"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg text-left"
            placeholder="ORD-XXXX"
            dir="ltr"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="font-bold text-gray-700">קו חלוקה</label>
            <button 
              onClick={() => setIsAddingKav(!isAddingKav)}
              className="text-sm text-blue-600 font-medium active:bg-blue-50 px-2 py-1 rounded"
            >
              {isAddingKav ? 'בחר מרשימה' : '➕ קו חדש'}
            </button>
          </div>
          
          {isAddingKav ? (
            <div className="flex gap-2">
              <input 
                type="text"
                className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg"
                placeholder="הקלד שם קו..."
                value={newKav}
                onChange={e => setNewKav(e.target.value)}
              />
              <button 
                onClick={() => {
                  if (newKav.trim()) {
                    onAddLine(newKav.trim());
                    setKav(newKav.trim());
                    setIsAddingKav(false);
                    setNewKav('');
                  }
                }}
                disabled={!newKav.trim()}
                className="bg-gray-900 text-white px-5 rounded-xl font-bold disabled:opacity-50 active:scale-95 transition-transform"
              >
                הוסף
              </button>
            </div>
          ) : (
            <select 
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg appearance-none"
              value={kav}
              onChange={e => setKav(e.target.value)}
            >
              <option value="" disabled>בחר קו חלוקה</option>
              {lines.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700 flex items-center gap-2">
             עובד מלקט <User size={16} className="text-gray-400"/>
          </label>
          <select 
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg appearance-none"
            value={pickerId}
            onChange={e => setPickerId(e.target.value)}
          >
            <option value="">לא שויך - ישויך בהמשך</option>
            {pickers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-gray-700 flex items-center gap-2">
               שורות <Package size={16} className="text-gray-400"/>
            </label>
            <input 
              type="number"
              min="1"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-2xl text-center"
              value={lineCount}
              onChange={e => setLineCount(e.target.value.replace(/\\D/g, ''))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-bold text-gray-700 flex justify-between">
              <span>גודל</span>
              {manualSize && (
                <button 
                  onClick={() => setManualSize(null)} 
                  className="text-xs text-blue-600 font-medium bg-blue-50 px-2 rounded"
                >
                  חזור לאוטומטי
                </button>
              )}
            </label>
            <select 
              className={`w-full border rounded-xl px-4 py-3 h-14 font-bold text-2xl text-center font-mono ${manualSize ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-gray-50 border-gray-300 text-gray-700'}`}
              value={sizeToUse}
              onChange={e => setManualSize(e.target.value as OrderSize)}
              dir="ltr"
            >
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
            </select>
            {!manualSize && lineCount !== '' && (
              <span className="text-[11px] text-gray-500 font-medium">מחושב אוטומטית עפ״י שורות</span>
            )}
          </div>
        </div>

      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white pb-safe flex flex-col gap-3 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
        {pickerId ? (
          <>
            <button 
              onClick={() => handleCreate(false)}
              disabled={!isFormValid}
              className="w-full bg-white border-2 border-gray-300 text-gray-700 rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              הוסף כמשויך (לא התחיל)
            </button>
            <button 
              onClick={() => handleCreate(true)}
              disabled={!isFormValid}
              className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              הוסף והתחל לקט
            </button>
          </>
        ) : (
          <button 
            onClick={() => handleCreate(false)}
            disabled={!isFormValid}
            className="w-full bg-gray-900 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center disabled:opacity-50"
          >
            <Box size={20} className="ml-2" />
            הוסף למאגר כחדש
          </button>
        )}
      </footer>

    </div>
  );
}
