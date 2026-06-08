interface StorageDebugPlaceholderProps {
  title: string;
  body: string;
  testId: string;
}

export function StorageDebugPlaceholder({
  title,
  body,
  testId
}: StorageDebugPlaceholderProps) {
  return (
    <div
      data-testid={testId}
      className="flex h-full min-h-0 flex-1 items-center justify-center p-6"
    >
      <div
        className="max-w-md rounded-lg border px-4 py-3 text-sm"
        style={{
          background: 'var(--surface-primary)',
          borderColor: 'var(--border-muted)',
          color: 'var(--text-muted)'
        }}
      >
        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div className="mt-1">{body}</div>
      </div>
    </div>
  );
}
