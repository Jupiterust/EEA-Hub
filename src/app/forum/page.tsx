import Link from "next/link";
import { MessageSquare, Plus, Search, ThumbsUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/avatar";
import { Badge, cn, secondaryButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

const sortOptions = [
  { value: "latest", label: "最新发布" },
  { value: "replies", label: "最多回复" },
  { value: "likes", label: "最多点赞" },
] as const;

type SortValue = (typeof sortOptions)[number]["value"];

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim();
  const sort: SortValue = (params.sort as SortValue) ?? "latest";

  const orderBy =
    sort === "replies"
      ? { replies: { _count: "desc" as const } }
      : sort === "likes"
        ? { postLikes: { _count: "desc" as const } }
        : { createdAt: "desc" as const };

  const posts = await prisma.forumPost.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { content: { contains: q, mode: "insensitive" } },
            { tags: { has: q } },
          ],
        }
      : undefined,
    include: {
      author: { select: { realName: true, username: true, avatarUrl: true } },
      _count: { select: { replies: true, postLikes: true } },
    },
    orderBy,
  });

  const sortHref = (s: string) =>
    q ? `/forum?q=${encodeURIComponent(q)}&sort=${s}` : `/forum?sort=${s}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black text-text-primary">技术论坛</h1>
          <p className="mt-2 text-text-secondary">技术提问、经验交流、实名或匿名回复。</p>
        </div>
        <Link href="/forum/new" className={`${secondaryButtonClass} gap-2`}>
          <Plus className="size-4" /> 发帖
        </Link>
      </div>
      <form className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-text-secondary" />
          <input name="q" defaultValue={q} placeholder="搜索帖子、正文或标签" className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        <button className={secondaryButtonClass}>搜索</button>
      </form>

      <div className="mt-4 flex gap-1">
        {sortOptions.map((opt) => (
          <Link
            key={opt.value}
            href={sortHref(opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold transition",
              sort === opt.value
                ? "bg-primary/20 text-primary"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <section className="mt-4 grid gap-3">
        {posts.map((post) => (
          <Link key={post.id} href={`/forum/${post.id}`} className="rounded-lg border border-border bg-surface p-5 transition hover:border-primary/40">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={post.isSolved ? "green" : "amber"}>{post.isSolved ? "已解决" : "讨论中"}</Badge>
              <Badge>{divisionLabels[post.division]}</Badge>
              <Badge>{teamLabels[post.team]}</Badge>
              {post.tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}
            </div>
            <h2 className="mt-3 text-xl font-black text-text-primary">{post.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">{post.content}</p>
            <div className="mt-4 flex items-center gap-3 text-sm text-text-secondary">
              <Avatar
                url={post.isAnonymous ? null : post.author.avatarUrl}
                anonymous={post.isAnonymous}
                size="xs"
                alt={post.isAnonymous ? "匿名" : post.author.realName}
              />
              <span>{post.isAnonymous ? "匿名楼主" : post.author.realName}</span>
              <span className="inline-flex items-center gap-1"><MessageSquare className="size-4" /> {post._count.replies}</span>
              <span className="inline-flex items-center gap-1"><ThumbsUp className="size-4" /> {post._count.postLikes}</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
