import { useState } from 'react';
import { useActiveFloorId, useActiveSiteId, useSetActiveFloorId } from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useSites } from '@/entities/site/api/use-sites';
import { useCreateFloor } from '@/features/floor-create/model/use-create-floor';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useT } from '@/shared/i18n';

export function SiteFloorSetupState({ hasDraft }: { hasDraft: boolean }) {
  const t = useT();
  const [newFloorCode, setNewFloorCode] = useState('');
  const [newFloorName, setNewFloorName] = useState('');
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveFloorId = useSetActiveFloorId();
  const { data: sites = [] } = useSites();
  const { data: floors = [] } = useFloors(activeSiteId);
  const createFloor = useCreateFloor(activeSiteId);
  const createDraft = useCreateLayoutDraft(activeFloorId);
  const isBusy = createFloor.isPending || createDraft.isPending;
  const activeSite = sites.find((site) => site.id === activeSiteId);
  const activeFloor = floors.find((floor) => floor.id === activeFloorId);
  const hasFloors = floors.length > 0;

  const handleCreateFloor = async () => {
    if (!activeSiteId) {
      return;
    }

    const createdFloorId = await createFloor.mutateAsync({
      siteId: activeSiteId,
      code: newFloorCode.trim(),
      name: newFloorName.trim(),
      sortOrder: floors.length
    });
    setActiveFloorId(createdFloorId);
    setNewFloorCode('');
    setNewFloorName('');
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl items-center px-6 py-8">
      <section className="w-full rounded-[24px] border border-[var(--border-muted)] bg-[var(--surface-primary)] p-8 shadow-[var(--shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{t('warehouse.floorGate.eyebrow')}</div>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">
              {hasFloors ? t('warehouse.floorGate.title') : t('warehouse.floorGate.emptyTitle')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              {hasFloors
                ? t('warehouse.floorGate.description')
                : t('warehouse.floorGate.emptyDescription')}
            </p>
          </div>
          <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-3 text-sm text-[var(--text-muted)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('warehouse.selection.current')}</div>
            <div className="mt-2 font-medium text-[var(--text-primary)]">{activeSite?.code ?? t('warehouse.state.missing')}</div>
            <div className="mt-1">{t('warehouse.selection.floors', { count: floors.length })}</div>
          </div>
        </div>

        {activeFloorId && !hasDraft && (
          <div className="mt-8 rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
            <div className="text-sm font-semibold text-[var(--text-primary)]">{activeFloor?.name ?? t('warehouse.field.floor')}</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {t('warehouse.floorGate.selectedFloor', { code: activeFloor?.code ?? activeFloorId })}
            </div>
            <button type="button" disabled={createDraft.isPending} onClick={() => void createDraft.mutateAsync(activeFloorId)} className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              {t('warehouse.action.createFirstDraft')}
            </button>
          </div>
        )}

        {!activeFloorId && hasFloors && (
          <div className="mt-8 grid gap-3">
            {floors.map((floor) => (
              <div key={floor.id} className="grid gap-4 rounded-[18px] border border-[var(--border-muted)] bg-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="text-base font-semibold text-[var(--text-primary)]">{floor.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                    <span dir="ltr">{t('warehouse.floorGate.floorCode', { code: floor.code })}</span>
                    <span>{t('warehouse.floorGate.sortOrder', { value: floor.sortOrder + 1 })}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveFloorId(floor.id)} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm">
                  {t('warehouse.floorGate.openFloor')}
                </button>
              </div>
            ))}
          </div>
        )}

        {!hasFloors && (
          <div className="mt-8 grid max-w-xl gap-3">
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.floorCode')} value={newFloorCode} onChange={(event) => setNewFloorCode(event.target.value)} dir="ltr" />
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.floorName')} value={newFloorName} onChange={(event) => setNewFloorName(event.target.value)} dir="auto" />
            <button type="button" disabled={isBusy || !activeSiteId || !newFloorCode.trim() || !newFloorName.trim()} onClick={() => void handleCreateFloor()} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              {t('warehouse.action.createFloorInActiveSite')}
            </button>
          </div>
        )}

        {hasFloors && !activeFloorId && (
          <details className="mt-6 rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">{t('warehouse.floorGate.createAnotherFloor')}</summary>
            <div className="mt-4 grid max-w-xl gap-3">
              <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.floorCode')} value={newFloorCode} onChange={(event) => setNewFloorCode(event.target.value)} dir="ltr" />
              <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.floorName')} value={newFloorName} onChange={(event) => setNewFloorName(event.target.value)} dir="auto" />
              <button type="button" disabled={isBusy || !activeSiteId || !newFloorCode.trim() || !newFloorName.trim()} onClick={() => void handleCreateFloor()} className="rounded-xl border border-[var(--border-muted)] bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                {t('warehouse.action.createFloorInActiveSite')}
              </button>
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
