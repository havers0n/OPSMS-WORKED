import { useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@/shared/config/routes';
import { Printer, Clock, ListChecks } from 'lucide-react';
import type { PickerSheetScope } from '../types/printDtos';

interface PrintingHomePageProps {
  shiftId?: string | null;
}

const DEMO_SHIFT_ID = 'demo-print-shift';

const demoAreas = [
  { value: 'שפלה 2', label: 'שפלה 2' },
  { value: 'שפלה אמצעי', label: 'שפלה אמצעי' },
  { value: "צ'יטה", label: "צ'יטה" },
  { value: 'דרום', label: 'דרום' }
];

const demoLines = [
  { value: 'קו אריזה 1', label: 'קו אריזה 1' },
  { value: 'קו אריזה 2', label: 'קו אריזה 2' },
];

const demoWorkGroups: Record<string, { value: string; label: string }[]> = {
  'קו אריזה 1': [
    { value: 'משמרת בוקר — קבוצה א', label: 'משמרת בוקר — קבוצה א' },
    { value: 'משמרת בוקר — קבוצה ב', label: 'משמרת בוקר — קבוצה ב' },
  ],
  'קו אריזה 2': [
    { value: 'משמרת בוקר — קבוצה ג', label: 'משמרת בוקר — קבוצה ג' },
    { value: 'משמרת בוקר — קבוצה ד', label: 'משמרת בוקר — קבוצה ד' },
  ],
};

export function PrintingHomePage({ shiftId }: PrintingHomePageProps) {
  const effectiveShiftId = shiftId ?? DEMO_SHIFT_ID;
  const isDemo = !shiftId;
  const [selectedArea, setSelectedArea] = useState(demoAreas[0].value);
  const [pickerScope, setPickerScope] = useState<PickerSheetScope>('area');
  const [pickerLine, setPickerLine] = useState(demoLines[0].value);
  const [pickerWorkGroup, setPickerWorkGroup] = useState(demoWorkGroups[demoLines[0].value][0].value);

  const schemePrintPath = `${routes.operatorManualPrintScheme}?shiftId=${effectiveShiftId}&distributionArea=${encodeURIComponent(selectedArea)}`;

  const pickerSheetBase = `${routes.operatorManualPrintPickerSheet}?shiftId=${effectiveShiftId}&distributionArea=${encodeURIComponent(selectedArea)}&scope=${pickerScope}`;
  const pickerSheetPath = pickerScope === 'line'
    ? `${pickerSheetBase}&planningLineName=${encodeURIComponent(pickerLine)}`
    : pickerScope === 'workGroup'
    ? `${pickerSheetBase}&planningLineName=${encodeURIComponent(pickerLine)}&workGroupName=${encodeURIComponent(pickerWorkGroup)}`
    : pickerSheetBase;

  const handleLineChange = (line: string) => {
    setPickerLine(line);
    const groups = demoWorkGroups[line];
    if (groups && groups.length > 0) {
      setPickerWorkGroup(groups[0].value);
    }
  };

  return (
    <div dir="rtl" data-testid="manual-printing-section">
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#10243e', marginBottom: 8 }}>
        הדפסת מסמכים
      </h1>

      {isDemo && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '6px 12px', fontSize: 13, color: '#856404', marginBottom: 20 }}>
          <Clock size={16} />
          מצב הדגמה — נתונים מדומים
        </div>
      )}

      {/* Scheme print card */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Printer size={20} color="#0f6a8e" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#10243e', margin: 0 }}>
            הדפסת סכימה
          </h2>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#5f7084', marginBottom: 4 }}>
            איזור הפצה
          </label>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            style={{ width: '100%', maxWidth: 300, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, background: '#fff' }}
          >
            {demoAreas.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        <Link
          to={schemePrintPath}
          style={{ display: 'inline-block', padding: '8px 20px', background: '#0f6a8e', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
        >
          פתח מסמך להדפסה
        </Link>
      </div>

      {/* Picker sheet card */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <ListChecks size={20} color="#0f6a8e" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#10243e', margin: 0 }}>
            דף ליקוט
          </h2>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#5f7084', marginBottom: 4 }}>
            איזור הפצה
          </label>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            style={{ width: '100%', maxWidth: 300, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, background: '#fff' }}
          >
            {demoAreas.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#5f7084', marginBottom: 4 }}>
            טווח הדפסה
          </label>
          <select
            value={pickerScope}
            onChange={(e) => setPickerScope(e.target.value as PickerSheetScope)}
            style={{ width: '100%', maxWidth: 300, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, background: '#fff' }}
          >
            <option value="area">אזור הפצה</option>
            <option value="line">קו</option>
            <option value="workGroup">קבוצת עבודה</option>
          </select>
        </div>

        {pickerScope !== 'area' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#5f7084', marginBottom: 4 }}>
              קו
            </label>
            <select
              value={pickerLine}
              onChange={(e) => handleLineChange(e.target.value)}
              style={{ width: '100%', maxWidth: 300, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, background: '#fff' }}
            >
              {demoLines.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        {pickerScope === 'workGroup' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#5f7084', marginBottom: 4 }}>
              קבוצת עבודה
            </label>
            <select
              value={pickerWorkGroup}
              onChange={(e) => setPickerWorkGroup(e.target.value)}
              style={{ width: '100%', maxWidth: 300, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, background: '#fff' }}
            >
              {(demoWorkGroups[pickerLine] ?? []).map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
        )}

        <Link
          to={pickerSheetPath}
          style={{ display: 'inline-block', padding: '8px 20px', background: '#0f6a8e', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
        >
          פתח דף ליקוט
        </Link>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, opacity: 0.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Printer size={20} color="#999" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#666', margin: 0 }}>
            הדפסת תוויות משטחים
          </h2>
        </div>
        <span style={{ fontSize: 13, color: '#999', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={14} /> בקרוב
        </span>
      </div>
    </div>
  );
}
