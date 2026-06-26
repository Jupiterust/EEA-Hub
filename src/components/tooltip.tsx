"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/components/ui";

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="说明"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center text-text-secondary/60 hover:text-text-secondary focus:outline-none"
      >
        <Info className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg border border-border bg-elevated px-3 py-2 text-xs leading-relaxed text-text-primary shadow-lg transition-all duration-150",
          open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
        )}
      >
        {text}
        {/* Arrow */}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-elevated" />
      </span>
    </span>
  );
}
