import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, User, Plus, X } from 'lucide-react';
import type { ManualShiftWorker, ManualShiftPeopleSummaryItem, ManualShiftWorkerRole } from '@wos/domain';
import { MANUAL_SHIFT_WORKER_ROLE_LABELS } from '@wos/domain';
import { shiftWorkersQueryOptions, manualShiftKeys, peopleSummaryQueryOptions } from '@/entities/manual-shift/api/queries';
import { useCreateManualShiftWorker } from '@/entities/manual-shift/api/mutations';
import { bffRequest } from '@/shared/api/bff/client';

interface PeopleTabProps {
  shiftId: string;
}

const ROLES: ManualShiftWorkerRole[] = ['picker', 'checker', 'packer', 'other'];

export function PeopleTab({ shiftId }: PeopleTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: workers, isLoading: workersLoading } = useQuery(shiftWorkersQueryOptions(shiftId));
  const { data: peopleSummary, isLoading: summaryLoading } = useQuery(peopleSummaryQueryOptions(shiftId));

  const isLoading = workersLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const roster = workers ?? [];
  const summaryItems = peopleSummary?.items ?? [];

  // Build merged view: roster workers + unregistered free-text names
  const summaryByName = new Map<string, ManualShiftPeopleSummaryItem>(
    summaryItems.map((item) => [item.pickerName, item])
  );

  // Free-text names not matched to a roster worker
  const unregisteredItems = summaryItems.filter((item) => {
    return !roster.some((w) => w.name === item.pickerName);
  });

  return (
    <div className="flex flex-col gap-3 p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base">עובדי המשמרת</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 bg-gray-900 text-white rounded-xl px-3 py-2 text-sm font-bold active:scale-[0.97] transition-transform"
        >
          <Plus size={16} />
          <span>הוסף עובד</span>
        </button>
      </div>

      {showAddForm && (
        <AddWorkerForm
          shiftId={shiftId}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {roster.length === 0 && summaryItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
          <User size={48} className="text-gray-300" />
          <p className="text-gray-400 font-medium text-base">אין עובדים ברשימה</p>
          <p className="text-gray-400 text-sm">הוסף עובד לרשימת המשמרת</p>
        </div>
      )}

      {roster.map((worker) => {
        const summary = summaryByName.get(worker.name) ?? null;
        return (
          <WorkerCard
            key={worker.id}
            worker={worker}
            summary={summary}
            shiftId={shiftId}
          />
        );
      })}

      {unregisteredItems.length > 0 && (
        <>
          <div className="pt-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">
              לא ברשימה
            </p>
          </div>
          {unregisteredItems.map((item, i) => (
            <UnregisteredCard key={item.pickerName || i} item={item} />
          ))}
        </>
      )}
    </div>
  );
}

function WorkerCard({
  worker,
  summary,
  shiftId
}: {
  worker: ManualShiftWorker;
  summary: ManualShiftPeopleSummaryItem | null;
  shiftId: string;
}) {
  const queryClient = useQueryClient();
  const deactivate = useMutation({
    mutationFn: () =>
      bffRequest<ManualShiftWorker>(`/api/manual-shift-workers/${worker.id}/deactivate`, {
        method: 'PATCH'
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.workers(shiftId) });
    }
  });

  const name = worker.name;
  const roleLabel = MANUAL_SHIFT_WORKER_ROLE_LABELS[worker.role];

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 ${!worker.active ? 'opacity-60' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${worker.active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          {name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-base truncate">{name}</p>
            <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">
              {roleLabel}
            </span>
            {!worker.active && (
              <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 shrink-0">
                לא פעיל
              </span>
            )}
          </div>
          {summary?.currentActiveOrder && (
            <p className="text-sm text-blue-600 truncate mt-0.5">
              פעיל: {summary.currentActiveOrder.pointName ?? 'ללא נקודה'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {summary && summary.errorCount > 0 && (
            <span className="text-xs text-red-600 font-bold bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
              {summary.errorCount} תקלות
            </span>
          )}
          {worker.active && (
            <button
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
              className="p-1 text-gray-400 hover:text-gray-600 active:scale-90 transition-transform"
              title="הסר מהמשמרת"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <StatCell label="פעיל" value={summary?.activeOrdersCount ?? 0} color="blue" />
        <StatCell label="בדיקה" value={summary?.waitingCheckCount ?? 0} color="amber" />
        <StatCell label="הוחזר" value={summary?.returnedCount ?? 0} color="red" />
        <StatCell label="הסתיים" value={summary?.doneCount ?? 0} color="green" />
      </div>
    </div>
  );
}

function UnregisteredCard({ item }: { item: ManualShiftPeopleSummaryItem }) {
  const name = item.pickerName || 'ללא מלקט';

  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-base shrink-0">
          {name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-600 text-base truncate">{name}</p>
          <p className="text-xs text-gray-400">טקסט חופשי</p>
        </div>
        {item.errorCount > 0 && (
          <span className="text-xs text-red-600 font-bold bg-red-50 border border-red-100 rounded-full px-2 py-0.5 shrink-0">
            {item.errorCount} תקלות
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <StatCell label="פעיל" value={item.activeOrdersCount} color="blue" />
        <StatCell label="בדיקה" value={item.waitingCheckCount} color="amber" />
        <StatCell label="הוחזר" value={item.returnedCount} color="red" />
        <StatCell label="הסתיים" value={item.doneCount} color="green" />
      </div>
    </div>
  );
}

function AddWorkerForm({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<ManualShiftWorkerRole>('picker');
  const createWorker = useCreateManualShiftWorker(shiftId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createWorker.mutate(
      { name: name.trim(), role },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-blue-900 text-sm">עובד חדש</p>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-600">
          <X size={18} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          className="w-full bg-white border border-blue-200 rounded-xl px-4 py-3 font-bold text-base"
          placeholder="שם העובד"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-4 gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-xl py-2 text-xs font-bold transition-colors ${
                role === r
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-100'
              }`}
            >
              {MANUAL_SHIFT_WORKER_ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!name.trim() || createWorker.isPending}
          className="w-full bg-blue-700 text-white rounded-xl py-3 font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {createWorker.isPending ? 'שומר...' : 'הוסף'}
        </button>
      </form>
    </div>
  );
}

type StatColor = 'blue' | 'amber' | 'red' | 'green';

function StatCell({ label, value, color }: { label: string; value: number; color: StatColor }) {
  const colorMap: Record<StatColor, string> = {
    blue: 'text-blue-700 bg-blue-50',
    amber: 'text-amber-700 bg-amber-50',
    red: 'text-red-700 bg-red-50',
    green: 'text-green-700 bg-green-50'
  };

  return (
    <div className={`rounded-lg p-2 ${colorMap[color]}`}>
      <p className="font-bold text-lg leading-none">{value}</p>
      <p className="text-xs mt-1 font-medium">{label}</p>
    </div>
  );
}
