import { useNavigate } from 'react-router-dom';
import { CalendarPlus, ListFilter, WandSparkles } from 'lucide-react';

export function LinesLanding() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50" dir="rtl">
      <div className="text-center space-y-6 max-w-sm mx-auto p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">תכנון קווים</h1>
          <p className="text-sm text-gray-500">בחר פעולה כדי להתחיל בתכנון</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate('/operator/manual/lines?intent=plan-for-date')}
            className="w-full flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-right hover:border-blue-400 hover:bg-blue-100 transition-colors"
            data-testid="lines-landing-plan-for-date"
          >
            <WandSparkles size={20} className="text-blue-600 shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">בנה קווים מביקוש זמין</p>
              <p className="text-xs text-blue-700">יוצר טיוטה מכל ההזמנות הזמינות ופותח את בונה הקווים</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/operator/manual/lines?mode=demand&intent=backlog')}
            className="w-full flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-right hover:border-emerald-400 hover:bg-emerald-100 transition-colors"
            data-testid="lines-landing-demand-backlog"
          >
            <ListFilter size={20} className="text-emerald-600 shrink-0" />
            <div><p className="font-semibold text-emerald-900">מאגר ביקוש</p><p className="text-xs text-emerald-700">צפייה ובקרה בהזמנות הזמינות, סטטוסים ועדכונים</p></div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/operator/manual/lines?intent=plan-from-batch')}
            className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-right hover:border-gray-400 hover:bg-gray-50 transition-colors"
            data-testid="lines-landing-plan-from-batch"
          >
            <CalendarPlus size={20} className="text-gray-500 shrink-0" />
            <div>
              <p className="font-semibold text-gray-800">תכנון ידני מאצווה</p>
              <p className="text-xs text-gray-500">אפשרות מתקדמת לבחירת קובץ/אצווה ידנית</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
