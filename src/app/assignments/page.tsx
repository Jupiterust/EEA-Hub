import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { Badge, secondaryButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const user = await requireUser();
  const assignments = await prisma.assignment.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : {
            division: user.division,
            OR: [{ team: "GENERAL" }, { team: user.team }],
          },
    include: {
      submissions: {
        where: { studentId: user.id },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
      _count: { select: { submissions: true } },
    },
    orderBy: { dueAt: "asc" },
  });

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
      <section className="mt-6 grid gap-3">
        {assignments.map((assignment) => {
          const latest = assignment.submissions[0];
          const late = new Date() > assignment.dueAt;
          return (
            <Link key={assignment.id} href={`/assignments/${assignment.id}`} className="rounded-lg border border-border bg-surface p-5  ">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={late ? "red" : "green"}>{late ? "已过截止" : "进行中"}</Badge>
                <Badge>{divisionLabels[assignment.division]}</Badge>
                <Badge>{teamLabels[assignment.team]}</Badge>
                {latest ? <Badge tone={latest.verdict === "PASS" ? "green" : latest.verdict === "FAIL" ? "red" : "amber"}>{latest.verdict === "UNREVIEWED" ? "已提交待批改" : latest.verdict}</Badge> : <Badge tone="amber">未提交</Badge>}
              </div>
              <h2 className="mt-3 text-xl font-black text-text-primary">{assignment.title}</h2>
              <p className="mt-2 text-sm text-text-secondary">截止：{assignment.dueAt.toLocaleString("zh-CN")} · 提交记录 {assignment._count.submissions}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
