import { useCallback, useState } from 'react';
import { bffRequestBlob } from '@/shared/api/bff/client';

const REVOKE_OBJECT_URL_DELAY_MS = 60_000;

export function useOpenPickerSheetPdf(pdfUrl: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPdf = useCallback(async () => {
    if (!pdfUrl || isLoading) return;

    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
      pdfWindow.opener = null;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { blob } = await bffRequestBlob(pdfUrl);
      const blobUrl = URL.createObjectURL(blob);

      if (!pdfWindow) {
        URL.revokeObjectURL(blobUrl);
        throw new Error('לא ניתן לפתוח חלון PDF חדש. בדקו שחוסם חלונות קופצים לא חסם את הפעולה.');
      }

      pdfWindow.location.href = blobUrl;
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), REVOKE_OBJECT_URL_DELAY_MS);
    } catch (err) {
      pdfWindow?.close();
      const message = err instanceof Error ? err.message : 'שגיאה לא צפויה בהכנת PDF';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, pdfUrl]);

  return { openPdf, isLoading, error };
}
