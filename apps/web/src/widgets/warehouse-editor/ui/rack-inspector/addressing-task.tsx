import { resolveRackFaceRelationshipMode } from '@wos/domain';
import type { Rack, RackFace } from '@wos/domain';
import { useUpdateFaceConfig } from '@/widgets/warehouse-editor/model/editor-selectors';
import { NumberingPanel } from './numbering-panel';
import { AddressAnatomy } from './address-anatomy';

const MAX_PREVIEW_ADDRESSES = 6;

export function AddressingTask({
  rack,
  faceA,
  faceB,
  rackCells,
  readOnly
}: {
  rack: Rack;
  faceA: RackFace | null;
  faceB: RackFace | null;
  rackCells: Array<{ address: { raw: string } }>;
  readOnly: boolean;
}) {
  const updateFaceConfig = useUpdateFaceConfig();

  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : 'independent';
  const isMirrored = !!faceB && faceBRelationshipMode === 'mirrored';
  const faceBConfigured = !!faceB && (isMirrored || faceB.sections.length > 0);

  const previewAddresses = rackCells.slice(0, MAX_PREVIEW_ADDRESSES).map((cell) => cell.address.raw);
  const hiddenAddressCount = Math.max(0, rackCells.length - previewAddresses.length);

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <AddressAnatomy faceA={faceA} faceB={faceB} />

      <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 text-sm text-slate-600 shadow-sm">
        Numbering controls live here. Addresses shown below are a <strong>preview</strong> derived
        from the current draft — they are not a committed address record.
      </div>

      {faceA && (
        <NumberingPanel
          rackId={rack.id}
          side="A"
          slotNumberingDirection={faceA.slotNumberingDirection}
          disabled={readOnly}
          onUpdate={updateFaceConfig}
        />
      )}

      {faceB && !isMirrored && faceBConfigured && (
        <NumberingPanel
          rackId={rack.id}
          side="B"
          slotNumberingDirection={faceB.slotNumberingDirection}
          disabled={readOnly}
          onUpdate={updateFaceConfig}
        />
      )}

      {isMirrored && (
        <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          Face B mirrors Face A and uses reversed numbering automatically.
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Preview Addresses
        </div>
        {previewAddresses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-muted)] px-4 py-4 text-center text-sm text-slate-400">
            Configure sections to preview generated addresses.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {previewAddresses.map((addr) => (
              <div
                key={addr}
                className="rounded-xl bg-[var(--surface-secondary)] px-3 py-2 font-mono text-xs text-slate-700"
              >
                {addr}
              </div>
            ))}
            {hiddenAddressCount > 0 && (
              <div className="text-center text-xs text-slate-400">
                +{hiddenAddressCount} more preview addresses
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
