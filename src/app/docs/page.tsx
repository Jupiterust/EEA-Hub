import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DocTree } from "@/components/doc-tree";
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

  const [docs, allDocs] = await Promise.all([
    prisma.techDoc.findMany({
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
    }),
    prisma.techDoc.findMany({
      where: { published: true },
      select: { slug: true, title: true, division: true, team: true, path: true },
      orderBy: [{ division: "asc" }, { team: "asc" }, { order: "asc" }],
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        {/* Left sidebar */}
        <aside>
          <div className="rounded-lg border border-border bg-surface p-4">
            <h1 className="text-xl font-black text-text-primary">技术文档</h1>
            <form className="mt-4 grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-text-secondary" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="搜索标题或正文"
                  className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <select
                name="division"
                defaultValue={params.division ?? ""}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
              >
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
          </div>

          {allDocs.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-surface p-4">
              <DocTree allDocs={allDocs} />
            </div>
          )}
        </aside>

        {/* Main content */}
        <section className="grid auto-rows-min gap-3">
          {docs.map((doc) => (
            <Link
              key={doc.id}
              href={`/docs/${doc.slug}`}
              className="rounded-lg border border-border bg-surface p-5 transition hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={doc.division === "GENERAL" ? "blue" : "slate"}>
                  {divisionLabels[doc.division]}
                </Badge>
                <Badge>{teamLabels[doc.team]}</Badge>
              </div>
              <h2 className="mt-3 text-xl font-black text-text-primary">{doc.title}</h2>
              <p className="mt-1 text-sm text-text-secondary">{doc.path}</p>
              {doc.excerpt ? (
                <p className="mt-3 line-clamp-2 leading-7 text-text-secondary">{doc.excerpt}</p>
              ) : null}
            </Link>
          ))}
          {docs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
              暂无匹配文档。
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
