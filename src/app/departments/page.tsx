import Link from "next/link";
import { BookOpen, ClipboardList, Users } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { divisionLabels, teamLabels, validTeamsByDivision } from "@/lib/labels";
import { Badge } from "@/components/ui";
import { DeadlineBadge } from "@/components/deadline-badge";
import { TeamSection, type TeamData } from "@/components/team-section";

export const revalidate = 60;

const DIVISIONS = ["SOFTWARE", "ANALOG"] as const;

const divisionDescs: Record<string, string> = {
  SOFTWARE: "聚焦控制算法、嵌入式软件、机器视觉与工程化工具链。",
  ANALOG: "聚焦 FPGA、硬件电路、模数混合调试与板级系统实践。",
};

export default async function DepartmentsPage() {
  const user = await requireUser();
  const now = new Date();
  const isGeneral = user.division === "GENERAL";

  const [
    myDivisionDocs,
    myUpcomingAssignments,
    allActiveMembers,
    softwareMemberCount,
    analogMemberCount,
    softwareDocCount,
    analogDocCount,
    softwareAssignCount,
    analogAssignCount,
    openAssignments,
  ] = await Promise.all([
    // A: latest 3 docs in my division
    isGeneral
      ? Promise.resolve([] as { id: string; title: string; slug: string; updatedAt: Date }[])
      : prisma.techDoc.findMany({
          where: { division: user.division },
          orderBy: { updatedAt: "desc" },
          take: 3,
          select: { id: true, title: true, slug: true, updatedAt: true },
        }),

    // A: next 2 upcoming assignments for my division/team
    isGeneral
      ? Promise.resolve([] as { id: string; title: string; dueAt: Date }[])
      : prisma.assignment.findMany({
          where: {
            division: user.division,
            OR: [{ team: user.team }, { team: "GENERAL" }],
            status: "OPEN",
            dueAt: { gt: now },
          },
          orderBy: { dueAt: "asc" },
          take: 2,
          select: { id: true, title: true, dueAt: true },
        }),

    // C: all active members in both divisions for member directory
    prisma.user.findMany({
      where: { status: "ACTIVE", division: { in: ["SOFTWARE", "ANALOG"] } },
      select: { id: true, realName: true, division: true, team: true, role: true },
      orderBy: [{ role: "desc" }, { realName: "asc" }],
    }),

    // D: stats counts per division
    prisma.user.count({ where: { status: "ACTIVE", division: "SOFTWARE" } }),
    prisma.user.count({ where: { status: "ACTIVE", division: "ANALOG" } }),
    prisma.techDoc.count({ where: { division: "SOFTWARE" } }),
    prisma.techDoc.count({ where: { division: "ANALOG" } }),
    prisma.assignment.count({ where: { division: "SOFTWARE", status: "OPEN", dueAt: { gt: now } } }),
    prisma.assignment.count({ where: { division: "ANALOG", status: "OPEN", dueAt: { gt: now } } }),

    // B: open assignments for countdown section
    prisma.assignment.findMany({
      where: { status: "OPEN" },
      orderBy: { dueAt: "asc" },
      take: 20,
      select: { id: true, title: true, dueAt: true, division: true, team: true },
    }),
  ]);

  // B: future deadlines first, overdue last
  const futureOnes = openAssignments.filter((a) => a.dueAt > now);
  const overdueOnes = [...openAssignments.filter((a) => a.dueAt <= now)].reverse();
  const sortedAssignments = [...futureOnes, ...overdueOnes].slice(0, 6);

  // D: stats lookup by division key
  const divStats = {
    SOFTWARE: { members: softwareMemberCount, docs: softwareDocCount, assignments: softwareAssignCount },
    ANALOG: { members: analogMemberCount, docs: analogDocCount, assignments: analogAssignCount },
  };

  // C: build TeamData for a given division+team
  function buildTeamData(div: string, teamKey: string): TeamData {
    const inTeam = allActiveMembers.filter(
      (m) => m.division === div && m.team === teamKey,
    );
    return {
      key: teamKey,
      label: teamLabels[teamKey as keyof typeof teamLabels],
      leaders: inTeam
        .filter((m) => m.role === "LEADER" || m.role === "ADMIN")
        .map((m) => ({ id: m.id, realName: m.realName })),
      members: inTeam
        .filter((m) => m.role === "MEMBER")
        .map((m) => ({ id: m.id, realName: m.realName })),
    };
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black text-text-primary">部门展示</h1>

      {/* A: My department — full-width personalized block */}
      {!isGeneral && (
        <section className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">我的部门</p>
          <div className="mt-4 grid gap-8 md:grid-cols-2">

            {/* Left: division + team info + recent docs */}
            <div>
              <h2 className="text-2xl font-black text-text-primary">
                {divisionLabels[user.division as keyof typeof divisionLabels]}
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {divisionDescs[user.division] ?? ""}
              </p>
              <div className="mt-3">
                <Badge>{teamLabels[user.team as keyof typeof teamLabels]}</Badge>
              </div>
              {myDivisionDocs.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold text-text-secondary">近期文档</p>
                  <div className="grid gap-1.5">
                    {myDivisionDocs.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/docs/${doc.slug}`}
                        className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs hover:bg-elevated"
                      >
                        <span className="truncate font-medium text-text-primary">{doc.title}</span>
                        <span className="ml-3 shrink-0 text-text-secondary">
                          {doc.updatedAt.toLocaleDateString("zh-CN")}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: upcoming assignments with countdown */}
            <div>
              <p className="mb-2 text-xs font-semibold text-text-secondary">待办作业</p>
              {myUpcomingAssignments.length === 0 ? (
                <p className="text-sm text-text-secondary">暂无即将截止的作业。</p>
              ) : (
                <div className="grid gap-2">
                  {myUpcomingAssignments.map((a) => (
                    <Link
                      key={a.id}
                      href={`/assignments/${a.id}`}
                      className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3 py-3 hover:bg-elevated"
                    >
                      <span className="text-sm font-semibold text-text-primary">{a.title}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-text-secondary">
                          {a.dueAt.toLocaleString("zh-CN")}
                        </span>
                        <DeadlineBadge dueAt={a.dueAt.toISOString()} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* C + D: Department cards with member directory and stats */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {DIVISIONS.map((div) => {
          const stats = divStats[div];
          const teams = validTeamsByDivision[div];

          return (
            <div key={div} className="rounded-lg border border-border bg-surface p-6">
              {/* Card header with stats badges (D) */}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-black text-text-primary">
                  {divisionLabels[div]}
                </h2>
                <div className="flex shrink-0 flex-wrap gap-1.5 pt-0.5">
                  <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs text-text-secondary ring-1 ring-border">
                    <Users className="size-3" />
                    {stats.members}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs text-text-secondary ring-1 ring-border">
                    <BookOpen className="size-3" />
                    {stats.docs}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs text-text-secondary ring-1 ring-border">
                    <ClipboardList className="size-3" />
                    {stats.assignments}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-text-secondary">{divisionDescs[div]}</p>

              {/* C: Team list with expandable member directories */}
              <div className="mt-5 grid gap-2">
                {teams.map((teamKey) => (
                  <TeamSection
                    key={teamKey}
                    team={buildTeamData(div, teamKey)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* B: Upcoming assignments with deadline countdown */}
      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-xl font-black text-text-primary">近期作业</h2>
        <div className="mt-4 grid gap-2">
          {sortedAssignments.length === 0 ? (
            <p className="text-sm text-text-secondary">暂无进行中的作业。</p>
          ) : (
            sortedAssignments.map((a) => (
              <Link
                key={a.id}
                href={`/assignments/${a.id}`}
                className="flex items-center justify-between gap-4 rounded-md border border-border p-3 hover:bg-elevated"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{a.title}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {divisionLabels[a.division as keyof typeof divisionLabels]}
                    {a.team !== "GENERAL"
                      ? ` · ${teamLabels[a.team as keyof typeof teamLabels]}`
                      : ""}
                    {" · "}
                    {a.dueAt.toLocaleString("zh-CN")}
                  </p>
                </div>
                <DeadlineBadge dueAt={a.dueAt.toISOString()} />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
