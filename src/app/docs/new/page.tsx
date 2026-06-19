import { createDocAction } from "@/lib/actions";
import { requireLeader } from "@/lib/authz";
import { DivisionTeamSelect } from "@/components/division-team-select";
import { FeedbackBanner } from "@/components/feedback-banner";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewDocPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireLeader();
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-6 ">
        <h1 className="text-2xl font-black text-text-primary">新建技术文档</h1>
        <div className="mt-4">
          <FeedbackBanner error={params.error} success={params.success} />
        </div>
        <form action={createDocAction} className="mt-6 grid gap-4">
          <Field label="标题">
            <input name="title" className={inputClass} required />
          </Field>
          <Field label="Slug">
            <input name="slug" className={inputClass} placeholder="选填,留空自动生成" />
          </Field>
          <Field label="目录路径">
            <input name="path" className={inputClass} placeholder="新人学习路径 > STM32入门 > GPIO配置" />
          </Field>
          <DivisionTeamSelect />
          <Field label="摘要">
            <textarea name="excerpt" className={inputClass} rows={3} />
          </Field>
          <Field label="Markdown 正文">
            <textarea name="content" className={`${inputClass} font-mono`} rows={18} required />
          </Field>
          <SubmitButton pendingText="发布中...">发布文档</SubmitButton>
        </form>
      </div>
    </div>
  );
}
