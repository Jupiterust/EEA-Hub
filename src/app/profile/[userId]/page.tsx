import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, ThumbsUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { Avatar } from "@/components/avatar";
import { Badge, cn } from "@/components/ui";
import { divisionLabels, roleLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser();
  const [{ userId }, { tab }] = await Promise.all([params, searchParams]);
  const activeTab = tab === "posts" ? "posts" : "docs";

  const profileUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      realName: true,
      avatarUrl: true,
      bio: true,
      major: true,
      grade: true,
      qq: true,
      division: true,
      team: true,
      role: true,
    },
  });
  if (!profileUser) notFound();

  const [docs, posts] = await Promise.all([
    prisma.techDoc.findMany({
      where: { authorId: userId, published: true },
      select: { id: true, slug: true, title: true, division: true, team: true, updatedAt: true, _count: { select: { docLikes: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.forumPost.findMany({
      where: { authorId: userId, isAnonymous: false },
      select: {
        id: true,
        title: true,
        isSolved: true,
        division: true,
        team: true,
        tags: true,
        createdAt: true,
        _count: { select: { replies: true, postLikes: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const tabHref = (t: string) => `/profile/${userId}?tab=${t}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Profile card */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar url={profileUser.avatarUrl} size="2xl" alt={profileUser.realName} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-text-primary">{profileUser.realName}</h1>
            <p className="mt-0.5 text-sm text-text-secondary">@{profileUser.username}</p>
            {profileUser.bio && (
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">{profileUser.bio}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-text-secondary">
              {(profileUser.major || profileUser.grade) && (
                <span>{[profileUser.major, profileUser.grade].filter(Boolean).join(" · ")}</span>
              )}
              {profileUser.qq && <span>QQ: {profileUser.qq}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{divisionLabels[profileUser.division]}</Badge>
              <Badge>{teamLabels[profileUser.team]}</Badge>
              <Badge tone={profileUser.role === "ADMIN" ? "red" : profileUser.role === "LEADER" ? "amber" : "slate"}>
                {roleLabels[profileUser.role]}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border pb-0">
        {([
          { key: "docs", label: `发布的文档（${docs.length}）` },
          { key: "posts", label: `发布的帖子（${posts.length}）` },
        ] as const).map(({ key, label }) => (
          <Link
            key={key}
            href={tabHref(key)}
            className={cn(
              "rounded-t-md px-4 py-2 text-sm font-semibold transition",
              activeTab === key
                ? "border border-b-surface border-border bg-surface text-primary"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <section className="mt-4 grid gap-3">
        {activeTab === "docs" && (
          <>
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/docs/${doc.slug}`}
                className="rounded-lg border border-border bg-surface p-5 transition hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={doc.division === "GENERAL" ? "blue" : "slate"}>{divisionLabels[doc.division]}</Badge>
                  <Badge>{teamLabels[doc.team]}</Badge>
                </div>
                <h2 className="mt-3 text-lg font-black text-text-primary">{doc.title}</h2>
                <div className="mt-2 flex items-center gap-3 text-sm text-text-secondary">
                  <span>{doc.updatedAt.toLocaleDateString("zh-CN")}</span>
                  <span className="inline-flex items-center gap-1"><ThumbsUp className="size-4" /> {doc._count.docLikes}</span>
                </div>
              </Link>
            ))}
            {docs.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
                暂无发布的文档。
              </div>
            )}
          </>
        )}

        {activeTab === "posts" && (
          <>
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/forum/${post.id}`}
                className="rounded-lg border border-border bg-surface p-5 transition hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={post.isSolved ? "green" : "amber"}>{post.isSolved ? "已解决" : "讨论中"}</Badge>
                  <Badge>{divisionLabels[post.division]}</Badge>
                  <Badge>{teamLabels[post.team]}</Badge>
                  {post.tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}
                </div>
                <h2 className="mt-3 text-lg font-black text-text-primary">{post.title}</h2>
                <div className="mt-2 flex items-center gap-3 text-sm text-text-secondary">
                  <span>{post.createdAt.toLocaleDateString("zh-CN")}</span>
                  <span className="inline-flex items-center gap-1"><MessageSquare className="size-4" /> {post._count.replies}</span>
                  <span className="inline-flex items-center gap-1"><ThumbsUp className="size-4" /> {post._count.postLikes}</span>
                </div>
              </Link>
            ))}
            {posts.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
                暂无实名帖子。
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
