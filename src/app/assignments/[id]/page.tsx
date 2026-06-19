import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageScope, canSeeAssignment, requireUser } from "@/lib/authz";
import { reviewSubmissionAction, submitAssignmentAction } from "@/lib/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { MarkdownView } from "@/components/markdown-view";
import { SubmitButton } from "@/components/submit-button";
import { Badge, inputClass, secondaryButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      submissions: {
        include: { student: { select: { realName: true, username: true, division: true, team: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!assignment || (!canSeeAssignment(user, assignment) && user.role !== "ADMIN")) {
    notFound();
  }
  const mine = assignment.submissions.filter((item) => item.studentId === user.id);
  const latestByStudent = new Map<string, (typeof assignment.submissions)[number]>();
  for (const submission of assignment.submissions) {
    if (!latestByStudent.has(submission.studentId)) {
      latestByStudent.set(submission.studentId, submission);
    }
  }
  const shouldSubmit = await prisma.user.count({
    where: {
      status: "ACTIVE",
      division: assignment.division,
      ...(assignment.team === "GENERAL" ? {} : { team: assignment.team }),
    },
  });
  const submitted = latestByStudent.size;
  const onTime = Array.from(latestByStudent.values()).filter((item) => !item.isLate).length;
  const canReview = canManageScope(user, assignment);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-4">
        <FeedbackBanner error={query.error} success={query.success} />
      </div>
      <section className="rounded-lg border border-border bg-surface p-5  sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{divisionLabels[assignment.division]}</Badge>
          <Badge>{teamLabels[assignment.team]}</Badge>
          <Badge tone={new Date() > assignment.dueAt ? "red" : "green"}>截止 {assignment.dueAt.toLocaleString("zh-CN")}</Badge>
        </div>
        <h1 className="mt-4 text-3xl font-black text-text-primary">{assignment.title}</h1>
        <div className="mt-6 rounded-md bg-elevated p-4">
          <MarkdownView content={assignment.description} />
        </div>
        {assignment.attachmentUrl ? (
          <a className={`${secondaryButtonClass} mt-4`} href={assignment.attachmentUrl} target="_blank" rel="noreferrer">
            下载作业素材
          </a>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-border bg-surface p-5 ">
          <h2 className="text-xl font-black text-text-primary">我的提交</h2>
          <form action={submitAssignmentAction} className="mt-4 grid gap-4">
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <input type="hidden" name="returnTo" value={`/assignments/${assignment.id}`} />
            <input name="file" type="file" className={inputClass} required />
            <SubmitButton pendingText="上传中...">上传新版本</SubmitButton>
          </form>
          <div className="mt-5 grid gap-3">
            {mine.map((submission) => (
              <a key={submission.id} href={submission.fileUrl} target="_blank" rel="noreferrer" className="rounded-md border border-border p-3 text-sm hover:bg-elevated">
                <p className="font-semibold text-text-primary">{submission.fileName}</p>
                <p className="mt-1 text-text-secondary">{submission.submittedAt.toLocaleString("zh-CN")} · {submission.isLate ? "迟交" : "按时"}</p>
                <p className="mt-1 text-text-secondary">结果：{submission.verdict} {submission.score ?? ""}</p>
                {submission.feedback ? <p className="mt-2 text-text-primary">{submission.feedback}</p> : null}
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 ">
          <h2 className="text-xl font-black text-text-primary">提交统计</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-elevated p-3"><dt className="text-text-secondary">应提交</dt><dd className="text-2xl font-black">{shouldSubmit}</dd></div>
            <div className="rounded-md bg-elevated p-3"><dt className="text-text-secondary">已提交</dt><dd className="text-2xl font-black">{submitted}</dd></div>
            <div className="rounded-md bg-elevated p-3"><dt className="text-text-secondary">按时</dt><dd className="text-2xl font-black">{onTime}</dd></div>
            <div className="rounded-md bg-elevated p-3"><dt className="text-text-secondary">迟交</dt><dd className="text-2xl font-black">{submitted - onTime}</dd></div>
          </dl>
        </div>
      </section>

      {canReview ? (
        <section className="mt-6 rounded-lg border border-border bg-surface p-5 ">
          <h2 className="text-xl font-black text-text-primary">批改列表</h2>
          <div className="mt-4 grid gap-4">
            {Array.from(latestByStudent.values()).map((submission) => (
              <form key={submission.id} action={reviewSubmissionAction} className="grid gap-3 rounded-md border border-border p-4">
                <input type="hidden" name="submissionId" value={submission.id} />
                <input type="hidden" name="returnTo" value={`/assignments/${assignment.id}`} />
                <div className="flex flex-wrap justify-between gap-3">
                  <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary">{submission.student.realName} · {submission.fileName}</a>
                  <span className="text-sm text-text-secondary">{submission.isLate ? "迟交" : "按时"}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-[160px_120px_1fr_auto]">
                  <select name="verdict" defaultValue={submission.verdict} className={inputClass}>
                    <option value="UNREVIEWED">待批改</option>
                    <option value="PASS">通过</option>
                    <option value="FAIL">不通过</option>
                  </select>
                  <input name="score" defaultValue={submission.score ?? ""} placeholder="分数" className={inputClass} />
                  <input name="feedback" defaultValue={submission.feedback ?? ""} placeholder="反馈" className={inputClass} />
                  <SubmitButton variant="secondary" pendingText="保存中...">保存</SubmitButton>
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
