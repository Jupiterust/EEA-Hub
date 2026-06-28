import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { HighlightText } from "@/components/highlight-text";
import { Pagination } from "@/components/pagination";
import { Badge, secondaryButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const q = params.q?.trim();
  const status = params.status === "OPEN" || params.status === "CLOSED" ? (params.status as "OPEN" | "CLOSED") : undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const where = {
    ...(user.role === "ADMIN"
      ? {}
      : { division: user.division, OR: [{ team: "GENERAL" as const }, { team: user.team }] }),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status ? { status } : {}),
  };

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      include: {
        submissions: {
          where: { studentId: user.id },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.assignment.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildHref(p: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/assignments${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black text-text-primary">作业</h1>
          <p className="mt-2 text-text-secondary">按部门/小组可见，允许多次提交，以最新一次为准。</p>
        </div>
        {user.role !== "MEMBER" ? (
          <Link href="/assignments/new" className={`${secondaryButtonClass} gap-2`}>
            <Plus className="size-4" /> 发布作业
          </Link>
        ) : null}
      </div>

      <form className="mt-6 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-text-secondary" />
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索作业标题"
            className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
        >
          <option value="">全部</option>
          <option value="OPEN">进行中</option>
          <option value="CLOSED">已关闭</option>
        </select>
        <button className={secondaryButtonClass}>筛选</button>
      </form>

      <section className="mt-4 grid gap-3">
        {assignments.map((assignment) => {
          const latest = assignment.submissions[0];
          const late = new Date() > assignment.dueAt;
          return (
            <Link key={assignment.id} href={`/assignments/${assignment.id}`} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={assignment.status === "CLOSED" ? "slate" : late ? "red" : "green"}>
                  {assignment.status === "CLOSED" ? "已关闭" : late ? "已过截止" : "进行中"}
                </Badge>
                <Badge>{divisionLabels[assignment.division]}</Badge>
                <Badge>{teamLabels[assignment.team]}</Badge>
                {latest ? (
                  <Badge tone={latest.verdict === "PASS" ? "green" : latest.verdict === "FAIL" ? "red" : "amber"}>
                    {latest.verdict === "UNREVIEWED" ? "已提交待批改" : latest.verdict}
                  </Badge>
                ) : (
                  <Badge tone="amber">未提交</Badge>
                )}
              </div>
              <h2 className="mt-3 text-xl font-black text-text-primary">
                <HighlightText text={assignment.title} query={q} />
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                截止：{assignment.dueAt.toLocaleString("zh-CN")} · 提交记录 {assignment._count.submissions}
              </p>
            </Link>
          );
        })}
        {assignments.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
            暂无匹配作业。
          </div>
        )}
      </section>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
