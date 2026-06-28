import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { updateDocAction } from "@/lib/actions";
import { DivisionTeamSelect } from "@/components/division-team-select";
import { FeedbackBanner } from "@/components/feedback-banner";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Tooltip } from "@/components/tooltip";
import { Field, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const PATH_TIP = "用 '>' 分隔层级，如「新人学习路径>STM32入门>GPIO配置」，文档会出现在左侧目录树的 '部门/小组/新人学习路径>STM32入门>GPIO配置' 下。留空则挂在所属小组下。";

export default async function EditDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const query = await searchParams;

  const doc = await prisma.techDoc.findUnique({ where: { slug } });
  if (!doc) {
    notFound();
  }

  if (doc.authorId !== user.id) {
    redirect(`/docs/${slug}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-6">
        <h1 className="text-2xl font-black text-text-primary">编辑文档</h1>
        <div className="mt-4">
          <FeedbackBanner error={query.error} success={query.success} />
        </div>
        <form action={updateDocAction} className="mt-6 grid gap-4">
          <input type="hidden" name="docId" value={doc.id} />
          <Field label="标题">
            <input name="title" defaultValue={doc.title} className={inputClass} required />
          </Field>
          <Field
            label={
              <span className="inline-flex items-center gap-1">
                目录路径 <Tooltip text={PATH_TIP} />
              </span>
            }
          >
            <input name="path" defaultValue={doc.path} className={inputClass} />
          </Field>
          <DivisionTeamSelect
            defaultDivision={doc.division}
            defaultTeam={doc.team}
            lockedDivision={user.role === "MEMBER" ? user.division : undefined}
            lockedTeam={user.role === "MEMBER" ? user.team : undefined}
          />
          <Field label="摘要">
            <textarea name="excerpt" defaultValue={doc.excerpt ?? ""} className={inputClass} rows={3} />
          </Field>
          <MarkdownEditor name="content" label="Markdown 正文" defaultValue={doc.content} rows={18} />
          <SubmitButton pendingText="保存中...">保存更改</SubmitButton>
        </form>
      </div>
    </div>
  );
}
