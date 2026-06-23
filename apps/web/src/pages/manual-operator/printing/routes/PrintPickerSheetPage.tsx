import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { routes } from '@/shared/config/routes';
import { bffRequest, BffRequestError } from '@/shared/api/bff/client';
import { PrintPage } from '../components/PrintPage';
import { PrintToolbar } from '../components/PrintToolbar';
import { PickerSheetPrintDocument } from '../components/PickerSheetPrintDocument';
import { getDemoPickerSheetData } from '../types/printDtos';
import type { PickerSheetScope, PickerSheetPrintData } from '../types/printDtos';
import '../styles/print.css';

const DEMO_SHIFT = 'demo-print-shift';

export function PrintPickerSheetPage() {
  const [searchParams] = useSearchParams();
  const shiftId = searchParams.get('shiftId');
  const distributionArea = searchParams.get('distributionArea');
  const scopeParam = searchParams.get('scope');
  const planningLineName = searchParams.get('planningLineName') ?? undefined;
  const workGroupName = searchParams.get('workGroupName') ?? undefined;
  const pdfRender = searchParams.get('pdfRender') === '1';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realData, setRealData] = useState<PickerSheetPrintData | null>(null);

  const isDemo = shiftId === DEMO_SHIFT;

  const pdfUrl = useMemo<string | undefined>(() => {
    if (!shiftId || !distributionArea || !planningLineName) return undefined;
    const scope = scopeParam === 'line' ? 'line' : 'workGroup';
    const params: Record<string, string> = {
      shiftId,
      scope,
      distributionArea,
      planningLineName,
    };
    if (scope === 'workGroup' && workGroupName) {
      params.workGroupName = workGroupName;
    }
    return `/api/manual-shifts/${shiftId}/print/picker-sheet.pdf?${new URLSearchParams(params).toString()}`;
  }, [shiftId, distributionArea, planningLineName, workGroupName, scopeParam]);
  const scope: PickerSheetScope = scopeParam === 'line' ? 'line' : scopeParam === 'workGroup' ? 'workGroup' : 'area';

  useEffect(() => {
    if (!shiftId || !distributionArea) return;

    if (isDemo) {
      const demoData = getDemoPickerSheetData(shiftId, distributionArea, scope, planningLineName, workGroupName);
      setRealData(demoData);
      setLoading(false);
      setError(null);
      return;
    }

    if (scope === 'area') {
      setError('הדפסה בטווח אזור אינה זמינה עדיין עבור משמרת אמיתית. נא לבחור טווח קו או קבוצת עבודה.');
      setLoading(false);
      setRealData(null);
      return;
    }

    if (scope === 'line') {
      if (!distributionArea || !planningLineName) {
        setError('חסרים פרמטרים להדפסה: distributionArea, planningLineName.');
        setLoading(false);
        setRealData(null);
        return;
      }

      setLoading(true);
      setError(null);
      setRealData(null);

      const params = new URLSearchParams({
        scope: 'line',
        distributionArea,
        planningLineName,
      });

      bffRequest<PickerSheetPrintData>(
        `/api/manual-shifts/${shiftId}/print/picker-sheet?${params.toString()}`
      )
        .then((data) => {
          setRealData(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          const message = err instanceof BffRequestError
            ? `שגיאה: ${err.message} (קוד ${err.status})`
            : 'שגיאה לא צפויה בטעינת נתוני הדפסה';
          setError(message);
          setLoading(false);
        });
      return;
    }

    if (!distributionArea || !planningLineName || !workGroupName) {
      setError('חסרים פרמטרים להדפסה: distributionArea, planningLineName, workGroupName.');
      setLoading(false);
      setRealData(null);
      return;
    }

    setLoading(true);
    setError(null);
    setRealData(null);

    const params = new URLSearchParams({
      scope: 'workGroup',
      distributionArea,
      planningLineName,
      workGroupName,
    });

    bffRequest<PickerSheetPrintData>(
      `/api/manual-shifts/${shiftId}/print/picker-sheet?${params.toString()}`
    )
      .then((data) => {
        setRealData(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message = err instanceof BffRequestError
          ? `שגיאה: ${err.message} (קוד ${err.status})`
          : 'שגיאה לא צפויה בטעינת נתוני הדפסה';
        setError(message);
        setLoading(false);
      });
  }, [shiftId, distributionArea, scope, planningLineName, workGroupName, isDemo]);

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

  return (
    <>
      {!pdfRender && <PrintToolbar pdfUrl={pdfUrl} />}
      <PrintPage>
        {loading && (
          <div dir="rtl" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#5f7084', fontSize: 16 }}>טוען נתוני הדפסה...</p>
          </div>
        )}
        {error && !loading && (
          <div dir="rtl" style={{ padding: 40, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, color: '#b91c1c' }}>שגיאה</h1>
            <p style={{ color: '#5f7084', marginTop: 8 }}>{error}</p>
            <Link
              to={routes.operatorManualPrinting}
              style={{ display: 'inline-block', marginTop: 16, padding: '8px 20px', background: '#0f6a8e', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
            >
              חזור להדפסות
            </Link>
          </div>
        )}
        {!loading && !error && realData && realData.planningLines.length === 0 && (
          <div dir="rtl" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#5f7084', fontSize: 16 }}>לא נמצאו פריטים להדפסה.</p>
          </div>
        )}
        {!loading && !error && realData && realData.planningLines.length > 0 && (
          <PickerSheetPrintDocument data={realData} />
        )}
      </PrintPage>
    </>
  );
}
