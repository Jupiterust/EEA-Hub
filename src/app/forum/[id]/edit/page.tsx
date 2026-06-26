import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { updatePostAction } from "@/lib/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { ImageManager } from "@/components/image-manager";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
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
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      imageUrls: true,
      authorId: true,
      isAnonymous: true,
    },
  });
  if (!post) {
    notFound();
  }

  if (post.authorId !== user.id) {
    redirect(`/forum/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-6">
        <h1 className="text-2xl font-black text-text-primary">
          编辑帖子
          {post.isAnonymous && (
            <span className="ml-2 text-sm font-normal text-text-secondary">（匿名帖）</span>
          )}
        </h1>
        <div className="mt-4">
          <FeedbackBanner error={query.error} success={query.success} />
        </div>
        <form action={updatePostAction} className="mt-6 grid gap-4">
          <input type="hidden" name="postId" value={post.id} />
          <Field label="标题">
            <input name="title" defaultValue={post.title} className={inputClass} required />
          </Field>
          <Field label="标签">
            <input
              name="tags"
              defaultValue={post.tags.join(" ")}
              className={inputClass}
              placeholder="STM32 FPGA 视觉 控制算法"
            />
          </Field>
          <Field label="正文">
            <textarea
              name="content"
              defaultValue={post.content}
              className={`${inputClass} font-mono`}
              rows={14}
              required
            />
          </Field>
          <div className="grid gap-1.5 text-sm font-semibold text-text-primary">
            <span>配图管理</span>
            <ImageManager existingImages={post.imageUrls} />
          </div>
          <SubmitButton pendingText="保存中...">保存更改</SubmitButton>
        </form>
      </div>
    </div>
  );
}
