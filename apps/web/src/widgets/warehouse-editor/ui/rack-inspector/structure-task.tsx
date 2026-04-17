import { resolveRackFaceRelationshipMode } from '@wos/domain';
import type { Rack, RackFace } from '@wos/domain';
import { useState } from 'react';
import { FaceTab } from '@/features/rack-configure/ui/face-tab';
import { FrontElevationPreview } from '@/features/rack-configure/ui/front-elevation-preview';
import { SectionPresetForm } from '@/features/rack-configure/ui/section-preset-form';
import {
  useApplyFacePreset,
  useResetFaceB,
  useSetFaceBRelationship
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { StructureIdentityPanel } from './structure-identity-panel';
import { LevelDefaultsPanel } from './level-defaults-panel';
import { RackLevelDefaultsPanel } from './rack-level-defaults-panel';
import { FaceModeIsometric } from './face-mode-isometric';
import { PolicyLegendVisual } from './policy-legend-visual';

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function FaceBControl({
  rack,
  faceB,
  readOnly
}: {
  rack: Rack;
  faceB: RackFace | null;
  readOnly: boolean;
}) {
  const setFaceBRelationship = useSetFaceBRelationship();
  const resetFaceB = useResetFaceB();

  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : null;
  const isMirrored = !!faceB && faceBRelationshipMode === 'mirrored';
  const faceBConfigured = !!faceB && (isMirrored || faceB.sections.length > 0);

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Face B
        </div>
        {faceBConfigured && !readOnly && (
          <button
            type="button"
            onClick={() => resetFaceB(rack.id)}
            className="text-[11px] text-red-400 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>
      <div className="flex gap-1 rounded-xl border border-[var(--border-muted)] bg-white p-1">
        {!faceBConfigured && (
          <button
            type="button"
            disabled
            className="flex-1 rounded-lg px-3 py-2 text-xs font-medium bg-slate-900 text-white shadow-sm"
          >
            Off
          </button>
        )}
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setFaceBRelationship(rack.id, 'mirrored')}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed',
            faceBConfigured && isMirrored
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 disabled:text-slate-400'
          )}
        >
          Mirror A
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            if (!faceBConfigured) {
              setFaceBRelationship(rack.id, 'independent', { initFrom: 'scratch' });
            } else if (isMirrored) {
              setFaceBRelationship(rack.id, 'independent', { initFrom: 'copy' });
            }
          }}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed',
            faceBConfigured && !isMirrored
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 disabled:text-slate-400'
          )}
        >
          Independent
        </button>
      </div>
    </div>
  );
}

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
      {face.sections.length > 0 && (
        <LevelDefaultsPanel rackId={rack.id} face={face} readOnly={readOnly} />
      )}
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
  const [activeFaceSide, setActiveFaceSide] = useState<'A' | 'B'>('A');

  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : null;
  const isMirrored = !!faceB && faceBRelationshipMode === 'mirrored';
  const faceBConfigured = !!faceB && (isMirrored || faceB.sections.length > 0);
  const showFaceTabs = faceBConfigured && !isMirrored;

  const effectiveActiveFace = showFaceTabs ? activeFaceSide : 'A';
  const activeFaceData = effectiveActiveFace === 'A' ? faceA : faceB;

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <StructureIdentityPanel rack={rack} readOnly={readOnly} />
      <FaceModeIsometric rack={rack} faceB={faceB} />
      <FaceBControl rack={rack} faceB={faceB} readOnly={readOnly} />

      {showFaceTabs && (
        <div className="flex gap-1 rounded-xl border border-[var(--border-muted)] bg-white p-1 shadow-sm">
          {(['A', 'B'] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setActiveFaceSide(side)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                effectiveActiveFace === side
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Face {side}
            </button>
          ))}
        </div>
      )}

      {showFaceTabs && activeFaceData && (
        <FaceStructureBlock rack={rack} face={activeFaceData} readOnly={readOnly} />
      )}

      {!showFaceTabs && faceA && (
        <FaceStructureBlock rack={rack} face={faceA} readOnly={readOnly} />
      )}

      {isMirrored && faceA && (
        <div className="flex flex-col gap-3">
          <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Face B mirrors Face A. Switch to Independent above to edit separately.
          </div>
          <div className="opacity-60 grayscale-[0.5]">
            <LevelDefaultsPanel
              rackId={rack.id}
              face={faceA}
              readOnly={true}
              heading="Face B Overrides (Advanced)"
              description="Face B is mirrored, so overrides are inherited from Face A."
            />
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Policies
        </div>
        <PolicyLegendVisual />
        <div className="mt-4">
          <RackLevelDefaultsPanel
            rackId={rack.id}
            faceA={faceA}
            faceB={faceB}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
