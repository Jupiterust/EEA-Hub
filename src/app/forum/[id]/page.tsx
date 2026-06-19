import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { replyAction, reportAction } from "@/lib/actions";
import { requireUser } from "@/lib/authz";
import { FeedbackBanner } from "@/components/feedback-banner";
import { ImageLightbox } from "@/components/image-lightbox";
import { MarkdownView } from "@/components/markdown-view";
import { SubmitButton } from "@/components/submit-button";
import { Badge, inputClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ForumDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4">
        <FeedbackBanner error={query.error} success={query.success} />
      </div>
      <article className="rounded-lg border border-border bg-surface p-5  sm:p-7">
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
        <form action={reportAction} className="mt-4 flex gap-2">
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
          <input name="reason" placeholder="举报原因" className={inputClass} />
          <SubmitButton variant="secondary" pendingText="提交中...">举报</SubmitButton>
        </form>
      </article>

      <section className="mt-6 grid gap-3">
        <h2 className="text-xl font-black text-text-primary">回复</h2>
        {post.replies.map((reply) => (
          <div key={reply.id} className="rounded-lg border border-border bg-surface p-5 ">
            <p className="text-sm text-text-secondary">
              {reply.isAnonymous ? anonymousLabels.get(reply.authorId) : reply.author.realName} · {reply.createdAt.toLocaleString("zh-CN")}
            </p>
            <div className="mt-3">
              <MarkdownView content={reply.content} />
            </div>
            <ImageLightbox images={reply.imageUrls.map((url, index) => ({ url, alt: `回复配图 ${index + 1}` }))} />
            <form action={reportAction} className="mt-4 flex gap-2">
              <input type="hidden" name="replyId" value={reply.id} />
              <input type="hidden" name="returnTo" value={`/forum/${post.id}`} />
              <input name="reason" placeholder="举报原因" className={inputClass} />
              <SubmitButton variant="secondary" pendingText="提交中...">举报</SubmitButton>
            </form>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 ">
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
