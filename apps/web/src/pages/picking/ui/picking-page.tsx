import { Link } from 'react-router-dom';
import { routes } from '@/shared/config/routes';
import { useT } from '@/shared/i18n';

export function PickingPage() {
  const t = useT();

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t('app.navigation.picking')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('app.navigation.picking.description')}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to={routes.operations}
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('app.navigation.operations')}
          </Link>
          <Link
            to={routes.pickingPlan}
            className="inline-flex items-center rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            {t('app.navigation.pickingPlan')}
          </Link>
        </div>
      </div>
    </div>
  );
}
