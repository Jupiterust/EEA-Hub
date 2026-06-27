"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const baseItems = [
  { href: "/docs", label: "技术文档" },
  { href: "/forum", label: "技术论坛" },
  { href: "/assignments", label: "作业" },
  { href: "/departments", label: "部门" },
  { href: "/dashboard", label: "个人主页" },
];

function buildItems(showAdmin?: boolean) {
  return showAdmin
    ? [...baseItems, { href: "/admin", label: "管理后台" }]
    : baseItems;
}

function useActiveCheck() {
  const pathname = usePathname();
  return (href: string) => pathname.startsWith(href);
}

export function DesktopNav({ showAdmin }: { showAdmin?: boolean }) {
  const isActive = useActiveCheck();
  const items = buildItems(showAdmin);

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "text-primary after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-primary"
              : "text-text-secondary hover:bg-elevated hover:text-text-primary",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav({ showAdmin }: { showAdmin?: boolean }) {
  const isActive = useActiveCheck();
  const items = buildItems(showAdmin);

  return (
    <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "relative whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "text-primary after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-primary"
              : "text-text-secondary hover:bg-elevated",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
