import { Tag } from 'lucide-react';

/**
 * Semantics mode — placeholder panel.
 *
 * Semantics assigns logical roles, zone membership, and constraints to the
 * already-established spatial structure. It does not edit geometry.
 *
 * This panel is a truthful scaffold. No semantic domain model exists yet.
 * Replace with SemanticAnnotationInspector once zones/roles are modelled.
 */
export function SemanticsModePanel() {
  return (
    <aside
      className="flex h-full w-full flex-col"
      style={{ background: 'var(--surface-primary)' }}
    >
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Semantics
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Tag className="h-8 w-8 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">Semantic Annotation</p>
          <p className="mt-1 text-xs text-slate-400">
            Assign roles, zones, and logical constraints to racks and cells.
          </p>
          <p className="mt-3 text-[11px] text-slate-300">
            Select a rack to annotate it.
            <br />
            Semantic roles are not yet available.
          </p>
        </div>
      </div>
    </aside>
  );
}
