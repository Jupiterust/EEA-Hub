import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, ThumbsUp } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { prisma } from "@/lib/prisma";
import { acceptReplyAction, deletePostAction, deleteReplyAction, replyAction, reportAction, togglePostLikeAction, toggleReplyLikeAction, toggleSolvedAction, unacceptReplyAction, updateReplyAction } from "@/lib/actions";
import { requireUser } from "@/lib/authz";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FeedbackBanner } from "@/components/feedback-banner";
import { ImageLightbox } from "@/components/image-lightbox";
import { InlineReplyForm } from "@/components/inline-reply-form";
import { MarkdownView } from "@/components/markdown-view";
import { SubmitButton } from "@/components/submit-button";
import { Badge, cn, deleteButtonClass, deleteLinkClass, editButtonClass, editLinkClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ForumDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; editReply?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const post = await prisma.forumPost.findUnique({
    where: { id },
    include: {
      author: { select: { realName: true, username: true, avatarUrl: true } },
      _count: { select: { postLikes: true } },
      postLikes: { where: { userId: user.id }, select: { userId: true } },
      replies: {
        include: {
          author: { select: { realName: true, username: true, avatarUrl: true } },
          _count: { select: { replyLikes: true } },
          replyLikes: { where: { userId: user.id }, select: { userId: true } },
          replyTo: {
            select: {
              id: true,
              authorId: true,
              isAnonymous: true,
              author: { select: { realName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!post) {
    notFound();
  }

  const isPostAuthor = user.id === post.authorId;
  const canDeletePost = isPostAuthor || user.role === "ADMIN";
  const userLikedPost = post.postLikes.length > 0;
  const postLikeCount = post._count.postLikes;

  // Build anonymous label map from ALL replies in creation order
  const anonymousLabels = new Map<string, string>();
  let anonymousIndex = 0;
  for (const reply of post.replies) {
    if (!reply.isAnonymous) continue;
    if (post.isAnonymous && reply.authorId === post.authorId) {
      anonymousLabels.set(reply.authorId, "匿名楼主");
      continue;
    }
    if (!anonymousLabels.has(reply.authorId)) {
      anonymousLabels.set(reply.authorId, `匿名用户${anonymousLetter(anonymousIndex)}`);
      anonymousIndex += 1;
    }
  }

  // Separate main replies (parentId = null) from sub-replies
  const mainReplies = post.replies.filter((r) => r.parentId === null);
  const subRepliesMap = new Map<string, typeof post.replies>();
  for (const reply of post.replies) {
    if (reply.parentId !== null) {
      const bucket = subRepliesMap.get(reply.parentId) ?? [];
      bucket.push(reply);
      subRepliesMap.set(reply.parentId, bucket);
    }
  }

  // Sort main replies: accepted first, then by createdAt asc
  const sortedMainReplies = [...mainReplies].sort((a, b) => {
    if (a.isAccepted !== b.isAccepted) return a.isAccepted ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const editReplyId = query.editReply;

  function getDisplayName(reply: { isAnonymous: boolean; authorId: string; author: { realName: string } }) {
    return reply.isAnonymous
      ? (anonymousLabels.get(reply.authorId) ?? "匿名用户")
      : reply.author.realName;
  }

  function getAtLabel(replyTo: { authorId: string; isAnonymous: boolean; author: { realName: string } } | null) {
    if (!replyTo) return null;
    return replyTo.isAnonymous
      ? (anonymousLabels.get(replyTo.authorId) ?? "匿名用户")
      : replyTo.author.realName;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4">
        <FeedbackBanner error={query.error} success={query.success} />
      </div>
      <article className="rounded-lg border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={post.isSolved ? "green" : "amber"}>{post.isSolved ? "已解决" : "讨论中"}</Badge>
          <Badge>{divisionLabels[post.division]}</Badge>
          <Badge>{teamLabels[post.team]}</Badge>
          {post.tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}
        </div>
        <h1 className="mt-4 text-3xl font-black text-text-primary">{post.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
          <Avatar
            url={post.isAnonymous ? null : post.author.avatarUrl}
            anonymous={post.isAnonymous}
            size="sm"
            alt={post.isAnonymous ? "匿名" : post.author.realName}
          />
          <span>{post.isAnonymous ? "匿名楼主" : post.author.realName} · {post.createdAt.toLocaleString("zh-CN")}</span>
        </div>
        <div className="mt-6 rounded-md bg-elevated p-4">
          <MarkdownView content={post.content} />
        </div>
        <ImageLightbox images={post.imageUrls.map((url, index) => ({ url, alt: `${post.title} 配图 ${index + 1}` }))} />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isPostAuthor && (
            <Link href={`/forum/${post.id}/edit`} className={cn(editButtonClass, "px-3 py-1.5 text-xs")}>
              编辑帖子
            </Link>
          )}
          {canDeletePost && (
            <ConfirmDelete
              action={deletePostAction}
              fields={{ postId: post.id }}
              message="确定要删除这个帖子吗？帖子下的所有回复也会一并删除。"
              buttonLabel="删除帖子"
              buttonClassName={cn(deleteButtonClass, "px-3 py-1.5 text-xs")}
            />
          )}
          {isPostAuthor && (
            <form action={toggleSolvedAction}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
              <SubmitButton variant="secondary" pendingText="..." className="px-3 py-1.5 text-xs">
                {post.isSolved ? "取消已解决" : "标记已解决"}
              </SubmitButton>
            </form>
          )}
          <form action={togglePostLikeAction} className="ml-auto">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
            <SubmitButton
              variant="secondary"
              pendingText="..."
              className={cn(
                "gap-1.5 px-3 py-1.5 text-xs",
                userLikedPost && "border-success/40 bg-success/10 text-success hover:bg-success/20",
              )}
            >
              <ThumbsUp className="size-3.5" />
              {userLikedPost ? "已点赞" : "点赞"} {postLikeCount > 0 ? postLikeCount : ""}
            </SubmitButton>
          </form>
          <form action={reportAction} className="flex gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
            <input name="reason" placeholder="举报原因" className={`${inputClass} py-1.5 text-xs`} />
            <SubmitButton variant="secondary" pendingText="提交中..." className="px-3 py-1.5 text-xs">举报</SubmitButton>
          </form>
        </div>
      </article>

      {/* Reply list */}
      <section className="mt-6 grid gap-3">
        <h2 className="text-xl font-black text-text-primary">
          回复 {post.replies.length > 0 && <span className="text-base font-normal text-text-secondary">({post.replies.length})</span>}
        </h2>

        {sortedMainReplies.map((reply) => {
          const authorLabel = getDisplayName(reply);
          const isReplyAuthor = user.id === reply.authorId;
          const canDelete = isReplyAuthor || user.role === "ADMIN";
          const isEditing = editReplyId === reply.id && isReplyAuthor;
          const userLikedReply = reply.replyLikes.length > 0;
          const subReplies = subRepliesMap.get(reply.id) ?? [];

          return (
            <div
              key={reply.id}
              id={`reply-${reply.id}`}
              className={cn(
                "scroll-mt-20 rounded-lg border bg-surface",
                reply.isAccepted ? "border-success/40 ring-1 ring-success/20" : "border-border",
              )}
            >
              {/* Main reply — soft-deleted placeholder */}
              {reply.isDeleted ? (
                <div className="p-5">
                  <p className="text-sm italic text-text-secondary">[该回复已删除]</p>
                </div>
              ) : (
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar
                    url={reply.isAnonymous ? null : reply.author.avatarUrl}
                    anonymous={reply.isAnonymous}
                    size="xs"
                    alt={authorLabel}
                  />
                  <span className="text-sm text-text-secondary">
                    {authorLabel} · {reply.createdAt.toLocaleString("zh-CN")}
                  </span>
                  {reply.isAccepted && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-semibold text-success ring-1 ring-success/35">
                      <CheckCircle className="size-3.5" /> 最佳答案
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <form action={updateReplyAction} className="mt-3 grid gap-3">
                    <input type="hidden" name="replyId" value={reply.id} />
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                    <textarea name="content" defaultValue={reply.content} className={`${inputClass} font-mono`} rows={6} required />
                    <div className="flex gap-2">
                      <SubmitButton pendingText="保存中..." className="px-3 py-1.5 text-xs">保存</SubmitButton>
                      <Link href={`/forum/${post.id}`} className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}>取消</Link>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="mt-3">
                      <MarkdownView content={reply.content} />
                    </div>
                    <ImageLightbox images={reply.imageUrls.map((url, index) => ({ url, alt: `回复配图 ${index + 1}` }))} />
                  </>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isReplyAuthor && !isEditing && (
                    <Link href={`/forum/${post.id}?editReply=${reply.id}`} className={editLinkClass}>编辑</Link>
                  )}
                  {canDelete && (
                    <ConfirmDelete
                      action={deleteReplyAction}
                      fields={{ replyId: reply.id, postId: post.id }}
                      message={
                        subReplies.length > 0
                          ? `确定要删除这条回复吗？该回复下还有 ${subReplies.length} 条楼中楼回复，删除后将显示为"[该回复已删除]"占位，子回复仍保留。`
                          : "确定要删除这条回复吗？"
                      }
                      buttonLabel="删除"
                      buttonClassName={deleteLinkClass}
                    />
                  )}
                  {isPostAuthor && !isEditing && (
                    reply.isAccepted ? (
                      <form action={unacceptReplyAction}>
                        <input type="hidden" name="replyId" value={reply.id} />
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                        <SubmitButton variant="secondary" pendingText="..." className="px-2 py-1 text-xs border-success/40 bg-success/10 text-success hover:bg-success/20">
                          取消采纳
                        </SubmitButton>
                      </form>
                    ) : (
                      <form action={acceptReplyAction}>
                        <input type="hidden" name="replyId" value={reply.id} />
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                        <SubmitButton variant="secondary" pendingText="..." className="px-2 py-1 text-xs">
                          采纳为最佳答案
                        </SubmitButton>
                      </form>
                    )
                  )}
                  {!isEditing && (
                    <InlineReplyForm
                      postId={post.id}
                      parentId={reply.id}
                      replyToId={reply.id}
                      atLabel={authorLabel}
                    />
                  )}
                  <form action={toggleReplyLikeAction} className="ml-auto">
                    <input type="hidden" name="replyId" value={reply.id} />
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                    <SubmitButton
                      variant="secondary"
                      pendingText="..."
                      className={cn(
                        "gap-1 px-2 py-1 text-xs",
                        userLikedReply && "border-success/40 bg-success/10 text-success hover:bg-success/20",
                      )}
                    >
                      <ThumbsUp className="size-3" />
                      {reply._count.replyLikes > 0 ? reply._count.replyLikes : ""}
                    </SubmitButton>
                  </form>
                  {!isEditing && (
                    <form action={reportAction} className="flex gap-2">
                      <input type="hidden" name="replyId" value={reply.id} />
                      <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                      <input name="reason" placeholder="举报原因" className={`${inputClass} py-1 text-xs`} />
                      <SubmitButton variant="secondary" pendingText="提交中..." className="px-2 py-1 text-xs">举报</SubmitButton>
                    </form>
                  )}
                </div>
              </div>
              )}

              {/* Sub-replies */}
              {subReplies.length > 0 && (
                <div className="border-t border-border/60">
                  {subReplies.map((sub, subIndex) => {
                    const subLabel = getDisplayName(sub);
                    const atLabel = getAtLabel(sub.replyTo);
                    const isSubAuthor = user.id === sub.authorId;
                    const canDeleteSub = isSubAuthor || user.role === "ADMIN";
                    const isEditingSub = editReplyId === sub.id && isSubAuthor;
                    const userLikedSub = sub.replyLikes.length > 0;

                    return (
                      <div
                        key={sub.id}
                        id={`reply-${sub.id}`}
                        className={cn(
                          "scroll-mt-20 px-5 py-3 sm:pl-10",
                          subIndex < subReplies.length - 1 && "border-b border-border/40",
                          "bg-elevated/20",
                        )}
                      >
                        {sub.isDeleted ? (
                          <p className="text-sm italic text-text-secondary">[该回复已删除]</p>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <Avatar
                                url={sub.isAnonymous ? null : sub.author.avatarUrl}
                                anonymous={sub.isAnonymous}
                                size="xs"
                                alt={subLabel}
                              />
                              <span className="text-xs text-text-secondary">
                                <span className="font-medium text-text-primary">{subLabel}</span>
                                {atLabel && sub.replyToId && (
                                  <span className="mx-1">
                                    回复{" "}
                                    <a
                                      href={`#reply-${sub.replyToId}`}
                                      className="text-primary hover:underline"
                                    >
                                      @{atLabel}
                                    </a>
                                  </span>
                                )}
                                · {sub.createdAt.toLocaleString("zh-CN")}
                              </span>
                            </div>

                            {isEditingSub ? (
                              <form action={updateReplyAction} className="mt-2 grid gap-2">
                                <input type="hidden" name="replyId" value={sub.id} />
                                <input type="hidden" name="postId" value={post.id} />
                                <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                                <textarea name="content" defaultValue={sub.content} className={`${inputClass} font-mono text-sm`} rows={4} required />
                                <div className="flex gap-2">
                                  <SubmitButton pendingText="保存中..." className="px-3 py-1.5 text-xs">保存</SubmitButton>
                                  <Link href={`/forum/${post.id}`} className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}>取消</Link>
                                </div>
                              </form>
                            ) : (
                              <>
                                <div className="mt-2 text-sm text-text-primary">
                                  <MarkdownView content={sub.content} />
                                </div>
                                <ImageLightbox images={sub.imageUrls.map((url, index) => ({ url, alt: `楼中楼配图 ${index + 1}` }))} />
                              </>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {isSubAuthor && !isEditingSub && (
                                <Link href={`/forum/${post.id}?editReply=${sub.id}`} className={editLinkClass}>编辑</Link>
                              )}
                              {canDeleteSub && (
                                <ConfirmDelete
                                  action={deleteReplyAction}
                                  fields={{ replyId: sub.id, postId: post.id }}
                                  message="确定要删除这条楼中楼回复吗？"
                                  buttonLabel="删除"
                                  buttonClassName={deleteLinkClass}
                                />
                              )}
                              {!isEditingSub && (
                                <InlineReplyForm
                                  postId={post.id}
                                  parentId={reply.id}
                                  replyToId={sub.id}
                                  atLabel={subLabel}
                                />
                              )}
                              <form action={toggleReplyLikeAction} className="ml-auto">
                                <input type="hidden" name="replyId" value={sub.id} />
                                <input type="hidden" name="postId" value={post.id} />
                                <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                                <SubmitButton
                                  variant="secondary"
                                  pendingText="..."
                                  className={cn(
                                    "gap-1 px-2 py-1 text-xs",
                                    userLikedSub && "border-success/40 bg-success/10 text-success hover:bg-success/20",
                                  )}
                                >
                                  <ThumbsUp className="size-3" />
                                  {sub._count.replyLikes > 0 ? sub._count.replyLikes : ""}
                                </SubmitButton>
                              </form>
                              {!isEditingSub && (
                                <form action={reportAction} className="flex gap-2">
                                  <input type="hidden" name="replyId" value={sub.id} />
                                  <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                                  <input name="reason" placeholder="举报原因" className={`${inputClass} py-1 text-xs`} />
                                  <SubmitButton variant="secondary" pendingText="提交中..." className="px-2 py-1 text-xs">举报</SubmitButton>
                                </form>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* New top-level reply form */}
      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-black text-text-primary">添加回复</h2>
        <form action={replyAction} className="mt-4 grid gap-4">
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
          <textarea name="content" className={`${inputClass} font-mono`} rows={8} required />
          <label className="grid gap-1.5 text-sm font-semibold text-text-primary">
            <span>配图（选填，最多 9 张 jpg/png/webp）</span>
            <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <input name="isAnonymous" type="checkbox" className="size-4" />
            匿名回复
          </label>
          <SubmitButton pendingText="回复中...">回复</SubmitButton>
        </form>
        <p className="mt-3 text-xs text-text-secondary">
          当前身份：{user.name}。匿名内容前端不会展示真实身份，后台追溯需要管理员写入审计日志。
        </p>
      </section>
    </div>
  );
}

function anonymousLetter(index: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < letters.length) return letters[index];
  return `${letters[index % letters.length]}${Math.floor(index / letters.length) + 1}`;
}
