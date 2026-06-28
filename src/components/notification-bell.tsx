"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
  clearReadNotificationsAction,
} from "@/lib/actions";

export type NotificationData = {
  id: string;
  type: "REPLY" | "ACCEPT" | "LIKE" | "COMMENT" | "DEADLINE" | "FOLLOW" | "MENTION";
  message: string;
  linkUrl: string;
  isRead: boolean;
  count: number;
  createdAt: string;
};

const typeIcon: Record<string, string> = {
  REPLY: "💬",
  ACCEPT: "✅",
  LIKE: "👍",
  COMMENT: "📝",
  DEADLINE: "⏰",
  FOLLOW: "🔔",
  MENTION: "@",
};

const COLLAPSED_COUNT = 5;

function useNotifications(initial: NotificationData[]) {
  const [notifications, setNotifications] = useState(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function markOne(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    startTransition(() => { markNotificationReadAction(id); });
  }

  function markAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    startTransition(() => { markAllNotificationsReadAction(); });
  }

  function deleteOne(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    startTransition(() => { deleteNotificationAction(id); });
  }

  function clearRead() {
    setNotifications((prev) => prev.filter((n) => !n.isRead));
    startTransition(() => { clearReadNotificationsAction(); });
  }

  function navigate(n: NotificationData) {
    markOne(n.id);
    router.push(n.linkUrl);
  }

  return { notifications, markAll, deleteOne, clearRead, navigate };
}

export function NotificationBell({ initialNotifications }: { initialNotifications: NotificationData[] }) {
  const [open, setOpen] = useState(false);
  const { notifications, markAll, deleteOne, clearRead, navigate } = useNotifications(initialNotifications);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.isRead).length;
  const hasRead = notifications.some((n) => n.isRead);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-text-secondary hover:bg-elevated hover:text-text-primary"
        aria-label={unread > 0 ? `${unread} 条未读通知` : "通知"}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-text-primary">通知</h3>
            <div className="flex items-center gap-3">
              {hasRead && (
                <button
                  type="button"
                  onClick={clearRead}
                  className="text-xs text-text-secondary hover:text-danger"
                >
                  清空已读
                </button>
              )}
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="text-xs text-primary hover:underline"
                >
                  全部标记已读
                </button>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-secondary">暂无通知</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`group flex items-start border-b border-border last:border-0 hover:bg-elevated ${n.isRead ? "opacity-60" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => { setOpen(false); navigate(n); }}
                    className="flex min-w-0 flex-1 items-start gap-2.5 px-4 py-3 text-left"
                  >
                    <span className="mt-0.5 shrink-0 text-sm">{typeIcon[n.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-text-primary">{n.message}</p>
                      <p className="mt-1 text-[11px] text-text-secondary">
                        {new Date(n.createdAt).toLocaleString("zh-CN")}
                        {n.count > 1 && ` · 共 ${n.count} 次`}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOne(n.id)}
                    className="shrink-0 px-2 py-3 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                    aria-label="删除通知"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationsSection({ initialNotifications }: { initialNotifications: NotificationData[] }) {
  const { notifications, markAll, deleteOne, clearRead, navigate } = useNotifications(initialNotifications);
  const [expanded, setExpanded] = useState(false);

  const unread = notifications.filter((n) => !n.isRead).length;
  const hasRead = notifications.some((n) => n.isRead);
  const visible = expanded ? notifications : notifications.slice(0, COLLAPSED_COUNT);
  const hasMore = notifications.length > COLLAPSED_COUNT;

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-text-primary">
          通知
          {unread > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
              {unread}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {hasRead && (
            <button
              type="button"
              onClick={clearRead}
              className="text-sm text-text-secondary hover:text-danger"
            >
              清空已读
            </button>
          )}
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="text-sm text-primary hover:underline"
            >
              全部标记已读
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {notifications.length === 0 ? (
          <p className="text-sm text-text-secondary">暂无通知。</p>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start rounded-md border border-border hover:bg-elevated ${n.isRead ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                onClick={() => navigate(n)}
                className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left"
              >
                <span className="mt-0.5 shrink-0 text-base">{typeIcon[n.type]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{n.message}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {new Date(n.createdAt).toLocaleString("zh-CN")}
                    {n.count > 1 && ` · 共 ${n.count} 次`}
                  </p>
                </div>
                {!n.isRead && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => deleteOne(n.id)}
                className="shrink-0 px-2 py-3 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                aria-label="删除通知"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 w-full rounded-md border border-border py-2 text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          {expanded ? "收起" : `展开全部（共 ${notifications.length} 条）`}
        </button>
      )}
    </section>
  );
}
