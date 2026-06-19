import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const departments = [
  {
    name: "软件部",
    desc: "聚焦控制算法、嵌入式软件、机器视觉与工程化工具链。",
    teams: ["控制组", "视觉组"],
    division: "SOFTWARE",
  },
  {
    name: "模电部",
    desc: "聚焦 FPGA、硬件电路、模数混合调试与板级系统实践。",
    teams: ["FPGA组", "硬件组"],
    division: "ANALOG",
  },
] as const;

export default async function DepartmentsPage() {
  const [docs, assignments] = await Promise.all([
    prisma.techDoc.findMany({ orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.assignment.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black text-text-primary">部门展示</h1>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {departments.map((department) => (
          <div key={department.name} className="rounded-lg border border-border bg-surface p-6 ">
            <h2 className="text-2xl font-black text-text-primary">{department.name}</h2>
            <p className="mt-3 leading-7 text-text-secondary">{department.desc}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {department.teams.map((team) => <span key={team} className="rounded-md bg-elevated px-3 py-1 text-sm font-semibold text-text-primary">{team}</span>)}
            </div>
          </div>
        ))}
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5 ">
          <h2 className="text-xl font-black text-text-primary">近期技术文档</h2>
          <div className="mt-4 grid gap-2">
            {docs.map((doc) => <Link key={doc.id} href={`/docs/${doc.slug}`} className="rounded-md border border-border p-3 text-sm hover:bg-elevated">{doc.title}</Link>)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 ">
          <h2 className="text-xl font-black text-text-primary">近期作业</h2>
          <div className="mt-4 grid gap-2">
            {assignments.map((assignment) => <Link key={assignment.id} href={`/assignments/${assignment.id}`} className="rounded-md border border-border p-3 text-sm hover:bg-elevated">{assignment.title}</Link>)}
          </div>
        </div>
      </section>
    </div>
  );
}
