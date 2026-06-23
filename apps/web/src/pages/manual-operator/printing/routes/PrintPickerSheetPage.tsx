import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { routes } from '@/shared/config/routes';
import { bffRequest, BffRequestError } from '@/shared/api/bff/client';
import { PrintPage } from '../components/PrintPage';
import { PrintToolbar } from '../components/PrintToolbar';
import { PickerSheetPrintDocument } from '../components/PickerSheetPrintDocument';
import { getDemoPickerSheetData } from '../types/printDtos';
import type { PickerSheetScope, PickerSheetPrintData } from '../types/printDtos';
import {
  buildPickerSheetLinePdfUrl,
  buildPickerSheetWorkGroupPdfUrl
} from '../lib/picker-sheet-urls';
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
    const params = {
      shiftId,
      distributionArea,
      planningLineName,
      workGroupName
    };
    return scope === 'line'
      ? buildPickerSheetLinePdfUrl(params)
      : buildPickerSheetWorkGroupPdfUrl(params);
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
      setError('Unable to load printable picker-sheet data.');
      setLoading(false);
      setRealData(null);
      return;
    }

    if (scope === 'line') {
      if (!distributionArea || !planningLineName) {
        setError('Missing print parameters: distributionArea, planningLineName.');
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
        planningLineName
      });

      bffRequest<PickerSheetPrintData>(`/api/manual-shifts/${shiftId}/print/picker-sheet?${params.toString()}`)
        .then((data) => {
          setRealData(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          const message = err instanceof BffRequestError
            ? `Request failed: ${err.message} (status ${err.status})`
            : 'Unable to load printable picker-sheet data.';
          setError(message);
          setLoading(false);
        });
      return;
    }

    if (!distributionArea || !planningLineName || !workGroupName) {
      setError('Missing print parameters: distributionArea, planningLineName, workGroupName.');
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
      workGroupName
    });

    bffRequest<PickerSheetPrintData>(`/api/manual-shifts/${shiftId}/print/picker-sheet?${params.toString()}`)
      .then((data) => {
        setRealData(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message = err instanceof BffRequestError
          ? `Request failed: ${err.message} (status ${err.status})`
          : 'Unable to load printable picker-sheet data.';
        setError(message);
        setLoading(false);
      });
  }, [shiftId, distributionArea, scope, planningLineName, workGroupName, isDemo]);

  if (!shiftId || !distributionArea) {
    return (
      <div dir="rtl" style={{ padding: 40, textAlign: 'center' }} data-testid="print-picker-sheet-error">
        <h1 style={{ fontSize: 22, color: '#10243e' }}>Missing print parameters</h1>
        <p style={{ color: '#5f7084', marginTop: 8 }}>Provide shiftId, distributionArea, and scope.</p>
        <Link
          to={routes.operatorManualPrinting}
          style={{ display: 'inline-block', marginTop: 16, padding: '8px 20px', background: '#0f6a8e', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
        >
          Back to printing
        </Link>
      </div>
    );
  }

  return (
    <>
      {!pdfRender && <PrintToolbar pdfUrl={pdfUrl} />}
      <PrintPage>
        {loading && (
          <div dir="rtl" style={{ padding: 40, textAlign: 'center' }} data-testid="print-picker-sheet-loading">
            <p style={{ color: '#5f7084', fontSize: 16 }}>Loading printable picker-sheet data...</p>
          </div>
        )}
        {error && !loading && (
          <div dir="rtl" style={{ padding: 40, textAlign: 'center' }} data-testid="print-picker-sheet-error">
            <h1 style={{ fontSize: 22, color: '#b91c1c' }}>Error</h1>
            <p style={{ color: '#5f7084', marginTop: 8 }}>{error}</p>
            <Link
              to={routes.operatorManualPrinting}
              style={{ display: 'inline-block', marginTop: 16, padding: '8px 20px', background: '#0f6a8e', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
            >
              Back to printing
            </Link>
          </div>
        )}
        {!loading && !error && realData && realData.planningLines.length === 0 && (
          <div dir="rtl" style={{ padding: 40, textAlign: 'center' }} data-testid="print-picker-sheet-empty">
            <p style={{ color: '#5f7084', fontSize: 16 }}>No planning lines were found for this picker-sheet.</p>
          </div>
        )}
        {!loading && !error && realData && realData.planningLines.length > 0 && (
          <div data-testid="print-picker-sheet-document">
            <PickerSheetPrintDocument data={realData} />
          </div>
        )}
      </PrintPage>
    </>
  );
}
