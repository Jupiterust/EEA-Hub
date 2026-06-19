import { createAssignmentAction } from "@/lib/actions";
import { requireLeader } from "@/lib/authz";
import { DivisionTeamSelect } from "@/components/division-team-select";
import { FeedbackBanner } from "@/components/feedback-banner";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireLeader();
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-6 ">
        <h1 className="text-2xl font-black text-text-primary">发布作业</h1>
        <div className="mt-4">
          <FeedbackBanner error={params.error} success={params.success} />
        </div>
        <form action={createAssignmentAction} className="mt-6 grid gap-4">
          <Field label="标题">
            <input name="title" className={inputClass} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <DivisionTeamSelect allowGeneralDivision={false} defaultDivision="SOFTWARE" />
            <Field label="截止时间">
              <input name="dueAt" type="datetime-local" className={inputClass} required />
            </Field>
          </div>
          <Field label="描述 Markdown">
            <textarea name="description" className={`${inputClass} font-mono`} rows={12} required />
          </Field>
          <Field label="附件素材">
            <input name="attachment" type="file" className={inputClass} />
          </Field>
          <SubmitButton pendingText="发布中...">发布</SubmitButton>
        </form>
      </div>
    </div>
  );
}
