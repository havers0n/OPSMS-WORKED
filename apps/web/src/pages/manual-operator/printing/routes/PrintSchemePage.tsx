import { useSearchParams, Link } from 'react-router-dom';
import { routes } from '@/shared/config/routes';
import { PrintPage } from '../components/PrintPage';
import { PrintToolbar } from '../components/PrintToolbar';
import { SchemePrintDocument } from '../components/SchemePrintDocument';
import { getDemoSchemeData } from '../types/printDtos';
import '../styles/print.css';

export function PrintSchemePage() {
  const [searchParams] = useSearchParams();
  const shiftId = searchParams.get('shiftId');
  const distributionArea = searchParams.get('distributionArea');

  if (!shiftId || !distributionArea) {
    return (
      <div dir="rtl" style={{ padding: 40, fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif' }}>
        <h1>לא נבחרה משמרת להדפסה</h1>
        <p style={{ color: '#666', marginBottom: 16 }}>
          נדרשים פרמטרי shiftId ו-distributionArea לצפייה במסמך ההדפסה.
        </p>
        <Link
          to={routes.operatorManualPrinting}
          style={{ color: '#0f6a8e', textDecoration: 'underline' }}
        >
          חזור להדפסות
        </Link>
      </div>
    );
  }

  const data = getDemoSchemeData(shiftId, distributionArea);

  return (
    <>
      <PrintToolbar />
      <PrintPage>
        <SchemePrintDocument data={data} />
      </PrintPage>
    </>
  );
}
