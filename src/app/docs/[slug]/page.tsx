import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteDocAction } from "@/lib/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FeedbackBanner } from "@/components/feedback-banner";
import { MarkdownView } from "@/components/markdown-view";
import { Badge, cn, deleteButtonClass, editButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

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

  const doc = await prisma.techDoc.findUnique({
    where: { slug },
    include: { author: { select: { realName: true } } },
  });
  if (!doc) {
    notFound();
  }

  const currentUserId = session?.user?.id;
  const currentUserRole = session?.user?.role;
  const isAuthor = !!currentUserId && currentUserId === doc.authorId;
  const canDelete = isAuthor || currentUserRole === "ADMIN";

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-border bg-surface p-4">
        <Link href="/docs" className="text-sm font-semibold text-primary">
          返回文档列表
        </Link>
        <div className="mt-4 grid gap-2 text-sm text-text-secondary">
          <Badge tone="blue">{divisionLabels[doc.division]}</Badge>
          <Badge>{teamLabels[doc.team]}</Badge>
          <p>{doc.path}</p>
          <p>作者：{doc.author.realName}</p>
          <p>更新：{doc.updatedAt.toLocaleString("zh-CN")}</p>
        </div>
        {(isAuthor || canDelete) && (
          <div className="mt-4 grid gap-2">
            {isAuthor && (
              <Link href={`/docs/${slug}/edit`} className={cn(editButtonClass, "w-full justify-center")}>
                编辑文档
              </Link>
            )}
            {canDelete && (
              <ConfirmDelete
                action={deleteDocAction}
                fields={{ docId: doc.id, slug: doc.slug }}
                message="确定要删除这篇文档吗？"
                buttonLabel="删除文档"
                buttonClassName={cn(deleteButtonClass, "w-full justify-center")}
              />
            )}
          </div>
        )}
      </aside>
      <section className="rounded-lg border border-border bg-surface p-5 sm:p-8">
        <FeedbackBanner error={query.error} success={query.success} />
        <h1 className="mt-4 text-3xl font-black text-text-primary first:mt-0">{doc.title}</h1>
        {doc.excerpt ? <p className="mt-3 text-text-secondary">{doc.excerpt}</p> : null}
        <div className="mt-8">
          <MarkdownView content={doc.content} />
        </div>
      </section>
    </div>
  );
}
