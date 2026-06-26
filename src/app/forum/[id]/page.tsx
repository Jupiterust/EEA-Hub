import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deletePostAction, deleteReplyAction, replyAction, reportAction, updateReplyAction } from "@/lib/actions";
import { requireUser } from "@/lib/authz";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FeedbackBanner } from "@/components/feedback-banner";
import { ImageLightbox } from "@/components/image-lightbox";
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
      author: { select: { realName: true, username: true } },
      replies: {
        include: { author: { select: { realName: true, username: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!post) {
    notFound();
  }

  const isPostAuthor = user.id === post.authorId;
  const canDeletePost = isPostAuthor || user.role === "ADMIN";

  const anonymousLabels = new Map<string, string>();
  let anonymousIndex = 0;
  for (const reply of post.replies) {
    if (!reply.isAnonymous) {
      continue;
    }
    if (post.isAnonymous && reply.authorId === post.authorId) {
      anonymousLabels.set(reply.authorId, "匿名楼主");
      continue;
    }
    if (!anonymousLabels.has(reply.authorId)) {
      anonymousLabels.set(reply.authorId, `匿名用户${anonymousLetter(anonymousIndex)}`);
      anonymousIndex += 1;
    }
  }

  const editReplyId = query.editReply;

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
        <p className="mt-2 text-sm text-text-secondary">
          {post.isAnonymous ? "匿名楼主" : post.author.realName} · {post.createdAt.toLocaleString("zh-CN")}
        </p>
        <div className="mt-6 rounded-md bg-elevated p-4">
          <MarkdownView content={post.content} />
        </div>
        <ImageLightbox images={post.imageUrls.map((url, index) => ({ url, alt: `${post.title} 配图 ${index + 1}` }))} />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isPostAuthor && (
            <Link
              href={`/forum/${post.id}/edit`}
              className={cn(editButtonClass, "px-3 py-1.5 text-xs")}
            >
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
          <form action={reportAction} className="ml-auto flex gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
            <input name="reason" placeholder="举报原因" className={`${inputClass} text-xs py-1.5`} />
            <SubmitButton variant="secondary" pendingText="提交中..." className="text-xs px-3 py-1.5">举报</SubmitButton>
          </form>
        </div>
      </article>

      <section className="mt-6 grid gap-3">
        <h2 className="text-xl font-black text-text-primary">回复</h2>
        {post.replies.map((reply) => {
          const replyAuthorLabel = reply.isAnonymous
            ? (anonymousLabels.get(reply.authorId) ?? "匿名用户")
            : reply.author.realName;
          const isReplyAuthor = user.id === reply.authorId;
          const canDeleteReply = isReplyAuthor || user.role === "ADMIN";
          const isEditing = editReplyId === reply.id && isReplyAuthor;

          return (
            <div key={reply.id} className="rounded-lg border border-border bg-surface p-5">
              <p className="text-sm text-text-secondary">
                {replyAuthorLabel} · {reply.createdAt.toLocaleString("zh-CN")}
              </p>

              {isEditing ? (
                <form action={updateReplyAction} className="mt-3 grid gap-3">
                  <input type="hidden" name="replyId" value={reply.id} />
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                  <textarea
                    name="content"
                    defaultValue={reply.content}
                    className={`${inputClass} font-mono`}
                    rows={6}
                    required
                  />
                  <div className="flex gap-2">
                    <SubmitButton pendingText="保存中..." className="text-xs px-3 py-1.5">
                      保存
                    </SubmitButton>
                    <Link
                      href={`/forum/${post.id}`}
                      className={`${secondaryButtonClass} text-xs px-3 py-1.5`}
                    >
                      取消
                    </Link>
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
                  <Link
                    href={`/forum/${post.id}?editReply=${reply.id}`}
                    className={editLinkClass}
                  >
                    编辑
                  </Link>
                )}
                {canDeleteReply && (
                  <ConfirmDelete
                    action={deleteReplyAction}
                    fields={{ replyId: reply.id, postId: post.id }}
                    message="确定要删除这条回复吗？"
                    buttonLabel="删除"
                    buttonClassName={deleteLinkClass}
                  />
                )}
                {!isEditing && (
                  <form action={reportAction} className="ml-auto flex gap-2">
                    <input type="hidden" name="replyId" value={reply.id} />
                    <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
                    <input name="reason" placeholder="举报原因" className={`${inputClass} text-xs py-1`} />
                    <SubmitButton variant="secondary" pendingText="提交中..." className="text-xs px-2 py-1">举报</SubmitButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

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
  if (index < letters.length) {
    return letters[index];
  }
  return `${letters[index % letters.length]}${Math.floor(index / letters.length) + 1}`;
}
