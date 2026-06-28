import Link from "next/link";
import { cn } from "@/components/ui";

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [];
  const around = 1; // pages shown each side of current
  const left = Math.max(2, current - around);
  const right = Math.min(total - 1, current + around);

  pages.push(1);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  return (
    <nav className="mt-6 flex items-center justify-center gap-1" aria-label="分页">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm text-text-secondary transition hover:border-primary hover:text-primary"
        >
          上一页
        </Link>
      ) : (
        <span className="inline-flex h-8 cursor-not-allowed items-center rounded-md border border-border px-3 text-sm text-text-secondary/40">
          上一页
        </span>
      )}

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="inline-flex h-8 w-8 items-center justify-center text-sm text-text-secondary">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold transition",
              p === page
                ? "bg-primary text-[#212733]"
                : "border border-border text-text-secondary hover:border-primary hover:text-primary",
            )}
          >
            {p}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm text-text-secondary transition hover:border-primary hover:text-primary"
        >
          下一页
        </Link>
      ) : (
        <span className="inline-flex h-8 cursor-not-allowed items-center rounded-md border border-border px-3 text-sm text-text-secondary/40">
          下一页
        </span>
      )}
    </nav>
  );
}
