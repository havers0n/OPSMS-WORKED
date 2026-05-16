import { useState } from 'react';
import { useSetActiveFloorId, useSetActiveSiteId } from '@/app/store/ui-selectors';
import { useCreateFloor } from '@/features/floor-create/model/use-create-floor';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useCreateSite } from '@/features/site-create/model/use-create-site';
import { useT } from '@/shared/i18n';

export function BootstrapWizard() {
  const t = useT();
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
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--accent)]">{t('warehouse.bootstrap.eyebrow')}</div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{t('warehouse.bootstrap.title')}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
          {t('warehouse.bootstrap.description')}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ['1', t('warehouse.bootstrap.step1.title'), t('warehouse.bootstrap.step1.description')],
            ['2', t('warehouse.bootstrap.step2.title'), t('warehouse.bootstrap.step2.description')],
            ['3', t('warehouse.bootstrap.step3.title'), t('warehouse.bootstrap.step3.description')]
          ].map(([step, title, text]) => (
            <div key={step} className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t('warehouse.bootstrap.step', { step })}</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{title}</div>
              <div className="mt-2 text-sm text-[var(--text-muted)]">{text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-[24px] border border-[var(--border-muted)] bg-white p-8 shadow-[var(--shadow-soft)]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t('warehouse.bootstrap.form.eyebrow')}</div>
          <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{t('warehouse.bootstrap.form.title')}</div>
        </div>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1 text-sm text-slate-700">{t('warehouse.field.siteCode')}<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={siteCode} onChange={(event) => setSiteCode(event.target.value)} dir="ltr" /></label>
            <label className="grid gap-1 text-sm text-slate-700">{t('warehouse.field.siteName')}<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={siteName} onChange={(event) => setSiteName(event.target.value)} dir="auto" /></label>
          </div>
          <label className="grid gap-1 text-sm text-slate-700">{t('warehouse.field.timezone')}<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={timezone} onChange={(event) => setTimezone(event.target.value)} dir="ltr" /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1 text-sm text-slate-700">{t('warehouse.field.floorCode')}<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={floorCode} onChange={(event) => setFloorCode(event.target.value)} dir="ltr" /></label>
            <label className="grid gap-1 text-sm text-slate-700">{t('warehouse.field.floorName')}<input className="rounded-xl border border-[var(--border-muted)] px-3 py-2.5 shadow-sm" value={floorName} onChange={(event) => setFloorName(event.target.value)} dir="auto" /></label>
          </div>
        </div>
        <button type="button" disabled={isBusy} onClick={() => void handleBootstrap()} className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{t('warehouse.action.createSiteFloorDraft')}</button>
      </section>
    </div>
  );
}
