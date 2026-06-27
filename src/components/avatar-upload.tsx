"use client";

import { useRef, useState, useTransition } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Camera } from "lucide-react";
import { uploadAvatarAction } from "@/lib/actions";
import { Avatar } from "@/components/avatar";
import { buttonClass, secondaryButtonClass } from "@/components/ui";

export function AvatarUpload({ currentUrl }: { currentUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isPending, startTransition] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 1, w, h), w, h));
  }

  async function handleConfirm() {
    if (!completedCrop || !imgRef.current || completedCrop.width === 0) return;

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(completedCrop.width * scaleX);
    canvas.height = Math.round(completedCrop.height * scaleY);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    );
    if (!blob) return;

    const formData = new FormData();
    formData.append("avatar", blob, "avatar.webp");

    setImgSrc("");
    setCrop(undefined);
    setCompletedCrop(undefined);

    startTransition(async () => {
      await uploadAvatarAction(formData);
    });
  }

  function handleCancel() {
    setImgSrc("");
    setCrop(undefined);
    setCompletedCrop(undefined);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-block">
        <Avatar url={currentUrl} size="2xl" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="absolute bottom-1 right-1 flex size-8 items-center justify-center rounded-full border border-border bg-elevated text-text-secondary transition hover:bg-surface hover:text-text-primary disabled:opacity-50"
          title="更换头像（jpg/png/webp · 最大 2MB）"
          aria-label="更换头像"
        >
          <Camera className="size-4" />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onFileChange}
      />

      {/* Crop modal */}
      {imgSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && handleCancel()}
        >
          {/* Override react-image-crop default colors to match theme */}
          <style>{`
            .ReactCrop__crop-selection { border-color: #4FD1C5; }
            .ReactCrop__drag-handle::after { background-color: #4FD1C5; border-color: #4FD1C5; }
          `}</style>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-border bg-elevated p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-text-primary">裁剪头像</h2>
            <div className="flex-1 overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- react-image-crop requires a native img ref for canvas operations */}
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="裁剪预览"
                  onLoad={onImageLoad}
                  className="max-h-[55vh] max-w-full object-contain"
                />
              </ReactCrop>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={handleCancel} className={secondaryButtonClass}>
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!completedCrop || completedCrop.width === 0 || isPending}
                className={`${buttonClass} disabled:opacity-50`}
              >
                {isPending ? "上传中..." : "确认裁剪"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
