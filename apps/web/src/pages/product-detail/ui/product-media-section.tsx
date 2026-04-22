import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type ProductMediaSectionProps = {
  productName: string;
  displayImages: string[];
  activeImageIndex: number;
  selectedImageUrl: string | null;
  lightboxOpen: boolean;
  onImageLoadError: (source: string) => void;
  onSelectImage: (index: number) => void;
  onOpenLightbox: () => void;
  onCloseLightbox: () => void;
  onGoToPreviousImage: () => void;
  onGoToNextImage: () => void;
};

export function ProductMediaSection({
  productName,
  displayImages,
  activeImageIndex,
  selectedImageUrl,
  lightboxOpen,
  onImageLoadError,
  onSelectImage,
  onOpenLightbox,
  onCloseLightbox,
  onGoToPreviousImage,
  onGoToNextImage
}: ProductMediaSectionProps) {
  return (
    <>
      <aside className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Media</p>
          <span className="text-xs text-slate-500">
            {displayImages.length > 0 ? `${activeImageIndex + 1}/${displayImages.length}` : '0 images'}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenLightbox}
          disabled={!selectedImageUrl}
          className={[
            'group relative h-52 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50',
            selectedImageUrl
              ? 'cursor-zoom-in hover:border-cyan-300 focus-visible:border-cyan-400'
              : 'cursor-default'
          ].join(' ')}
        >
          {selectedImageUrl ? (
            <img
              src={selectedImageUrl}
              alt={`${productName} image ${activeImageIndex + 1}`}
              className="h-full w-full object-contain p-2"
              onError={() => onImageLoadError(selectedImageUrl)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-slate-500">
              No displayable product image
            </div>
          )}
          {selectedImageUrl ? (
            <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white">
              Open
            </span>
          ) : null}
        </button>

        {displayImages.length > 1 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {displayImages.map((source, index) => (
              <button
                key={source}
                type="button"
                onClick={() => onSelectImage(index)}
                className={[
                  'h-14 w-14 shrink-0 overflow-hidden rounded border bg-white p-1',
                  index === activeImageIndex
                    ? 'border-cyan-500 ring-1 ring-cyan-300'
                    : 'border-slate-200 hover:border-slate-300'
                ].join(' ')}
                aria-label={`Select image ${index + 1}`}
              >
                <img
                  src={source}
                  alt={`${productName} thumbnail ${index + 1}`}
                  className="h-full w-full object-contain"
                  onError={() => onImageLoadError(source)}
                />
              </button>
            ))}
          </div>
        ) : null}
      </aside>

      {lightboxOpen && selectedImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={onCloseLightbox}
          role="presentation"
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border border-slate-700 bg-slate-900 p-3"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Product image viewer"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
              <span>
                Image {activeImageIndex + 1} of {displayImages.length}
              </span>
              <button
                type="button"
                onClick={onCloseLightbox}
                className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>

            <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded border border-slate-700 bg-slate-950">
              <img
                src={selectedImageUrl}
                alt={`${productName} image ${activeImageIndex + 1}`}
                className="max-h-[76vh] w-full object-contain"
                onError={() => onImageLoadError(selectedImageUrl)}
              />

              {displayImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={onGoToPreviousImage}
                    className="absolute left-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-500 bg-slate-900/70 text-white hover:bg-slate-800"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={onGoToNextImage}
                    className="absolute right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-500 bg-slate-900/70 text-white hover:bg-slate-800"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
