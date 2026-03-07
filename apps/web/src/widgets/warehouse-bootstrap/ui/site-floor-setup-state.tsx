import { useState } from 'react';
import { useActiveFloorId, useActiveSiteId, useSetActiveFloorId, useSetActiveSiteId } from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useSites } from '@/entities/site/api/use-sites';
import { useCreateFloor } from '@/features/floor-create/model/use-create-floor';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useCreateSite } from '@/features/site-create/model/use-create-site';

export function SiteFloorSetupState({ hasDraft }: { hasDraft: boolean }) {
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
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Select or Create Site and Floor</div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">Use a live site and floor context before entering the editor.</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Use the top bar to switch existing site and floor context. Create missing records here, then create a draft explicitly for the selected floor.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Current Selection</div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div>Sites: {sites.length}</div>
              <div>Floors in selected site: {floors.length}</div>
              <div>Active floor: {activeFloorId ? 'selected' : 'missing'}</div>
              <div>Draft: {hasDraft ? 'ready' : 'missing'}</div>
            </div>
            {!hasDraft && activeFloorId && (
              <button type="button" disabled={createDraft.isPending} onClick={() => void createDraft.mutateAsync(activeFloorId)} className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                Create First Draft for Selected Floor
              </button>
            )}
          </div>

          <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Why this gate exists</div>
            <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              The editor only opens against a real floor-scoped draft. This keeps layout truth explicit and prevents phantom canvas state outside the draft lifecycle.
            </div>
          </div>

          <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Workflow</div>
            <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Pick or create site and floor, then create the draft intentionally. Save, validate, and publish stay in the top bar once the editor opens.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-[24px] border border-[var(--border-muted)] bg-white p-8 shadow-[var(--shadow-soft)]">
        <div className="grid gap-4 rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
          <div className="text-sm font-medium text-slate-900">Create Site</div>
          <div className="grid gap-3">
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder="Site code" value={newSiteCode} onChange={(event) => setNewSiteCode(event.target.value)} />
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder="Site name" value={newSiteName} onChange={(event) => setNewSiteName(event.target.value)} />
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder="Timezone" value={newSiteTimezone} onChange={(event) => setNewSiteTimezone(event.target.value)} />
            <button type="button" disabled={isBusy || !newSiteCode.trim() || !newSiteName.trim() || !newSiteTimezone.trim()} onClick={() => void handleCreateSite()} className="rounded-xl border border-[var(--border-muted)] bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              Create Site
            </button>
          </div>
        </div>

        <div className="grid gap-4 rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
          <div className="text-sm font-medium text-slate-900">Create Floor</div>
          <div className="grid gap-3">
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder="Floor code" value={newFloorCode} onChange={(event) => setNewFloorCode(event.target.value)} />
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm" placeholder="Floor name" value={newFloorName} onChange={(event) => setNewFloorName(event.target.value)} />
            <button type="button" disabled={isBusy || !activeSiteId || !newFloorCode.trim() || !newFloorName.trim()} onClick={() => void handleCreateFloor()} className="rounded-xl border border-[var(--border-muted)] bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              Create Floor in Active Site
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
