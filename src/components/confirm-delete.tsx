"use client";

import { useState } from "react";
import { cn, deleteButtonClass, secondaryButtonClass } from "@/components/ui";

const confirmBtnClass =
  "inline-flex items-center justify-center rounded-md bg-danger px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-danger/20";

export function ConfirmDelete({
  action,
  fields,
  message = "确定要删除吗？",
  buttonLabel = "删除",
  buttonClassName,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  message?: string;
  buttonLabel?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName ?? deleteButtonClass}
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-black text-text-primary">确认删除</h3>
            <p className="mt-2 text-sm text-text-secondary">
              {message}此操作不可撤销。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={secondaryButtonClass}
              >
                取消
              </button>
              <form action={action}>
                {Object.entries(fields).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <button type="submit" className={cn(confirmBtnClass)}>
                  确认删除
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
