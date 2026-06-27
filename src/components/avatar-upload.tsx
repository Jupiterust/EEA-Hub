"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";
import { uploadAvatarAction } from "@/lib/actions";
import { Avatar } from "@/components/avatar";

export function AvatarUpload({ currentUrl }: { currentUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-block">
        <Avatar url={currentUrl} size="2xl" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-0.5 right-0.5 flex size-7 items-center justify-center rounded-full border border-border bg-elevated text-text-secondary transition hover:bg-surface hover:text-text-primary"
          title="更换头像（jpg/png/webp · 最大 2MB）"
          aria-label="更换头像"
        >
          <Camera className="size-3.5" />
        </button>
      </div>
      <form ref={formRef} action={uploadAvatarAction}>
        <input
          ref={inputRef}
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={() => formRef.current?.requestSubmit()}
        />
      </form>
    </div>
  );
}
