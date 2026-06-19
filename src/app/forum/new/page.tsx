import { createPostAction } from "@/lib/actions";
import { requireUser } from "@/lib/authz";
import { DivisionTeamSelect } from "@/components/division-team-select";
import { FeedbackBanner } from "@/components/feedback-banner";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-6 ">
        <h1 className="text-2xl font-black text-text-primary">发布技术帖</h1>
        <div className="mt-4">
          <FeedbackBanner error={params.error} success={params.success} />
        </div>
        <form action={createPostAction} className="mt-6 grid gap-4">
          <Field label="标题">
            <input name="title" className={inputClass} required />
          </Field>
          <DivisionTeamSelect />
          <Field label="标签">
            <input name="tags" className={inputClass} placeholder="STM32 FPGA 视觉 控制算法" />
          </Field>
          <Field label="正文">
            <textarea name="content" className={`${inputClass} font-mono`} rows={12} required />
          </Field>
          <Field label="配图（选填，最多 9 张 jpg/png/webp）">
            <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <input name="isAnonymous" type="checkbox" className="size-4" />
            匿名发布
          </label>
          <SubmitButton pendingText="发布中...">发布</SubmitButton>
        </form>
      </div>
    </div>
  );
}
