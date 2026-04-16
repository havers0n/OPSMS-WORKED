import { resolveRackFaceRelationshipMode } from '@wos/domain';
import type { Rack, RackFace } from '@wos/domain';
import { FaceTab } from '@/features/rack-configure/ui/face-tab';
import { FrontElevationPreview } from '@/features/rack-configure/ui/front-elevation-preview';
import { SectionPresetForm } from '@/features/rack-configure/ui/section-preset-form';
import { useApplyFacePreset } from '@/widgets/warehouse-editor/model/editor-selectors';
import { StructureIdentityPanel } from './structure-identity-panel';

function FaceStructureBlock({
  rack,
  face,
  readOnly
}: {
  rack: Rack;
  face: RackFace;
  readOnly: boolean;
}) {
  const applyFacePreset = useApplyFacePreset();

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
        Face {face.side}
      </div>
      <SectionPresetForm
        rackId={rack.id}
        side={face.side}
        totalLength={face.faceLength ?? rack.totalLength}
        existingSectionCount={face.sections.length}
        initialSectionCount={face.sections.length || 3}
        initialLevelCount={face.sections[0]?.levels.length || 4}
        initialSlotCount={face.sections[0]?.levels[0]?.slotCount || 3}
        readOnly={readOnly}
        onApply={applyFacePreset}
      />
      {face.sections.length > 0 && <FrontElevationPreview face={face} side={face.side} />}
      <FaceTab title={`Face ${face.side}`} rackId={rack.id} face={face} readOnly={readOnly} />
    </div>
  );
}

export function StructureTask({
  rack,
  faceA,
  faceB,
  readOnly
}: {
  rack: Rack;
  faceA: RackFace | null;
  faceB: RackFace | null;
  readOnly: boolean;
}) {
  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : 'independent';
  const isMirrored = !!faceB && faceBRelationshipMode === 'mirrored';
  const faceBConfigured = !!faceB && (isMirrored || faceB.sections.length > 0);

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <StructureIdentityPanel rack={rack} readOnly={readOnly} />

      {faceA && <FaceStructureBlock rack={rack} face={faceA} readOnly={readOnly} />}

      {isMirrored && (
        <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Face B mirrors Face A. To edit Face B structure independently, switch to the Face Mode task.
        </div>
      )}

      {!isMirrored && faceBConfigured && faceB && (
        <FaceStructureBlock rack={rack} face={faceB} readOnly={readOnly} />
      )}

      {!faceBConfigured && !isMirrored && (
        <div className="rounded-[14px] border border-dashed border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-4 text-center text-sm text-slate-500">
          Face B is not configured. Use the Face Mode task to add a second face.
        </div>
      )}
    </div>
  );
}
