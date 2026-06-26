"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

type Heading = { id: string; text: string; level: number };

export function TableOfContents({
  initialHeadings = [],
}: {
  initialHeadings?: Heading[];
}) {
  // headings come entirely from server-side extraction — no DOM setState in effects
  const headings = initialHeadings;
  const [activeId, setActiveId] = useState("");

  // Scroll spy — setActiveId is called inside an observer callback, not synchronously
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="本文目录">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        本文目录
      </p>
      <ul className="grid gap-0.5">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(h.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveId(h.id);
              }}
              className={cn(
                "block rounded px-2 py-1 text-sm leading-snug transition-colors hover:text-primary",
                h.level === 3 && "pl-4",
                h.level === 4 && "pl-6",
                h.id === activeId
                  ? "font-semibold text-primary"
                  : "text-text-secondary",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
