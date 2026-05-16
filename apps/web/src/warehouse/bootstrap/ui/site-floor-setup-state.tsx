import { useState } from 'react';
import { useActiveFloorId, useActiveSiteId, useSetActiveFloorId, useSetActiveSiteId } from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { usePublishedLayoutSummary } from '@/entities/layout-version/api/use-published-layout-summary';
import { useSites } from '@/entities/site/api/use-sites';
import { useCreateFloor } from '@/features/floor-create/model/use-create-floor';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useCreateSite } from '@/features/site-create/model/use-create-site';
import { formatDateTime, useT } from '@/shared/i18n';

export function SiteFloorSetupState({ hasDraft }: { hasDraft: boolean }) {
  const t = useT();
  const [newSiteCode, setNewSiteCode] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteTimezone, setNewSiteTimezone] = useState('Asia/Jerusalem');
  const [newFloorCode, setNewFloorCode] = useState('');
  const [newFloorName, setNewFloorName] = useState('');
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const { data: sites = [] } = useSites();
  const { data: floors = [] } = useFloors(activeSiteId);
  const publishedLayoutSummary = usePublishedLayoutSummary(activeFloorId);
  const createSite = useCreateSite();
  const createFloor = useCreateFloor(activeSiteId);
  const createDraft = useCreateLayoutDraft(activeFloorId);
  const isBusy = createSite.isPending || createFloor.isPending || createDraft.isPending;

  const handleCreateSite = async () => {
    const createdSiteId = await createSite.mutateAsync({
      code: newSiteCode.trim(),
      name: newSiteName.trim(),
      timezone: newSiteTimezone.trim()
    });
    setActiveSiteId(createdSiteId);
    setNewSiteCode('');
    setNewSiteName('');
  };

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
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[24px] border border-[var(--border-muted)] bg-[var(--surface-primary)] p-8 shadow-[var(--shadow-panel)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{t('warehouse.select.eyebrow')}</div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{t('warehouse.select.title')}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t('warehouse.select.description')}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t('warehouse.selection.current')}</div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div>{t('warehouse.selection.sites', { count: sites.length })}</div>
              <div>{t('warehouse.selection.floors', { count: floors.length })}</div>
              <div>{t('warehouse.selection.activeFloor', { state: activeFloorId ? t('warehouse.state.selected') : t('warehouse.state.missing') })}</div>
              <div>{t('warehouse.selection.draft', { state: hasDraft ? t('warehouse.state.ready') : t('warehouse.state.missing') })}</div>
            </div>
            {!hasDraft && activeFloorId && (
              <button type="button" disabled={createDraft.isPending} onClick={() => void createDraft.mutateAsync(activeFloorId)} className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                {t('warehouse.action.createFirstDraft')}
              </button>
            )}
          </div>

          <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t('warehouse.gate.why.title')}</div>
            <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {t('warehouse.gate.why.description')}
            </div>
          </div>

          <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t('warehouse.gate.workflow.title')}</div>
            <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {t('warehouse.gate.workflow.description')}
            </div>
          </div>

          <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t('warehouse.published.title')}</div>
            {!activeFloorId ? (
              <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t('warehouse.published.selectFloor')}</div>
            ) : publishedLayoutSummary.isLoading ? (
              <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t('warehouse.published.loading')}</div>
            ) : publishedLayoutSummary.data ? (
              <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
                <div>{t('warehouse.published.version', { version: publishedLayoutSummary.data.versionNo })}</div>
                <div>{t('warehouse.published.generatedCells', { count: publishedLayoutSummary.data.cellCount })}</div>
                <div>{t('warehouse.published.publishedAt', { value: formatDateTime(publishedLayoutSummary.data.publishedAt) })}</div>
                <div className="pt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{t('warehouse.published.sampleAddresses')}</div>
                <div className="flex flex-wrap gap-2" dir="ltr">
                  {publishedLayoutSummary.data.sampleAddresses.map((address) => (
                    <span key={address} className="rounded-full border border-[var(--border-muted)] bg-white px-2.5 py-1 font-mono text-xs text-slate-700 shadow-sm">
                      {address}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t('warehouse.published.empty')}</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-[24px] border border-[var(--border-muted)] bg-white p-8 shadow-[var(--shadow-soft)]">
        <div className="grid gap-4 rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
          <div className="text-sm font-medium text-slate-900">{t('warehouse.action.createSite')}</div>
          <div className="grid gap-3">
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.siteCode')} value={newSiteCode} onChange={(event) => setNewSiteCode(event.target.value)} dir="ltr" />
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.siteName')} value={newSiteName} onChange={(event) => setNewSiteName(event.target.value)} dir="auto" />
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.timezone')} value={newSiteTimezone} onChange={(event) => setNewSiteTimezone(event.target.value)} dir="ltr" />
            <button type="button" disabled={isBusy || !newSiteCode.trim() || !newSiteName.trim() || !newSiteTimezone.trim()} onClick={() => void handleCreateSite()} className="rounded-xl border border-[var(--border-muted)] bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              {t('warehouse.action.createSite')}
            </button>
          </div>
        </div>

        <div className="grid gap-4 rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
          <div className="text-sm font-medium text-slate-900">{t('warehouse.action.createFloor')}</div>
          <div className="grid gap-3">
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.floorCode')} value={newFloorCode} onChange={(event) => setNewFloorCode(event.target.value)} dir="ltr" />
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder={t('warehouse.placeholder.floorName')} value={newFloorName} onChange={(event) => setNewFloorName(event.target.value)} dir="auto" />
            <button type="button" disabled={isBusy || !activeSiteId || !newFloorCode.trim() || !newFloorName.trim()} onClick={() => void handleCreateFloor()} className="rounded-xl border border-[var(--border-muted)] bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              {t('warehouse.action.createFloorInActiveSite')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
