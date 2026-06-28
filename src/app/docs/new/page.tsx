import { requireUser } from "@/lib/authz";
import { DocNewForm } from "@/components/doc-new-form";
import { FeedbackBanner } from "@/components/feedback-banner";

export const dynamic = "force-dynamic";

export default async function NewDocPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const isMember = user.role === "MEMBER";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-6">
        <h1 className="text-2xl font-black text-text-primary">新建技术文档</h1>
        <div className="mt-4">
          <FeedbackBanner error={params.error} success={params.success} />
        </div>
        <DocNewForm
          hasError={!!params.error}
          lockedDivision={isMember ? user.division : undefined}
          lockedTeam={isMember ? user.team : undefined}
        />
      </div>
    </div>
  );
}
