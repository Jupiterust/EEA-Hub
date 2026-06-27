import { requireUser } from "@/lib/authz";
import { FeedbackBanner } from "@/components/feedback-banner";
import { ForumNewForm } from "@/components/forum-new-form";

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
      <div className="rounded-lg border border-border bg-surface p-6">
        <h1 className="text-2xl font-black text-text-primary">发布技术帖</h1>
        <div className="mt-4">
          <FeedbackBanner error={params.error} success={params.success} />
        </div>
        <ForumNewForm hasError={!!params.error} />
      </div>
    </div>
  );
}
