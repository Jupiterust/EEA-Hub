import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteDocAction } from "@/lib/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DocTree } from "@/components/doc-tree";
import { FeedbackBanner } from "@/components/feedback-banner";
import { MarkdownView } from "@/components/markdown-view";
import { TableOfContents } from "@/components/table-of-contents";
import { Badge, cn, deleteButtonClass, editButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Heading = { id: string; text: string; level: number };

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const seen: Record<string, number> = {};
  for (const match of markdown.matchAll(/^(#{2,4})\s+(.+)$/gm)) {
    const level = match[1].length;
    const text = match[2].replace(/[`*_[\]]/g, "").trim();
    let id = text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w一-龥-]/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
    const count = seen[id] ?? 0;
    if (count > 0) id = `${id}-${count}`;
    seen[id] = count + 1;
    headings.push({ level, text, id });
  }
  return headings;
}

export default async function DocDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ slug }, query, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);

  const [doc, allDocs] = await Promise.all([
    prisma.techDoc.findUnique({
      where: { slug },
      include: { author: { select: { realName: true } } },
    }),
    prisma.techDoc.findMany({
      where: { published: true },
      select: { slug: true, title: true, division: true, team: true, path: true },
      orderBy: [{ division: "asc" }, { team: "asc" }, { order: "asc" }],
    }),
  ]);

  if (!doc) {
    notFound();
  }

  const currentUserId = session?.user?.id;
  const currentUserRole = session?.user?.role;
  const isAuthor = !!currentUserId && currentUserId === doc.authorId;
  const canDelete = isAuthor || currentUserRole === "ADMIN";

  const headings = extractHeadings(doc.content);

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-6 py-8 md:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_220px]">

        {/* ── Left: doc tree ─────────────────────────────────── */}
        <aside className="hidden md:block">
          <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4">
            <Link href="/docs" className="mb-3 block text-xs font-semibold text-primary hover:underline">
              ← 技术文档
            </Link>
            <DocTree allDocs={allDocs} currentSlug={slug} />
          </div>
        </aside>

        {/* ── Center: content ────────────────────────────────── */}
        <main className="min-w-0">
          {/* Mobile back link */}
          <div className="mb-4 md:hidden">
            <Link href="/docs" className="text-sm font-semibold text-primary">
              ← 返回文档列表
            </Link>
          </div>

          <FeedbackBanner error={query.error} success={query.success} />

          <div className="rounded-lg border border-border bg-surface p-5 sm:p-8">
            {/* Metadata bar */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <Badge tone={doc.division === "GENERAL" ? "blue" : "slate"}>
                {divisionLabels[doc.division]}
              </Badge>
              <Badge>{teamLabels[doc.team]}</Badge>
              {doc.path && <span className="text-xs text-text-secondary/70">{doc.path}</span>}
              <span className="ml-auto text-xs">
                {doc.author.realName} · 更新于 {doc.updatedAt.toLocaleDateString("zh-CN")}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black text-text-primary">{doc.title}</h1>
            {doc.excerpt ? (
              <p className="mt-2 text-base leading-relaxed text-text-secondary">{doc.excerpt}</p>
            ) : null}

            {(isAuthor || canDelete) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {isAuthor && (
                  <Link href={`/docs/${slug}/edit`} className={cn(editButtonClass, "text-xs px-3")}>
                    编辑文档
                  </Link>
                )}
                {canDelete && (
                  <ConfirmDelete
                    action={deleteDocAction}
                    fields={{ docId: doc.id, slug: doc.slug }}
                    message="确定要删除这篇文档吗？"
                    buttonLabel="删除文档"
                    buttonClassName={cn(deleteButtonClass, "text-xs px-3")}
                  />
                )}
              </div>
            )}

            <div className="mt-8">
              <MarkdownView content={doc.content} />
            </div>
          </div>
        </main>

        {/* ── Right: TOC ─────────────────────────────────────── */}
        <aside className="hidden xl:block">
          <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4">
            <TableOfContents initialHeadings={headings} />
          </div>
        </aside>

      </div>
    </div>
  );
}
