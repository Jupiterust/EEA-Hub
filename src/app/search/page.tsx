import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { HighlightText } from "@/components/highlight-text";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const authorWhere = (author: string) => ({
  OR: [
    { realName: { contains: author, mode: "insensitive" as const } },
    { username: { contains: author, mode: "insensitive" as const } },
  ],
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; author?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const author = params.author?.trim() ?? "";

  const [docs, posts] =
    q || author
      ? await Promise.all([
          prisma.techDoc.findMany({
            where: {
              ...(q
                ? {
                    OR: [
                      { title: { contains: q, mode: "insensitive" } },
                      { content: { contains: q, mode: "insensitive" } },
                    ],
                  }
                : {}),
              ...(author ? { author: authorWhere(author) } : {}),
            },
            take: 10,
          }),
          prisma.forumPost.findMany({
            where: {
              ...(author ? { isAnonymous: false } : {}),
              ...(q
                ? {
                    OR: [
                      { title: { contains: q, mode: "insensitive" } },
                      { content: { contains: q, mode: "insensitive" } },
                      { tags: { has: q } },
                    ],
                  }
                : {}),
              ...(author ? { author: authorWhere(author) } : {}),
            },
            take: 10,
          }),
        ])
      : [[], []];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black text-text-primary">全站搜索</h1>
      <form className="mt-5 grid gap-2 sm:flex">
        <input
          name="q"
          defaultValue={q}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="搜索文档和论坛"
        />
        <input
          name="author"
          defaultValue={author}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-48"
          placeholder="按作者姓名/用户名"
        />
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-bg">搜索</button>
      </form>
      <section className="mt-6 grid gap-4">
        {[
          ...docs.map((doc) => ({ type: "文档" as const, title: doc.title, href: `/docs/${doc.slug}` })),
          ...posts.map((post) => ({ type: "帖子" as const, title: post.title, href: `/forum/${post.id}` })),
        ].map((item) => (
          <Link key={`${item.type}-${item.href}`} href={item.href} className="rounded-lg border border-border bg-surface p-4">
            <Badge tone={item.type === "文档" ? "blue" : "amber"}>{item.type}</Badge>
            <h2 className="mt-2 font-bold text-text-primary">
              <HighlightText text={item.title} query={q} />
            </h2>
          </Link>
        ))}
        {(q || author) && docs.length === 0 && posts.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
            暂无匹配结果。
          </div>
        )}
      </section>
    </div>
  );
}
