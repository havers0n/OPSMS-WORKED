import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, FileText } from 'lucide-react';
import type { BondedCoverageRequestStatus } from '@wos/domain';
import { bondedRequestsQueryOptions } from '../api/queries';
import { BondedRequestStatusBadge } from './bonded-request-status-badge';
import { BondedRequestDetailPanel } from './bonded-request-detail-panel';
import { EmptyState } from '@/shared/ui/empty-state';

type BondedRequestsListProps = {
  shiftId: string;
};

const STATUS_TABS: { status: BondedCoverageRequestStatus; label: string }[] = [
  { status: 'open', label: 'פתוחות' },
  { status: 'closed', label: 'סגורות' },
  { status: 'cancelled', label: 'בוטלו' },
];

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function BondedRequestsList({ shiftId }: BondedRequestsListProps) {
  const [activeStatus, setActiveStatus] = useState<BondedCoverageRequestStatus>('open');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const { data: requests, isLoading, error } = useQuery(
    bondedRequestsQueryOptions(shiftId, activeStatus),
  );

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Sub-header */}
      <div>
        <h2 className="text-lg font-bold text-[#111827]">בקשות כיסוי</h2>
        <p className="text-sm text-gray-500 mt-0.5">ניהול בקשות כיסוי בונדד</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setActiveStatus(tab.status)}
            className={`px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeStatus === tab.status
                ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertCircle size={24} className="text-red-400" />
          <span className="text-sm font-medium text-red-600">
            לא הצלחנו לטעון בקשות כיסוי
          </span>
        </div>
      )}

      {requests && requests.length === 0 && (
        <EmptyState
          title="אין בקשות"
          description={`לא נמצאו בקשות כיסוי בסטטוס זה`}
          icon={<FileText size={20} className="text-gray-400" />}
        />
      )}

      {requests && requests.length > 0 && (
        <div className="flex flex-col gap-2">
          {requests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedRequestId(request.id)}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-4 text-right transition-colors hover:bg-slate-50 hover:border-gray-300 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <BondedRequestStatusBadge status={request.status} />
                  <span className="text-sm font-bold text-slate-800 truncate">
                    {request.title ?? 'בקשת כיסוי'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>
                    {request.createdByName ?? '—'}
                  </span>
                  <span>
                    {formatDateTime(request.createdAt)}
                  </span>
                  {request.planningDate && (
                    <span>
                      תאריך תכנון: {request.planningDate}
                    </span>
                  )}
                </div>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-slate-300 shrink-0 rotate-180"
              >
                <path
                  d="M6 4L10 8L6 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer overlay */}
      {selectedRequestId && (
        <BondedRequestDetailPanel
          requestId={selectedRequestId}
          shiftId={shiftId}
          onClose={() => setSelectedRequestId(null)}
        />
      )}
    </div>
  );
}
