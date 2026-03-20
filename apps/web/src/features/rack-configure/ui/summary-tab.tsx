import type { LayoutValidationResult, Rack, RackFace } from '@wos/domain';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

function faceSummary(face: RackFace) {
  const totalLength = face.sections.reduce((sum, s) => sum + s.length, 0);
  const totalCells = face.sections.reduce((sum, s) => sum + s.levels.reduce((l, lv) => l + lv.slotCount, 0), 0);
  return { totalLength, totalCells, sectionCount: face.sections.length };
}

function FaceBlock({ face, label }: { face: RackFace; label: string }) {
  const { totalLength, totalCells, sectionCount } = faceSummary(face);
  if (!face.enabled && face.sections.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</div>
        <div className="mt-2 text-sm text-slate-400">Not configured</div>
      </div>
    );
  }
  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Sections</div>
          <div className="mt-0.5 font-medium text-slate-800">{sectionCount}</div>
        </div>
        <div>
          <div className="text-slate-500">Length</div>
          <div className="mt-0.5 font-medium text-slate-800">{totalLength.toFixed(1)} m</div>
        </div>
        <div>
          <div className="text-slate-500">Est. cells</div>
          <div className="mt-0.5 font-mono font-medium text-slate-800">{totalCells}</div>
        </div>
      </div>
      <div className="mt-2 flex gap-3 text-xs text-slate-500">
        <span>Numbering: <span className="font-medium text-slate-700">{face.slotNumberingDirection === 'rtl' ? 'N→①' : '①→N'}</span></span>
        {face.isMirrored && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 text-[10px] font-medium">Mirrored</span>}
      </div>
    </div>
  );
}

function AsymmetryBlock({ faceA, faceB }: { faceA: RackFace; faceB: RackFace }) {
  const a = faceSummary(faceA);
  const b = faceSummary(faceB);
  const diffs: string[] = [];
  if (a.sectionCount !== b.sectionCount) diffs.push(`Section count differs (A: ${a.sectionCount}, B: ${b.sectionCount})`);
  if (Math.abs(a.totalLength - b.totalLength) > 0.01) diffs.push(`Length differs (A: ${a.totalLength.toFixed(1)} m, B: ${b.totalLength.toFixed(1)} m)`);
  if (faceA.slotNumberingDirection !== faceB.slotNumberingDirection) diffs.push(`Slot numbering differs (A: ${faceA.slotNumberingDirection.toUpperCase()}, B: ${faceB.slotNumberingDirection.toUpperCase()})`);

  if (diffs.length === 0) return null;

  return (
    <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
        <AlertTriangle className="h-3 w-3" />
        Asymmetry Detected
      </div>
      <ul className="grid gap-1">
        {diffs.map((d) => (
          <li key={d} className="text-xs text-amber-800">· {d}</li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryTab({
  rack,
  previewAddresses,
  validationResult,
  validationSource,
  generatedCellCount
}: {
  rack: Rack;
  previewAddresses: string[];
  validationResult: LayoutValidationResult;
  validationSource: 'preview' | 'server';
  generatedCellCount: number;
}) {
  const faceA = rack.faces.find((f) => f.side === 'A');
  const faceB = rack.faces.find((f) => f.side === 'B');
  const totalSections = rack.faces.reduce((sum, f) => sum + f.sections.length, 0);
  const errors = validationResult.issues.filter((i) => i.severity === 'error');
  const warnings = validationResult.issues.filter((i) => i.severity === 'warning');

  return (
    <section className="grid gap-4">
      {/* General */}
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">General</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-slate-500">Display Code</span><span className="font-mono font-medium text-slate-800">{rack.displayCode}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Kind</span><span className="font-medium capitalize text-slate-800">{rack.kind}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Axis</span><span className="font-mono font-medium text-slate-800">{rack.axis}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Rotation</span><span className="font-medium text-slate-800">{rack.rotationDeg}°</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Length</span><span className="font-medium text-slate-800">{rack.totalLength.toFixed(1)} m</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Depth</span><span className="font-medium text-slate-800">{rack.depth.toFixed(1)} m</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Position X</span><span className="font-mono font-medium text-slate-800">{Math.round(rack.x)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Position Y</span><span className="font-mono font-medium text-slate-800">{Math.round(rack.y)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Sections</span><span className="font-medium text-slate-800">{totalSections}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Generated Cells</span><span className="font-mono font-medium text-slate-800">{generatedCellCount}</span></div>
        </div>
      </div>

      {/* Face summaries */}
      <div className="grid gap-2">
        {faceA && <FaceBlock face={faceA} label="Face A" />}
        {faceB && <FaceBlock face={faceB} label="Face B" />}
        {faceA && faceB && faceB.enabled && faceB.sections.length > 0 && (
          <AsymmetryBlock faceA={faceA} faceB={faceB} />
        )}
      </div>

      {/* Address preview */}
      {previewAddresses.length > 0 && (
        <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Address Preview</div>
          <ul className="grid gap-1.5 text-sm">
            {previewAddresses.map((address) => (
              <li key={address} className="rounded-xl bg-[var(--surface-secondary)] px-3 py-2 font-mono text-xs text-slate-700">{address}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation */}
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Validation</div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {validationSource === 'server' ? 'Server' : 'Preview'}
          </span>
        </div>
        <div className="mb-3 flex items-center justify-between">
          {validationResult.isValid ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Valid
            </span>
          ) : errors.length > 0 ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-700">
              <XCircle className="h-3.5 w-3.5" /> {errors.length} error{errors.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> {warnings.length} warning{warnings.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {validationResult.issues.length === 0 ? (
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">No validation issues.</div>
        ) : (
          <div className="grid gap-2">
            {errors.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600">Errors</div>
                <ul className="grid gap-1.5">
                  {errors.map((issue) => (
                    <li key={`${issue.code}-${issue.entityId ?? 'global'}`} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600">Warnings</div>
                <ul className="grid gap-1.5">
                  {warnings.map((issue) => (
                    <li key={`${issue.code}-${issue.entityId ?? 'global'}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
