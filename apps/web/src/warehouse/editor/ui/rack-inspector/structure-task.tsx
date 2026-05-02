import { resolveRackFaceRelationshipMode } from '@wos/domain';
import type { Rack, RackFace } from '@wos/domain';
import { useState, type ReactNode } from 'react';
import { FaceTab } from '@/features/rack-configure/ui/face-tab';
import { FrontElevationPreview } from '@/features/rack-configure/ui/front-elevation-preview';
import { SectionPresetForm } from '@/features/rack-configure/ui/section-preset-form';
import {
  useApplyFacePreset,
  useResetFaceB,
  useSetFaceBRelationship
} from '@/warehouse/editor/model/editor-selectors';
import { LevelDefaultsPanel } from './level-defaults-panel';
import { RackLevelDefaultsPanel } from './rack-level-defaults-panel';
import { FaceModeIsometric, type TopologyChoice } from './face-mode-isometric';
import { PolicyLegendVisual } from './policy-legend-visual';

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function StructureSection({
  title,
  testId,
  children
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="flex flex-col gap-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {title}
      </div>
      {children}
    </section>
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
    <div className="flex flex-col gap-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
        Face {face.side}
      </div>

      <section
        data-testid="structure-face-manual-sections"
        className="flex flex-col gap-3 rounded-[14px] border border-[var(--border-muted)] bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Manual sections</h4>
          <p className="text-xs text-slate-500">
            Current persisted structure for this face. Use this table for ongoing section edits.
          </p>
        </div>
        {face.sections.length > 0 && (
          <div data-testid="structure-face-manual-preview">
            <FrontElevationPreview face={face} side={face.side} />
          </div>
        )}
        <FaceTab title={`Face ${face.side}`} rackId={rack.id} face={face} readOnly={readOnly} />
      </section>

      <section
        data-testid="structure-face-generate-structure"
        className="flex flex-col gap-2 rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4"
      >
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Generate structure</h4>
          <p className="text-xs text-slate-500">
            Creates or replaces structure for this face using preset values.
          </p>
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
      </section>
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
  const resetFaceB = useResetFaceB();
  const setFaceBRelationship = useSetFaceBRelationship();

  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : null;
  const isMirrored = !!faceB && faceBRelationshipMode === 'mirrored';
  const faceBConfigured = !!faceB && (isMirrored || faceB.sections.length > 0);
  const showFaceTabs = faceBConfigured && !isMirrored;

  const effectiveActiveFace = showFaceTabs ? activeFaceSide : 'A';
  const activeFaceData = effectiveActiveFace === 'A' ? faceA : faceB;
  const policyFace = showFaceTabs ? activeFaceData : faceA;

  const handleTopologySelect = (topology: TopologyChoice) => {
    if (topology === 'single') {
      resetFaceB(rack.id);
      return;
    }

    if (topology === 'mirrored') {
      setFaceBRelationship(rack.id, 'mirrored');
      return;
    }

    if (!faceBConfigured) {
      setFaceBRelationship(rack.id, 'independent', { initFrom: 'scratch' });
      return;
    }

    if (isMirrored) {
      setFaceBRelationship(rack.id, 'independent', { initFrom: 'scratch' });
    }
  };

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <StructureSection title="Topology" testId="structure-section-topology">
        <FaceModeIsometric
          rack={rack}
          faceB={faceB}
          readOnly={readOnly}
          onSelectTopology={handleTopologySelect}
        />
      </StructureSection>

      <StructureSection title="Face Structure" testId="structure-section-face-structure">
        {showFaceTabs && (
          <div
            data-testid="structure-face-switcher"
            className="flex gap-1 rounded-xl border border-[var(--border-muted)] bg-white p-1 shadow-sm"
          >
            {(['A', 'B'] as const).map((side) => (
              <button
                key={side}
                type="button"
                data-testid={`structure-face-switch-${side}`}
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
      </StructureSection>

      <StructureSection title="Policies" testId="structure-section-policies">
        <div data-testid="structure-policies-face-defaults">
          {policyFace && (
            <LevelDefaultsPanel
              rackId={rack.id}
              face={policyFace}
              readOnly={readOnly}
              description={`Editing Face ${policyFace.side} defaults. Applies only to this face at this level.`}
            />
          )}
        </div>

        <div data-testid="structure-policies-rack-apply" className="mt-4">
          <RackLevelDefaultsPanel
            rackId={rack.id}
            faceA={faceA}
            faceB={faceB}
            readOnly={readOnly}
          />
        </div>

        {isMirrored && faceA && (
          <div data-testid="structure-policies-mirrored-face-b" className="flex flex-col gap-3">
            <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Face B mirrors Face A. Face B defaults are inherited and read-only in mirrored mode.
            </div>
            <div className="opacity-60 grayscale-[0.5]">
              <LevelDefaultsPanel
                rackId={rack.id}
                face={faceA}
                readOnly={true}
                heading="Face B inherited defaults"
                description="Inherited from Face A. Edit Face A to change mirrored defaults."
              />
            </div>
          </div>
        )}

        <PolicyLegendVisual />
      </StructureSection>
    </div>
  );
}
