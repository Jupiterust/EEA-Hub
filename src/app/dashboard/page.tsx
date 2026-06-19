import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { Badge } from "@/components/ui";
import { divisionLabels, roleLabels, statusLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const [submissions, posts, todos, adminStats] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: user.id },
      include: { assignment: { select: { id: true, title: true, dueAt: true } } },
      orderBy: { submittedAt: "desc" },
      take: 8,
    }),
    prisma.forumPost.findMany({
      where: { authorId: user.id, isAnonymous: false },
      select: { id: true, title: true, updatedAt: true, isSolved: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    user.role === "MEMBER"
      ? prisma.assignment.findMany({
          where: {
            division: user.division,
            OR: [{ team: user.team }, { team: "GENERAL" }],
            dueAt: { gt: now, lt: soon },
            submissions: { none: { studentId: user.id } },
          },
          orderBy: { dueAt: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
    user.role === "MEMBER"
      ? Promise.resolve(null)
      : Promise.all([
          prisma.user.count({ where: { status: "PENDING" } }),
          prisma.report.count({ where: { status: "OPEN" } }),
          prisma.assignment.count(),
        ]),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="rounded-lg border border-border bg-surface p-6 ">
        <h1 className="text-3xl font-black text-text-primary">个人主页</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="blue">{user.name}</Badge>
          <Badge>{divisionLabels[user.division]}</Badge>
          <Badge>{teamLabels[user.team]}</Badge>
          <Badge tone={user.role === "ADMIN" ? "red" : user.role === "LEADER" ? "amber" : "slate"}>{roleLabels[user.role]}</Badge>
          <Badge tone="green">{statusLabels[user.status]}</Badge>
        </div>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {user.role === "MEMBER" ? (
          <div className="rounded-lg border border-border bg-surface p-5 ">
            <h2 className="text-xl font-black text-text-primary">待办提醒</h2>
            <div className="mt-4 grid gap-3">
              {todos.map((todo) => {
                const hoursLeft = Math.max(0, Math.ceil((todo.dueAt.getTime() - now.getTime()) / 3_600_000));
                return (
                  <Link key={todo.id} href={`/assignments/${todo.id}`} className="rounded-md bg-gold/15 p-3 text-sm text-gold">
                    {todo.title} · {todo.dueAt.toLocaleString("zh-CN")} · 剩余约 {hoursLeft} 小时
                  </Link>
                );
              })}
              {todos.length === 0 ? <p className="text-sm text-text-secondary">暂无临近截止未提交作业。</p> : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-5 ">
            <h2 className="text-xl font-black text-text-primary">管理概览</h2>
            <div className="mt-4 grid gap-3 text-sm text-text-secondary">
              <p>待审核成员：{adminStats?.[0] ?? 0}</p>
              <p>待处理举报：{adminStats?.[1] ?? 0}</p>
              <p>作业总数：{adminStats?.[2] ?? 0}</p>
            </div>
          </div>
        )}
        <div className="rounded-lg border border-border bg-surface p-5  lg:col-span-2">
          <h2 className="text-xl font-black text-text-primary">我的作业记录</h2>
          <div className="mt-4 grid gap-3">
            {submissions.map((item) => (
              <Link key={item.id} href={`/assignments/${item.assignment.id}`} className="rounded-md border border-border p-3 text-sm hover:bg-elevated">
                <p className="font-semibold text-text-primary">{item.assignment.title}</p>
                <p className="mt-1 text-text-secondary">{item.submittedAt.toLocaleString("zh-CN")} · {item.isLate ? "迟交" : "按时"} · {item.verdict}</p>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5  lg:col-span-3">
          <h2 className="text-xl font-black text-text-primary">我发布的实名帖子</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {posts.map((post) => (
              <Link key={post.id} href={`/forum/${post.id}`} className="rounded-md border border-border p-3 text-sm hover:bg-elevated">
                <p className="font-semibold text-text-primary">{post.title}</p>
                <p className="mt-1 text-text-secondary">{post.isSolved ? "已解决" : "讨论中"} · {post.updatedAt.toLocaleString("zh-CN")}</p>
              </Link>
            ))}
            {posts.length === 0 ? <p className="text-sm text-text-secondary">暂无实名帖子。匿名帖子不会在个人主页展示。</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
