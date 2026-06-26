"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { inputClass } from "@/components/ui";

export function ImageManager({ existingImages }: { existingImages: string[] }) {
  const [kept, setKept] = useState(existingImages);

  return (
    <div className="grid gap-3">
      {kept.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {kept.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="配图"
                className="h-20 w-20 rounded-md border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => setKept((prev) => prev.filter((u) => u !== url))}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-bg hover:opacity-90"
                aria-label="移除图片"
              >
                <X className="size-3" />
              </button>
              <input type="hidden" name="keepImage" value={url} />
            </div>
          ))}
        </div>
      )}
      <input
        name="images"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className={inputClass}
      />
      <p className="text-xs text-text-secondary">
        点击 × 移除现有图片；可再上传新图片（最多共 9 张 jpg/png/webp）
      </p>
    </div>
  );
}
