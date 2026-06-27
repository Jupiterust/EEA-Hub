"use client";

import { useState } from "react";
import { replyAction } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, secondaryButtonClass } from "@/components/ui";

export function InlineReplyForm({
  postId,
  parentId,
  replyToId,
  atLabel,
}: {
  postId: string;
  parentId: string;
  replyToId: string;
  atLabel: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-text-secondary transition-colors hover:text-primary"
      >
        回复
      </button>
    );
  }

  return (
    <form action={replyAction} className="mt-3 grid gap-2">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="parentId" value={parentId} />
      <input type="hidden" name="replyToId" value={replyToId} />
      <input type="hidden" name="returnTo" value={`/forum/${postId}`} />
      <p className="text-xs text-text-secondary">
        回复 <span className="font-semibold text-primary">@{atLabel}</span>
      </p>
      <textarea
        name="content"
        className={`${inputClass} font-mono text-sm`}
        rows={3}
        placeholder={`@${atLabel} `}
        required
        autoFocus
      />
      <label className="flex items-center gap-2 text-xs text-text-primary">
        <input name="isAnonymous" type="checkbox" className="size-3.5" />
        匿名回复
      </label>
      <div className="flex gap-2">
        <SubmitButton pendingText="发表中..." className="px-3 py-1.5 text-xs">
          发表回复
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}
        >
          取消
        </button>
      </div>
    </form>
  );
}
