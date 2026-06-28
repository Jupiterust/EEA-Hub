import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { MarkdownView } from "@/components/markdown-view";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

export default async function DocHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const user = await requireUser();
  const [{ slug }, { v: versionId }] = await Promise.all([params, searchParams]);

  const doc = await prisma.techDoc.findUnique({
    where: { slug },
    select: { id: true, title: true, authorId: true },
  });
  if (!doc) notFound();

  const isAuthor = user.id === doc.authorId;
  const isAdmin = user.role === "ADMIN";
  if (!isAuthor && !isAdmin) redirect(`/docs/${slug}`);

  const versions = await prisma.docVersion.findMany({
    where: { docId: doc.id },
    include: { editor: { select: { id: true, realName: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const selectedVersion = versionId
    ? versions.find((v) => v.id === versionId)
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <History className="size-5 text-text-secondary" />
        <div>
          <Link href={`/docs/${slug}`} className="text-sm font-semibold text-primary hover:underline">
            ← {doc.title}
          </Link>
          <h1 className="mt-0.5 text-2xl font-black text-text-primary">历史版本</h1>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
          暂无历史版本记录。文档被编辑保存后将在此处显示版本快照。
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Version list */}
          <aside>
            <div className="sticky top-20 rounded-lg border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-text-secondary">共 {versions.length} 个版本</p>
              </div>
              <ul className="max-h-[calc(100vh-12rem)] overflow-y-auto divide-y divide-border">
                {versions.map((v, i) => {
                  const isSelected = v.id === versionId;
                  const versionNumber = versions.length - i;
                  return (
                    <li key={v.id}>
                      <Link
                        href={`/docs/${slug}/history?v=${v.id}`}
                        className={`flex items-start gap-3 px-4 py-3 transition hover:bg-elevated ${isSelected ? "bg-primary/10" : ""}`}
                      >
                        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-bold text-text-secondary">
                          {versionNumber}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold truncate ${isSelected ? "text-primary" : "text-text-primary"}`}>
                            {v.title}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
                            <Avatar url={v.editor.avatarUrl} size="xs" alt={v.editor.realName} />
                            <span className="truncate">{v.editor.realName}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {v.createdAt.toLocaleString("zh-CN")}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Version content */}
          <main>
            {selectedVersion ? (
              <div className="rounded-lg border border-border bg-surface p-6">
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <h2 className="text-xl font-black text-text-primary">{selectedVersion.title}</h2>
                    <div className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
                      <Avatar url={selectedVersion.editor.avatarUrl} size="xs" alt={selectedVersion.editor.realName} />
                      <Link href={`/profile/${selectedVersion.editor.id}`} className="hover:text-primary hover:underline">
                        {selectedVersion.editor.realName}
                      </Link>
                      <span>·</span>
                      <span>{selectedVersion.createdAt.toLocaleString("zh-CN")}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-elevated px-2 py-1 text-xs font-semibold text-text-secondary">
                    第 {versions.length - versions.findIndex((v) => v.id === selectedVersion.id)} 版
                  </span>
                </div>
                <MarkdownView content={selectedVersion.content} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-surface text-text-secondary">
                ← 从左侧选择一个版本查看内容
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
