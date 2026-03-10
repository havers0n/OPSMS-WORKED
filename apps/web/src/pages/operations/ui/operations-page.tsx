import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  PackagePlus,
  PlusCircle,
  Truck,
  UserRound
} from 'lucide-react';

type LineStatus = 'ok' | 'risk' | 'critical';

type LineCard = {
  id: string;
  mode: string;
  status: LineStatus;
  load: number;
  ordersInProgress: number;
  oldestOrder: string;
  throughputPerHour: number;
  activePickers: number;
};

type Event = {
  sku: string;
  orderId: string;
  picker: string;
  timestamp: string;
  line: string;
};

const lines: LineCard[] = [
  {
    id: 'Line 1',
    mode: 'Express',
    status: 'critical',
    load: 91,
    ordersInProgress: 78,
    oldestOrder: '1ч 18м',
    throughputPerHour: 320,
    activePickers: 11
  },
  {
    id: 'Line 2',
    mode: 'Bulk',
    status: 'ok',
    load: 44,
    ordersInProgress: 24,
    oldestOrder: '24м',
    throughputPerHour: 170,
    activePickers: 6
  },
  {
    id: 'Line 3',
    mode: 'Fragile',
    status: 'risk',
    load: 76,
    ordersInProgress: 46,
    oldestOrder: '47м',
    throughputPerHour: 210,
    activePickers: 8
  }
];

const pickingEvents: Event[] = [
  { sku: 'SKU-184-XL', orderId: 'ORD-92134', picker: 'И. Петров', timestamp: '14:31:12', line: 'Line 1' },
  { sku: 'SKU-040-RE', orderId: 'ORD-92135', picker: 'А. Соколова', timestamp: '14:30:59', line: 'Line 3' },
  { sku: 'SKU-993-BK', orderId: 'ORD-92132', picker: 'С. Иванов', timestamp: '14:30:41', line: 'Line 1' },
  { sku: 'SKU-201-GN', orderId: 'ORD-92128', picker: 'Д. Орлов', timestamp: '14:30:04', line: 'Line 2' }
];

function statusStyle(status: LineStatus) {
  if (status === 'critical') return 'border-rose-400/50 bg-rose-50 text-rose-700';
  if (status === 'risk') return 'border-amber-400/50 bg-amber-50 text-amber-700';

  return 'border-emerald-400/50 bg-emerald-50 text-emerald-700';
}

function statusLabel(status: LineStatus) {
  if (status === 'critical') return 'Critical';
  if (status === 'risk') return 'High risk';

  return 'OK';
}

export function OperationsPage() {
  return (
    <section className="flex h-full flex-col gap-4 overflow-auto rounded-2xl border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Операционный экран</h1>
          <p className="text-sm text-slate-500">
            Управление линиями и заказами в реальном времени: статус выполнения, пикинг и SLA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <PlusCircle className="h-4 w-4" />
            Создать линию
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            <PackagePlus className="h-4 w-4" />
            Создать заказ
          </button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-3 md:grid-cols-3">
          {lines.map((line) => (
            <article key={line.id} className="rounded-2xl border border-slate-200 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{line.id}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{line.mode}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle(line.status)}`}>
                  {statusLabel(line.status)}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" /> Load
                  </span>
                  <span className="font-semibold text-slate-900">{line.load}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: `${line.load}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-600">
                  <p>
                    <span className="block text-slate-400">Заказов в работе</span>
                    <span className="text-sm font-semibold text-slate-900">{line.ordersInProgress}</span>
                  </p>
                  <p>
                    <span className="block text-slate-400">Самый старый</span>
                    <span className="text-sm font-semibold text-slate-900">{line.oldestOrder}</span>
                  </p>
                  <p>
                    <span className="block text-slate-400">Пикинг/ч</span>
                    <span className="text-sm font-semibold text-slate-900">{line.throughputPerHour}</span>
                  </p>
                  <p>
                    <span className="block text-slate-400">Активные пикеры</span>
                    <span className="text-sm font-semibold text-slate-900">{line.activePickers}</span>
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <h2 className="text-sm font-semibold text-slate-900">Что еще должно быть на экране</h2>
          <ul className="space-y-2 text-xs text-slate-700">
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              SLA-алерты и очередь инцидентов по линиям.
            </li>
            <li className="flex gap-2">
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600" />
              Балансировка персонала: кто свободен и кого можно перекинуть между линиями.
            </li>
            <li className="flex gap-2">
              <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
              Статус отгрузки: готово к pack/ship, блокировки по таре и курьерам.
            </li>
            <li className="flex gap-2">
              <Layers3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              Запасы в зоне отбора: low-stock по hot SKU.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              Контроль качества: процент ошибок и возвратов по пикеру/линии.
            </li>
          </ul>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Статистика пикинга по SKU</h2>
          <span className="text-xs text-slate-500">Live log</span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Время</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Заказ</th>
                <th className="px-4 py-2">Пикер</th>
                <th className="px-4 py-2">Линия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pickingEvents.map((event) => (
                <tr key={`${event.orderId}-${event.sku}-${event.timestamp}`}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {event.timestamp}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-900">{event.sku}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{event.orderId}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{event.picker}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{event.line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
