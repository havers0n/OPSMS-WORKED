import { useSearchParams, Link } from 'react-router-dom';
import { routes } from '@/shared/config/routes';
import { PrintPage } from '../components/PrintPage';
import { PrintToolbar } from '../components/PrintToolbar';
import { PickerSheetPrintDocument } from '../components/PickerSheetPrintDocument';
import { getDemoPickerSheetData } from '../types/printDtos';
import type { PickerSheetScope } from '../types/printDtos';
import '../styles/print.css';

export function PrintPickerSheetPage() {
  const [searchParams] = useSearchParams();
  const shiftId = searchParams.get('shiftId');
  const distributionArea = searchParams.get('distributionArea');
  const scopeParam = searchParams.get('scope');
  const planningLineName = searchParams.get('planningLineName') ?? undefined;
  const workGroupName = searchParams.get('workGroupName') ?? undefined;

  if (!shiftId || !distributionArea) {
    return (
      <div dir="rtl" style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, color: '#10243e' }}>לא נבחרה משמרת להדפסה</h1>
        <p style={{ color: '#5f7084', marginTop: 8 }}>נדרשים פרמטרי shiftId, distributionArea ו-scope.</p>
        <Link
          to={routes.operatorManualPrinting}
          style={{ display: 'inline-block', marginTop: 16, padding: '8px 20px', background: '#0f6a8e', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
        >
          חזור להדפסות
        </Link>
      </div>
    );
  }

  const scope: PickerSheetScope = scopeParam === 'line' ? 'line' : scopeParam === 'workGroup' ? 'workGroup' : 'area';

  const data = getDemoPickerSheetData(shiftId, distributionArea, scope, planningLineName, workGroupName);

  return (
    <>
      <PrintToolbar />
      <PrintPage>
        <PickerSheetPrintDocument data={data} />
      </PrintPage>
    </>
  );
}
