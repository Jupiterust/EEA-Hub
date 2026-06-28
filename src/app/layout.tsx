import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Search } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SubmitButton } from "@/components/submit-button";
import { NotificationBell, type NotificationData } from "@/components/notification-bell";
import { DesktopNav, MobileNav } from "@/components/nav-links";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  const notifications: NotificationData[] = session?.user?.id
    ? (
        await prisma.notification.findMany({
          where: { recipientId: session.user.id },
          orderBy: [{ isRead: "asc" }, { updatedAt: "desc" }],
          take: 20,
        })
      ).map((n) => ({
        id: n.id,
        type: n.type as NotificationData["type"],
        message: n.message,
        linkUrl: n.linkUrl,
        isRead: n.isRead,
        count: n.count,
        updatedAt: n.updatedAt.toISOString(),
      }))
    : [];

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
            <DesktopNav showAdmin={!!(session?.user && session.user.role !== "MEMBER")} />
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/search" className="rounded-md p-2 text-text-secondary hover:bg-elevated hover:text-text-primary" aria-label="全站搜索">
                <Search className="h-5 w-5" />
              </Link>
              {session?.user ? (
                <>
                  <NotificationBell initialNotifications={notifications} />
                  <form action={signOutAction}>
                    <SubmitButton variant="secondary" pendingText="退出中..." className="px-3">退出</SubmitButton>
                  </form>
                </>
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
          <MobileNav showAdmin={!!(session?.user && session.user.role !== "MEMBER")} />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
