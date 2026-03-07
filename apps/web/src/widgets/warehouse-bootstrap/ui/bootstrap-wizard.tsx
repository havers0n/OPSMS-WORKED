import { useState } from 'react';
import { useSetActiveFloorId, useSetActiveSiteId } from '@/app/store/ui-selectors';
import { useCreateFloor } from '@/features/floor-create/model/use-create-floor';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useCreateSite } from '@/features/site-create/model/use-create-site';

export function BootstrapWizard() {
  const [siteCode, setSiteCode] = useState('MAIN');
  const [siteName, setSiteName] = useState('Main Site');
  const [timezone, setTimezone] = useState('Asia/Jerusalem');
  const [floorCode, setFloorCode] = useState('F1');
  const [floorName, setFloorName] = useState('Main Floor');
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const createSite = useCreateSite();
  const createFloor = useCreateFloor(null);
  const createDraft = useCreateLayoutDraft(null);

  const isBusy = createSite.isPending || createFloor.isPending || createDraft.isPending;

  const handleBootstrap = async () => {
    const createdSiteId = await createSite.mutateAsync({ code: siteCode, name: siteName, timezone });
    setActiveSiteId(createdSiteId);
    const createdFloorId = await createFloor.mutateAsync({ siteId: createdSiteId, code: floorCode, name: floorName, sortOrder: 0 });
    setActiveFloorId(createdFloorId);
    await createDraft.mutateAsync(createdFloorId);
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[24px] border border-[var(--border-muted)] bg-[var(--surface-primary)] p-8 shadow-[var(--shadow-panel)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--accent)]">Bootstrap Warehouse Setup</div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">Create the first site, floor, and layout draft before entering the editor.</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
          This flow establishes the first authoritative spatial context inside the application. No data is auto-seeded. The editor opens only after the first draft exists.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ['1', 'Create site', 'Define the warehouse site code, name, and timezone.'],
            ['2', 'Create floor', 'Establish the first operational floor context for layout drafts.'],
            ['3', 'Open first draft', 'Create the first editable layout version explicitly.']
          ].map(([step, title, text]) => (
            <div key={step} className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Step {step}</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{title}</div>
              <div className="mt-2 text-sm text-[var(--text-muted)]">{text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-[24px] border border-[var(--border-muted)] bg-white p-8 shadow-[var(--shadow-soft)]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Bootstrap Form</div>
          <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Create Site, Floor, and First Draft</div>
        </div>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1 text-sm text-slate-700">Site Code<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={siteCode} onChange={(event) => setSiteCode(event.target.value)} /></label>
            <label className="grid gap-1 text-sm text-slate-700">Site Name<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={siteName} onChange={(event) => setSiteName(event.target.value)} /></label>
          </div>
          <label className="grid gap-1 text-sm text-slate-700">Timezone<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1 text-sm text-slate-700">Floor Code<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={floorCode} onChange={(event) => setFloorCode(event.target.value)} /></label>
            <label className="grid gap-1 text-sm text-slate-700">Floor Name<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={floorName} onChange={(event) => setFloorName(event.target.value)} /></label>
          </div>
        </div>
        <button type="button" disabled={isBusy} onClick={() => void handleBootstrap()} className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">Create Site, Floor, and First Draft</button>
      </section>
    </div>
  );
}
