import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const [docs, posts] = q
    ? await Promise.all([
        prisma.techDoc.findMany({
          where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] },
          take: 10,
        }),
        prisma.forumPost.findMany({
          where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }, { tags: { has: q } }] },
          take: 10,
        }),
      ])
    : [[], []];
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black text-text-primary">全站搜索</h1>
      <form className="mt-5 flex gap-2">
        <input name="q" defaultValue={q} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" placeholder="搜索文档和论坛" />
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-bg">搜索</button>
      </form>
      <section className="mt-6 grid gap-4">
        {[...docs.map((doc) => ({ type: "文档", title: doc.title, href: `/docs/${doc.slug}` })), ...posts.map((post) => ({ type: "帖子", title: post.title, href: `/forum/${post.id}` }))].map((item) => (
          <Link key={`${item.type}-${item.href}`} href={item.href} className="rounded-lg border border-border bg-surface p-4 ">
            <Badge tone={item.type === "文档" ? "blue" : "amber"}>{item.type}</Badge>
            <h2 className="mt-2 font-bold text-text-primary">{item.title}</h2>
          </Link>
        ))}
      </section>
    </div>
  );
}
