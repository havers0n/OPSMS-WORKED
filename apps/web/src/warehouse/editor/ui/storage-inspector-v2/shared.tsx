import type { ReactNode } from 'react';
import type { ContainerType } from '@wos/domain';

export const inspectorShellClassName =
  'flex h-full w-[18.75rem] min-w-0 flex-col overflow-hidden border-l border-gray-200 bg-white';

export const inspectorScrollBodyClassName = 'flex-1 overflow-y-auto';

export const inspectorHeaderClassName = 'border-b border-gray-200 px-4 py-2.5';

export const inspectorBodyPaddingClassName = 'px-4 py-3';

export const inspectorFooterActionsClassName =
  'border-t border-gray-200 bg-white px-4 py-2.5 flex-shrink-0';

export const inspectorSectionClassName = 'border-b border-gray-200 px-4 py-3';

export const inspectorMutedSectionClassName = 'border-b border-gray-200 px-4 py-2.5 bg-gray-50/50';

export const inspectorSectionTitleClassName =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500';

export const inspectorKvGridClassName = 'mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs';

export const inspectorRowCardClassName =
  'flex items-center justify-between gap-3 rounded-sm bg-gray-50 px-2.5 py-2 text-left';

export const compactGroupClassName = 'space-y-2';

export function CompactGroup({
  title,
  children,
  tone = 'default'
}: {
  title?: string;
  children: ReactNode;
  tone?: 'default' | 'muted';
}) {
  return (
    <section
      className={[
        'rounded-lg border px-3 py-2.5',
        tone === 'muted' ? 'border-gray-200 bg-gray-50/80' : 'border-gray-200 bg-white'
      ].join(' ')}
    >
      {title ? (
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          {title}
        </div>
      ) : null}
      <div className={compactGroupClassName}>{children}</div>
    </section>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</div>;
}

export function StatusBadge({ occupied }: { occupied: boolean }) {
  if (occupied) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
        Occupied
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
      Empty
    </span>
  );
}

export function InspectorFooter() {
  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
      <p>
        <span className="font-medium">PR3:</span> Create container / Create container with product.{' '}
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
    <div className="flex flex-wrap items-center gap-1 text-xs leading-relaxed text-gray-500">
      <span>{rackDisplayCode}</span>
      <span className="text-gray-300">/</span>
      <span>Level {activeLevel}</span>
      <span className="text-gray-300">/</span>
      <span className="font-mono font-medium text-gray-900">{locationCode}</span>
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
        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        aria-label="Container type"
      >
        <option value="">Select type...</option>
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
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-gray-500">{pct}%</span>
    </div>
  );
}
