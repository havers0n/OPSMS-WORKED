import { FilePlus2, Lock } from 'lucide-react';

type PublishedBannerProps = {
  onCreateDraft: () => void;
  isCreating: boolean;
};

export function PublishedBanner({ onCreateDraft, isCreating }: PublishedBannerProps) {
  return (
    <div
      role="note"
      className="flex h-10 shrink-0 items-center justify-between border-b px-4"
      style={{
        background: 'rgba(37,99,235,0.08)',
        borderColor: 'rgba(37,99,235,0.2)'
      }}
    >
      <div className="flex items-center gap-2" style={{ color: '#1d4ed8' }}>
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-medium">Structure locked</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: 'rgba(37,99,235,0.15)', color: '#1d4ed8' }}
        >
          Placement available
        </span>
      </div>

      <button
        type="button"
        disabled={isCreating}
        onClick={onCreateDraft}
        className="flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        <FilePlus2 className="h-3.5 w-3.5" />
        {isCreating ? 'Creating…' : 'Create Draft'}
      </button>
    </div>
  );
}
