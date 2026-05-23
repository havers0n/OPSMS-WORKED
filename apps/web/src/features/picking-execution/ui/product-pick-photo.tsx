export function ProductPickPhoto({
  productImageUrl,
  productName
}: {
  productImageUrl?: string | null;
  productName: string;
}) {
  if (productImageUrl) {
    return (
      <img
        src={productImageUrl}
        alt={productName}
        className="h-20 w-20 rounded-md border border-slate-200 object-cover"
        data-testid="picking-step-product-image"
      />
    );
  }

  return (
    <div
      className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
      data-testid="picking-step-product-placeholder"
    >
      No image
    </div>
  );
}
