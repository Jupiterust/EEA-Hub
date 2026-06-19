import { registerAction } from "@/lib/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { DivisionTeamSelect } from "@/components/division-team-select";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-lg border border-border bg-surface p-6 ">
        <h1 className="text-2xl font-black text-text-primary">邀请口令注册</h1>
        <p className="mt-2 text-sm text-text-secondary">
          注册后默认为待审核账号，管理员或对应负责人审核通过后可使用核心功能。
        </p>
        <div className="mt-4">
          <FeedbackBanner error={params.error} success={params.success} />
        </div>
        <form action={registerAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="账号">
            <input name="username" className={inputClass} required />
          </Field>
          <Field label="邮箱（选填）">
            <input name="email" type="email" className={inputClass} />
          </Field>
          <p className="text-xs leading-5 text-text-secondary sm:col-span-2">
            若不填写邮箱，忘记密码时只能联系管理员重置。
          </p>
          <Field label="真实姓名">
            <input name="realName" className={inputClass} required />
          </Field>
          <Field label="密码">
            <input name="password" type="password" className={inputClass} required />
          </Field>
          <div className="sm:col-span-2">
            <DivisionTeamSelect allowGeneralDivision={false} defaultDivision="SOFTWARE" defaultTeam="CONTROL" />
          </div>
          <div className="sm:col-span-2">
            <Field label="邀请口令">
              <input name="inviteCode" className={inputClass} required />
            </Field>
          </div>
          <SubmitButton pendingText="注册中..." className="sm:col-span-2">提交注册</SubmitButton>
        </form>
      </div>
    </div>
  );
}
