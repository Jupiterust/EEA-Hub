import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    slate: "bg-elevated text-text-secondary ring-border",
    green: "bg-success/15 text-success ring-success/35",
    amber: "bg-gold/15 text-gold ring-gold/35",
    red: "bg-danger/15 text-danger ring-danger/35",
    blue: "bg-primary/15 text-primary ring-primary/35",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1", tones[tone])}>
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-text-primary">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/20";

export const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-bg transition hover:bg-secondary focus:outline-none focus:ring-4 focus:ring-primary/20";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-primary hover:bg-elevated focus:outline-none focus:ring-4 focus:ring-primary/20";

export const editButtonClass =
  "appearance-none box-border h-9 leading-none inline-flex items-center justify-center rounded-md border border-accent/40 bg-accent/15 px-4 text-sm font-semibold text-accent transition hover:bg-accent/25 focus:outline-none focus:ring-4 focus:ring-accent/20";

export const deleteButtonClass =
  "appearance-none box-border h-9 leading-none inline-flex items-center justify-center rounded-md border border-danger/40 bg-danger/15 px-4 text-sm font-semibold text-danger transition hover:bg-danger/25 focus:outline-none focus:ring-4 focus:ring-danger/20";

export const editLinkClass = "text-xs font-medium text-accent hover:underline";

export const deleteLinkClass =
  "appearance-none inline text-xs font-medium text-danger hover:underline bg-transparent border-0 p-0 m-0 cursor-pointer";
