import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { auth } from "@/auth";
import { SubmitButton } from "@/components/submit-button";
import { signOutAction } from "@/lib/actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "电协 Hub",
  description: "电气与电子信息协会内部资料、论坛与作业平台",
};

const navItems = [
  { href: "/docs", label: "技术文档" },
  { href: "/forum", label: "技术论坛" },
  { href: "/assignments", label: "作业" },
  { href: "/departments", label: "部门" },
  { href: "/dashboard", label: "个人主页" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-black text-bg">
                EEA
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-text-primary">
                  电协 Hub
                </span>
                <span className="block truncate text-xs text-text-secondary">
                  文档、论坛、作业与管理平台
                </span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-elevated hover:text-text-primary"
                >
                  {item.label}
                </Link>
              ))}
              {session?.user && session.user.role !== "MEMBER" ? (
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-elevated hover:text-text-primary"
                >
                  管理后台
                </Link>
              ) : null}
            </nav>
            <div className="flex shrink-0 items-center gap-2">
              {session?.user ? (
                <form action={signOutAction}>
                  <SubmitButton variant="secondary" pendingText="退出中..." className="px-3">退出</SubmitButton>
                </form>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-md px-3 py-2 text-sm font-semibold text-text-primary hover:bg-elevated"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-bg hover:bg-secondary"
                  >
                    注册
                  </Link>
                </>
              )}
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-elevated"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
