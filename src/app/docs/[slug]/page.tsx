import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MarkdownView } from "@/components/markdown-view";
import { Badge } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await prisma.techDoc.findUnique({
    where: { slug },
    include: { author: { select: { realName: true } } },
  });
  if (!doc) {
    notFound();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-border bg-surface p-4 ">
        <Link href="/docs" className="text-sm font-semibold text-primary">返回文档列表</Link>
        <div className="mt-4 grid gap-2 text-sm text-text-secondary">
          <Badge tone="blue">{divisionLabels[doc.division]}</Badge>
          <Badge>{teamLabels[doc.team]}</Badge>
          <p>{doc.path}</p>
          <p>作者：{doc.author.realName}</p>
          <p>更新：{doc.updatedAt.toLocaleString("zh-CN")}</p>
        </div>
      </aside>
      <section className="rounded-lg border border-border bg-surface p-5  sm:p-8">
        <h1 className="text-3xl font-black text-text-primary">{doc.title}</h1>
        {doc.excerpt ? <p className="mt-3 text-text-secondary">{doc.excerpt}</p> : null}
        <div className="mt-8">
          <MarkdownView content={doc.content} />
        </div>
      </section>
    </div>
  );
}
