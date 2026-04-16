import type { ContainerType } from '@wos/domain';

export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

export function StatusBadge({ occupied }: { occupied: boolean }) {
  if (occupied) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-red-50 text-red-700 border-red-200">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-500" />
        Occupied
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-green-50 text-green-700 border-green-200">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
      Empty
    </span>
  );
}

export function InspectorFooter() {
  return (
    <div className="px-4 py-2 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500 bg-gray-50">
      <p>
        <span className="font-medium">PR3:</span> Create container · Create container with product.{' '}
        <span className="font-medium">PR4:</span> Move container.
      </p>
    </div>
  );
}

export function TaskPanelBreadcrumb({
  rackDisplayCode,
  activeLevel,
  locationCode
}: {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
}) {
  return (
    <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
      <span>{rackDisplayCode}</span>
      <span className="text-gray-300">/</span>
      <span>Level {activeLevel}</span>
      <span className="text-gray-300">/</span>
      <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
    </div>
  );
}

export function ContainerTypeSelect({
  containerTypes,
  value,
  onChange,
  disabled
}: {
  containerTypes: ContainerType[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const storableTypes = containerTypes.filter((containerType) => containerType.supportsStorage);

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">
        Container type <span className="text-red-500">*</span>
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || storableTypes.length === 0}
        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        aria-label="Container type"
      >
        <option value="">Select type…</option>
        {storableTypes.map((containerType) => (
          <option key={containerType.id} value={containerType.id}>
            {containerType.description} ({containerType.code})
          </option>
        ))}
      </select>
    </div>
  );
}

export function OccupancyBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}
