import Link from "next/link";
import { Plus, Search, ThumbsUp } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toggleDocPinAction } from "@/lib/actions";
import { DocTree } from "@/components/doc-tree";
import { HighlightText } from "@/components/highlight-text";
import { Pagination } from "@/components/pagination";
import { SubmitButton } from "@/components/submit-button";
import { Badge, secondaryButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; author?: string; division?: string; page?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const q = params.q?.trim();
  const author = params.author?.trim();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const userRole = session?.user?.role;
  const canPin = userRole === "LEADER" || userRole === "ADMIN";

  const baseWhere = {
    published: true,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { content: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(author
      ? {
          author: {
            OR: [
              { realName: { contains: author, mode: "insensitive" as const } },
              { username: { contains: author, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
    ...(params.division ? { division: params.division as never } : {}),
  };

  const orderBy = [
    { division: "asc" as const },
    { team: "asc" as const },
    { order: "asc" as const },
    { updatedAt: "desc" as const },
  ];

  const docInclude = { _count: { select: { docLikes: true } } } as const;

  const [pinnedDocs, docs, total, allDocs] = await Promise.all([
    prisma.techDoc.findMany({
      where: { ...baseWhere, isPinned: true },
      include: docInclude,
      orderBy: { pinnedAt: "desc" },
    }),
    prisma.techDoc.findMany({
      where: { ...baseWhere, isPinned: false },
      include: docInclude,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.techDoc.count({ where: { ...baseWhere, isPinned: false } }),
    prisma.techDoc.findMany({
      where: { published: true },
      select: { slug: true, title: true, division: true, team: true, path: true },
      orderBy: [{ division: "asc" }, { team: "asc" }, { order: "asc" }],
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildHref(p: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (author) sp.set("author", author);
    if (params.division) sp.set("division", params.division);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/docs${qs ? `?${qs}` : ""}`;
  }

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
              <input
                name="author"
                defaultValue={author}
                placeholder="按作者姓名/用户名"
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
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
            {session?.user ? (
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
        <section>
          <div className="grid auto-rows-min gap-3">
            {pinnedDocs.map((doc) => (
              <div
                key={doc.id}
                className="relative rounded-lg border border-border bg-surface p-5 transition hover:border-primary/40 [border-left-width:3px] [border-left-color:color-mix(in_srgb,#C4AC60_60%,transparent)]"
              >
                <Link href={`/docs/${doc.slug}`} className="absolute inset-0 z-0" aria-label={doc.title} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="relative z-10 inline-flex items-center gap-1 rounded border border-[#C4AC60]/30 bg-[#C4AC60]/10 px-1.5 py-0.5 text-xs font-bold text-[#C4AC60]">
                    📌 置顶
                  </span>
                  <Badge tone={doc.division === "GENERAL" ? "blue" : "slate"}>
                    {divisionLabels[doc.division]}
                  </Badge>
                  <Badge>{teamLabels[doc.team]}</Badge>
                </div>
                <h2 className="mt-3 text-xl font-black text-text-primary">
                  <HighlightText text={doc.title} query={q} />
                </h2>
                <p className="mt-1 text-sm text-text-secondary">{doc.path}</p>
                {doc.excerpt ? (
                  <p className="mt-3 line-clamp-2 leading-7 text-text-secondary">{doc.excerpt}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                  <ThumbsUp className="size-4" />
                  <span>{doc._count.docLikes}</span>
                  {canPin && (
                    <form action={toggleDocPinAction} className="relative z-10 ml-auto">
                      <input type="hidden" name="docId" value={doc.id} />
                      <input type="hidden" name="returnTo" value="/docs" />
                      <SubmitButton variant="secondary" pendingText="..." className="px-2 py-1 text-xs">
                        取消置顶
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ))}

            {pinnedDocs.length > 0 && docs.length > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-text-secondary">其他文档</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

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
                <h2 className="mt-3 text-xl font-black text-text-primary">
                  <HighlightText text={doc.title} query={q} />
                </h2>
                <p className="mt-1 text-sm text-text-secondary">{doc.path}</p>
                {doc.excerpt ? (
                  <p className="mt-3 line-clamp-2 leading-7 text-text-secondary">{doc.excerpt}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-1 text-sm text-text-secondary">
                  <ThumbsUp className="size-4" />
                  <span>{doc._count.docLikes}</span>
                </div>
              </Link>
            ))}

            {pinnedDocs.length === 0 && docs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
                暂无匹配文档。
              </div>
            ) : null}
          </div>

          <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
        </section>
      </div>
    </div>
  );
}
