import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HighlightText } from "@/components/highlight-text";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const authorWhere = (author: string) => ({
  OR: [
    { realName: { contains: author, mode: "insensitive" as const } },
    { username: { contains: author, mode: "insensitive" as const } },
  ],
});

type ResultItem = { type: "文档" | "帖子" | "作业"; title: string; href: string };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; author?: string; page?: string }>;
}) {
  const [params, session] = await Promise.all([searchParams, auth()]);
  const q = params.q?.trim() ?? "";
  const author = params.author?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  let allResults: ResultItem[] = [];

  if (q || author) {
    const [docs, posts, assignments] = await Promise.all([
      prisma.techDoc.findMany({
        where: {
          ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] } : {}),
          ...(author ? { author: authorWhere(author) } : {}),
        },
        select: { title: true, slug: true },
      }),
      prisma.forumPost.findMany({
        where: {
          ...(author ? { isAnonymous: false } : {}),
          ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }, { tags: { has: q } }] } : {}),
          ...(author ? { author: authorWhere(author) } : {}),
        },
        select: { id: true, title: true },
      }),
      q && session?.user
        ? prisma.assignment.findMany({
            where: {
              title: { contains: q, mode: "insensitive" },
              ...(session.user.role !== "ADMIN"
                ? { division: session.user.division, OR: [{ team: "GENERAL" }, { team: session.user.team }] }
                : {}),
            },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

    allResults = [
      ...docs.map((doc) => ({ type: "文档" as const, title: doc.title, href: `/docs/${doc.slug}` })),
      ...posts.map((post) => ({ type: "帖子" as const, title: post.title, href: `/forum/${post.id}` })),
      ...assignments.map((a) => ({ type: "作业" as const, title: a.title, href: `/assignments/${a.id}` })),
    ];
  }

  const total = allResults.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const results = allResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function buildHref(p: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (author) sp.set("author", author);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black text-text-primary">全站搜索</h1>
      <form className="mt-5 grid gap-2 sm:flex">
        <input
          name="q"
          defaultValue={q}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="搜索文档、论坛和作业"
        />
        <input
          name="author"
          defaultValue={author}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-48"
          placeholder="按作者姓名/用户名"
        />
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-bg">搜索</button>
      </form>

      {(q || author) && total > 0 && (
        <p className="mt-4 text-sm text-text-secondary">共 {total} 条结果</p>
      )}

      <section className="mt-4 grid gap-4">
        {results.map((item) => (
          <Link key={`${item.type}-${item.href}`} href={item.href} className="rounded-lg border border-border bg-surface p-4">
            <Badge tone={item.type === "文档" ? "blue" : item.type === "帖子" ? "amber" : "green"}>{item.type}</Badge>
            <h2 className="mt-2 font-bold text-text-primary">
              <HighlightText text={item.title} query={q} />
            </h2>
          </Link>
        ))}
        {(q || author) && results.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
            暂无匹配结果。
          </div>
        )}
      </section>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
