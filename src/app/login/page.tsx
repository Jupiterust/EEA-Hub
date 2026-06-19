import { loginAction } from "@/lib/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-lg border border-border bg-surface p-6 ">
        <h1 className="text-2xl font-black text-text-primary">登录电协 Hub</h1>
        {params.registered ? (
          <p className="mt-3 rounded-md bg-gold/15 p-3 text-sm text-gold">
            注册成功，账号仍需审核激活后才能登录。
          </p>
        ) : null}
        {params.error ? (
          <p className="mt-3 rounded-md bg-danger/15 p-3 text-sm text-danger">
            账号不存在、未激活或密码错误。
          </p>
        ) : null}
        <div className="mt-3">
          <FeedbackBanner success={params.success} />
        </div>
        <form action={loginAction} className="mt-6 grid gap-4">
          <Field label="账号或邮箱">
            <input name="identifier" className={inputClass} autoComplete="username" required />
          </Field>
          <Field label="密码">
            <input name="password" type="password" className={inputClass} autoComplete="current-password" required />
          </Field>
          <SubmitButton pendingText="登录中...">登录</SubmitButton>
          <p className="text-xs leading-5 text-text-secondary">
            密码找回建议通过邮箱验证码服务实现；当前代码已预留账号邮箱字段，可接入 Resend/Supabase Auth OTP。
          </p>
        </form>
      </div>
    </div>
  );
}
