import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings, MessageSquare, ThumbsUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { Badge, cn } from "@/components/ui";
import { divisionLabels, roleLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Tab = "docs" | "posts" | "following" | "followers";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [currentUser, { userId }, { tab }] = await Promise.all([
    requireUser(),
    params,
    searchParams,
  ]);

  const activeTab: Tab =
    tab === "posts" ? "posts"
    : tab === "following" ? "following"
    : tab === "followers" ? "followers"
    : "docs";

  const isOwnProfile = currentUser.id === userId;

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
      _count: { select: { following: true, followers: true } },
    },
  });
  if (!profileUser) notFound();

  const [isFollowing, docs, posts, followingUsers, followerUsers] = await Promise.all([
    isOwnProfile
      ? Promise.resolve(false)
      : prisma.follow
          .findUnique({
            where: {
              followerId_followingId: { followerId: currentUser.id, followingId: userId },
            },
          })
          .then(Boolean),
    prisma.techDoc.findMany({
      where: { authorId: userId, published: true },
      select: {
        id: true,
        slug: true,
        title: true,
        division: true,
        team: true,
        updatedAt: true,
        _count: { select: { docLikes: true } },
      },
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
    activeTab === "following"
      ? prisma.follow.findMany({
          where: { followerId: userId },
          select: {
            followingId: true,
            following: {
              select: { id: true, realName: true, username: true, avatarUrl: true, bio: true },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([] as { followingId: string; following: { id: string; realName: string; username: string; avatarUrl: string | null; bio: string | null } }[]),
    activeTab === "followers"
      ? prisma.follow.findMany({
          where: { followingId: userId },
          select: {
            followerId: true,
            follower: {
              select: { id: true, realName: true, username: true, avatarUrl: true, bio: true },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([] as { followerId: string; follower: { id: string; realName: string; username: string; avatarUrl: string | null; bio: string | null } }[]),
  ]);

  // Check which users in the lists the current user already follows
  const listUserIds = [
    ...followingUsers.map((f) => f.followingId),
    ...followerUsers.map((f) => f.followerId),
  ];
  const currentUserFollowingSet =
    listUserIds.length > 0
      ? new Set(
          (
            await prisma.follow.findMany({
              where: { followerId: currentUser.id, followingId: { in: listUserIds } },
              select: { followingId: true },
            })
          ).map((f) => f.followingId)
        )
      : new Set<string>();

  const tabHref = (t: string) => `/profile/${userId}?tab=${t}`;

  const tabs = [
    { key: "docs" as const, label: `文档（${docs.length}）` },
    { key: "posts" as const, label: `帖子（${posts.length}）` },
    { key: "following" as const, label: `关注（${profileUser._count.following}）` },
    { key: "followers" as const, label: `粉丝（${profileUser._count.followers}）` },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Profile card */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar url={profileUser.avatarUrl} size="2xl" alt={profileUser.realName} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-text-primary">{profileUser.realName}</h1>
                <p className="mt-0.5 text-sm text-text-secondary">@{profileUser.username}</p>
              </div>
              {isOwnProfile ? (
                <Link
                  href="/dashboard"
                  className="rounded-md p-2 text-text-secondary hover:bg-elevated hover:text-text-primary"
                  aria-label="前往设置"
                >
                  <Settings className="h-5 w-5" />
                </Link>
              ) : (
                <FollowButton followingId={userId} initialIsFollowing={isFollowing} />
              )}
            </div>

            {profileUser.bio && (
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">{profileUser.bio}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
              {(profileUser.major || profileUser.grade) && (
                <span>{[profileUser.major, profileUser.grade].filter(Boolean).join(" · ")}</span>
              )}
              {profileUser.qq && <span>QQ: {profileUser.qq}</span>}
              <Link href={tabHref("following")} className="hover:text-primary hover:underline">
                <span className="font-semibold text-text-primary">{profileUser._count.following}</span> 关注
              </Link>
              <Link href={tabHref("followers")} className="hover:text-primary hover:underline">
                <span className="font-semibold text-text-primary">{profileUser._count.followers}</span> 粉丝
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{divisionLabels[profileUser.division]}</Badge>
              <Badge>{teamLabels[profileUser.team]}</Badge>
              <Badge
                tone={
                  profileUser.role === "ADMIN"
                    ? "red"
                    : profileUser.role === "LEADER"
                      ? "amber"
                      : "slate"
                }
              >
                {roleLabels[profileUser.role]}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border">
        {tabs.map(({ key, label }) => (
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
                  <Badge tone={doc.division === "GENERAL" ? "blue" : "slate"}>
                    {divisionLabels[doc.division]}
                  </Badge>
                </div>
                <h2 className="mt-3 text-lg font-black text-text-primary">{doc.title}</h2>
                <div className="mt-2 flex items-center gap-3 text-sm text-text-secondary">
                  <span>{doc.updatedAt.toLocaleDateString("zh-CN")}</span>
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="size-4" /> {doc._count.docLikes}
                  </span>
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
                  <Badge tone={post.isSolved ? "green" : "amber"}>
                    {post.isSolved ? "已解决" : "讨论中"}
                  </Badge>
                  <Badge>{divisionLabels[post.division]}</Badge>
                  {post.tags.map((tag) => (
                    <Badge key={tag} tone="blue">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <h2 className="mt-3 text-lg font-black text-text-primary">{post.title}</h2>
                <div className="mt-2 flex items-center gap-3 text-sm text-text-secondary">
                  <span>{post.createdAt.toLocaleDateString("zh-CN")}</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-4" /> {post._count.replies}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="size-4" /> {post._count.postLikes}
                  </span>
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

        {activeTab === "following" && (
          <>
            {followingUsers.map(({ followingId: uid, following: u }) => (
              <div
                key={uid}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
              >
                <Avatar url={u.avatarUrl} size="md" alt={u.realName} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${u.id}`}
                    className="font-semibold text-text-primary hover:text-primary hover:underline"
                  >
                    {u.realName}
                  </Link>
                  <p className="text-xs text-text-secondary">@{u.username}</p>
                  {u.bio && (
                    <p className="mt-0.5 line-clamp-1 text-sm text-text-secondary">{u.bio}</p>
                  )}
                </div>
                {u.id !== currentUser.id && (
                  <FollowButton
                    followingId={u.id}
                    initialIsFollowing={currentUserFollowingSet.has(u.id)}
                  />
                )}
              </div>
            ))}
            {followingUsers.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
                暂未关注任何人。
              </div>
            )}
          </>
        )}

        {activeTab === "followers" && (
          <>
            {followerUsers.map(({ followerId: uid, follower: u }) => (
              <div
                key={uid}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
              >
                <Avatar url={u.avatarUrl} size="md" alt={u.realName} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${u.id}`}
                    className="font-semibold text-text-primary hover:text-primary hover:underline"
                  >
                    {u.realName}
                  </Link>
                  <p className="text-xs text-text-secondary">@{u.username}</p>
                  {u.bio && (
                    <p className="mt-0.5 line-clamp-1 text-sm text-text-secondary">{u.bio}</p>
                  )}
                </div>
                {u.id !== currentUser.id && (
                  <FollowButton
                    followingId={u.id}
                    initialIsFollowing={currentUserFollowingSet.has(u.id)}
                  />
                )}
              </div>
            ))}
            {followerUsers.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-text-secondary">
                暂无粉丝。
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
