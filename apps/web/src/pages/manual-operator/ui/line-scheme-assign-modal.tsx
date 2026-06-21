import { useState } from 'react';
import { Modal } from './line-scheme-modal';

export function AssignModal({
  isOpen,
  onClose,
  workLines,
  buckets,
  onAssign,
  orderLabel,
  isReadOnlyMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  workLines: { id: string; name: string }[];
  buckets: { id: string; workLineId: string; name: string; bucketName: string | null }[];
  onAssign: (workLineId: string, bucketKey: string) => void;
  orderLabel: string;
  isReadOnlyMode: boolean;
}) {
  const [targetLine, setTargetLine] = useState('');
  const [targetBucket, setTargetBucket] = useState('');
  const lineBuckets = buckets.filter(b => b.workLineId === targetLine);

  const handleAssign = () => {
    if (!targetLine || !targetBucket) return;
    onAssign(targetLine, targetBucket);
    setTargetLine('');
    setTargetBucket('');
    onClose();
  };

  const handleClose = () => {
    setTargetLine('');
    setTargetBucket('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="שייך לקו עבודה ונקודה" footer={
      <>
        <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">ביטול</button>
        <button type="button" onClick={handleAssign} disabled={!targetLine || !targetBucket} className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">שייך</button>
      </>
    }>
      <div className="mb-6">
        <div className="text-lg font-semibold text-gray-900 mb-1">שיוך מקומי בלבד</div>
        <div className="text-gray-600 text-sm">{orderLabel}</div>
        {isReadOnlyMode && (
          <div className="mt-2 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">
            שיוך מקומי בלבד — שמירה תגיע בשלב הבא
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">בחר קו עבודה</label>
          <div className="grid grid-cols-2 gap-2">
            {workLines.map(line => (
              <div
                key={line.id}
                onClick={() => { setTargetLine(line.id); setTargetBucket(''); }}
                className={`border rounded p-3 cursor-pointer transition-colors text-sm ${
                  targetLine === line.id
                    ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-sm'
                    : 'hover:border-blue-300'
                }`}
              >
                {line.name}
              </div>
            ))}
            {workLines.length === 0 && (
              <span className="text-gray-500 text-sm col-span-2">אין קווי עבודה</span>
            )}
          </div>
        </div>

        {targetLine && (
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              בחר נקודה / קבוצה בקו {workLines.find(l => l.id === targetLine)?.name}
            </label>
            <div className="flex flex-wrap gap-2">
              {lineBuckets.map(bucket => (
                <span
                  key={bucket.id}
                  onClick={() => setTargetBucket(bucket.id)}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                    targetBucket === bucket.id
                      ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-500'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {bucket.name}
                </span>
              ))}
              {lineBuckets.length === 0 && (
                <span className="text-sm text-gray-500">אין נקודות בקו זה</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
