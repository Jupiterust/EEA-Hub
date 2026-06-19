import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge, secondaryButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; division?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const q = params.q?.trim();
  const docs = await prisma.techDoc.findMany({
    where: {
      published: true,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(params.division ? { division: params.division as never } : {}),
    },
    orderBy: [{ division: "asc" }, { team: "asc" }, { order: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-border bg-surface p-4 ">
        <h1 className="text-xl font-black text-text-primary">技术文档</h1>
        <form className="mt-4 grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-text-secondary" />
            <input name="q" defaultValue={q} placeholder="搜索标题或正文" className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <select name="division" defaultValue={params.division ?? ""} className="rounded-md border border-border px-3 py-2 text-sm">
            <option value="">全部部门</option>
            <option value="GENERAL">通用/新人指南</option>
            <option value="SOFTWARE">软件部</option>
            <option value="ANALOG">模电部</option>
          </select>
          <button className={secondaryButtonClass}>筛选</button>
        </form>
        {session?.user.role !== "MEMBER" ? (
          <Link href="/docs/new" className={`${secondaryButtonClass} mt-4 w-full gap-2`}>
            <Plus className="size-4" /> 新建文档
          </Link>
        ) : null}
      </aside>
      <section className="grid gap-3">
        {docs.map((doc) => (
          <Link key={doc.id} href={`/docs/${doc.slug}`} className="rounded-lg border border-border bg-surface p-5  ">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={doc.division === "GENERAL" ? "blue" : "slate"}>{divisionLabels[doc.division]}</Badge>
              <Badge>{teamLabels[doc.team]}</Badge>
            </div>
            <h2 className="mt-3 text-xl font-black text-text-primary">{doc.title}</h2>
            <p className="mt-2 text-sm text-text-secondary">{doc.path}</p>
            {doc.excerpt ? <p className="mt-3 leading-7 text-text-secondary">{doc.excerpt}</p> : null}
          </Link>
        ))}
        {docs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
            暂无匹配文档。
          </div>
        ) : null}
      </section>
    </div>
  );
}
