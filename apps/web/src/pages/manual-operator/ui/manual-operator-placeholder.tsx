interface ManualOperatorPlaceholderProps {
  title: string;
  description: string;
  testId: string;
}

export function ManualOperatorPlaceholder({
  title,
  description,
  testId
}: ManualOperatorPlaceholderProps) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      data-testid={testId}
      dir="rtl"
    >
      <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500">
        {title}
      </div>
      <p className="max-w-md text-sm leading-6 text-gray-500">{description}</p>
    </div>
  );
}
