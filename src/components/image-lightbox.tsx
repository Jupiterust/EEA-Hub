"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { secondaryButtonClass } from "@/components/ui";

export function ImageLightbox({
  images,
}: {
  images: { url: string; alt: string }[];
}) {
  const [active, setActive] = useState<number | null>(null);
  if (images.length === 0) {
    return null;
  }

  const current = active === null ? null : images[active];

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <button
            key={`${image.url}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            className="aspect-video overflow-hidden rounded-md border border-border bg-elevated"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.alt} className="h-full w-full object-cover transition hover:scale-105" />
          </button>
        ))}
      </div>
      {current ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-bg/90 p-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 rounded-md border border-border bg-surface p-2 text-text-primary hover:bg-elevated"
            aria-label="关闭大图"
          >
            <X className="size-5" />
          </button>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setActive((active + images.length - 1) % images.length)}
                className={`${secondaryButtonClass} absolute left-4 top-1/2 -translate-y-1/2 px-3`}
                aria-label="上一张"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setActive((active + 1) % images.length)}
                className={`${secondaryButtonClass} absolute right-4 top-1/2 -translate-y-1/2 px-3`}
                aria-label="下一张"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={current.alt} className="max-h-[86vh] max-w-[92vw] rounded-lg border border-border object-contain" />
        </div>
      ) : null}
    </>
  );
}
