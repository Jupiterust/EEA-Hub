"use client";

import { useState } from "react";
import { MarkdownView } from "@/components/markdown-view";
import { Tooltip } from "@/components/tooltip";
import { cn, inputClass } from "@/components/ui";

const MARKDOWN_TIP =
  '支持 Markdown 语法，例如：**粗体**、# 标题、`代码`、```代码块```。切换到"预览"查看渲染效果。';

interface Props {
  name: string;
  label?: string;
  defaultValue?: string;
  /** Controlled mode: pass value + onChange together */
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

export function MarkdownEditor({
  name,
  label = "正文",
  defaultValue = "",
  value: controlledValue,
  onChange,
  rows = 12,
  placeholder,
}: Props) {
  const isControlled = controlledValue !== undefined;
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;

  function handleChange(next: string) {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-gold flex items-center gap-1">
          {label}
          <Tooltip text={MARKDOWN_TIP} />
        </span>
        <div className="flex items-center rounded-md border border-border overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={cn(
              "px-3 py-1 font-medium transition",
              tab === "write"
                ? "bg-primary text-bg"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            编写
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "px-3 py-1 font-medium transition border-l border-border",
              tab === "preview"
                ? "bg-primary text-bg"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            预览
          </button>
        </div>
      </div>
      {/* Hidden input ensures the value is always submitted with the form */}
      <input type="hidden" name={name} value={value} />
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={cn(inputClass, "font-mono", tab === "preview" && "hidden")}
      />
      {tab === "preview" && (
        <div className="min-h-40 rounded-md border border-border bg-surface px-4 py-3">
          {value.trim() ? (
            <MarkdownView content={value} />
          ) : (
            <p className="text-sm text-text-secondary/60">暂无内容</p>
          )}
        </div>
      )}
    </div>
  );
}
