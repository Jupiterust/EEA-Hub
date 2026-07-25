"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

function computeDisplay(dueAt: string): { text: string; cls: string } {
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff <= 0) {
    return { text: "已截止", cls: "bg-elevated text-text-secondary" };
  }
  const hours = diff / 3_600_000;
  const days = diff / 86_400_000;
  if (hours <= 24) {
    return { text: `紧急 · 还有 ${Math.ceil(hours)} 小时`, cls: "bg-danger/15 text-danger" };
  }
  if (days <= 3) {
    return { text: `还有 ${Math.ceil(days)} 天`, cls: "bg-gold/15 text-gold" };
  }
  return { text: `还有 ${Math.ceil(days)} 天`, cls: "bg-success/15 text-success" };
}

export function DeadlineBadge({ dueAt }: { dueAt: string }) {
  const [display, setDisplay] = useState(() => computeDisplay(dueAt));
  useEffect(() => {
    setDisplay(computeDisplay(dueAt));
    const id = setInterval(() => setDisplay(computeDisplay(dueAt)), 30_000);
    return () => clearInterval(id);
  }, [dueAt]);
  return (
    <span
      suppressHydrationWarning
      className={cn(
        "whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ring-1",
        display.cls === "bg-elevated text-text-secondary"
          ? "ring-border"
          : display.cls.includes("danger")
            ? "ring-danger/30"
            : display.cls.includes("gold")
              ? "ring-gold/30"
              : "ring-success/30",
        display.cls,
      )}
    >
      {display.text}
    </span>
  );
}
