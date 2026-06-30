import { useNavigate } from 'react-router-dom';
import { CalendarPlus, FilePlus, ListFilter, Pencil } from 'lucide-react';

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
            onClick={() => navigate('/operator/manual/lines?mode=demand&intent=backlog')}
            className="w-full flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-right hover:border-emerald-400 hover:bg-emerald-100 transition-colors"
            data-testid="lines-landing-demand-backlog"
          >
            <ListFilter size={20} className="text-emerald-600 shrink-0" />
            <div><p className="font-semibold text-emerald-900">מאגר ביקוש</p><p className="text-xs text-emerald-700">צפייה ובקרה בהזמנות הביקוש הגלובליות</p></div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/operator/manual/lines?intent=plan-for-date')}
            className="w-full flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-right hover:border-blue-400 hover:bg-blue-100 transition-colors"
            data-testid="lines-landing-plan-for-date"
          >
            <CalendarPlus size={20} className="text-blue-600 shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">תכנן עבודה לתאריך</p>
              <p className="text-xs text-blue-700">צור משמרת חדשה לתאריך ותכנן את קווי העבודה</p>
            </div>
          </button>

          <button
            type="button"
            disabled
            onClick={() => navigate('/operator/manual/work')}
            className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-right opacity-50 cursor-not-allowed"
            data-testid="lines-landing-append-shift"
          >
            <FilePlus size={20} className="text-gray-400 shrink-0" />
            <div>
              <p className="font-semibold text-gray-700">הוסף הזמנות למשמרת קיימת</p>
              <p className="text-xs text-gray-500">יש להגיע ממסך העבודה</p>
            </div>
          </button>

          <button
            type="button"
            disabled
            className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-right opacity-50 cursor-not-allowed"
            data-testid="lines-landing-edit-shift"
          >
            <Pencil size={20} className="text-gray-400 shrink-0" />
            <div>
              <p className="font-semibold text-gray-700">ערוך משמרת קיימת</p>
              <p className="text-xs text-gray-500">פעולה זו תהיה זמינה בקרוב</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
