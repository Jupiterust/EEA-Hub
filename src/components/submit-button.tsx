"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/components/ui";

export function SubmitButton({
  children,
  pendingText = "提交中...",
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70";
  const styles =
    variant === "primary"
      ? "bg-primary text-bg hover:bg-secondary focus:outline-none focus:ring-4 focus:ring-primary/20"
      : "border border-border bg-surface text-text-primary hover:border-primary hover:bg-elevated focus:outline-none focus:ring-4 focus:ring-primary/20";

  return (
    <button disabled={pending} className={cn(base, styles, className)}>
      {pending ? <LoaderCircle className="size-4 animate-spin text-bg" /> : null}
      {pending ? pendingText : children}
    </button>
  );
}
