import { prisma } from "@/lib/prisma";
import { approveUserAction, banUserAction, createInviteAction, dismissReportAction, resolveReportAction, revealAnonymousAuthorAction } from "@/lib/actions";
import { canManageScope, requireLeader } from "@/lib/authz";
import { FeedbackBanner } from "@/components/feedback-banner";
import { SubmitButton } from "@/components/submit-button";
import { Badge, inputClass } from "@/components/ui";
import { divisionLabels, roleLabels, statusLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; error?: string; success?: string }>;
}) {
  const user = await requireLeader();
  const params = await searchParams;
  const [users, invites, reports, audits] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
    prisma.inviteCode.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.report.findMany({
      where: { status: "OPEN" },
      include: {
        reporter: { select: { realName: true } },
        post: { include: { author: { select: { realName: true, username: true } } } },
        reply: { include: { author: { select: { realName: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findMany({ include: { actor: { select: { realName: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const visibleUsers = users.filter((item) => canManageScope(user, item));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black text-text-primary">管理后台</h1>
      {params.invite ? (
        <p className="mt-4 rounded-md bg-success/15 p-3 text-sm font-semibold text-success">
          新邀请口令：{params.invite}。页面只显示这一次，请及时发送给新成员。
        </p>
      ) : null}
      <div className="mt-4">
        <FeedbackBanner error={params.error} success={params.success} />
      </div>
      <section className="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border bg-surface p-5 ">
          <h2 className="text-xl font-black text-text-primary">邀请口令</h2>
          <form action={createInviteAction} className="mt-4 grid gap-3">
            <input name="label" placeholder="用途说明" className={inputClass} />
            <input name="code" placeholder="自定义口令，可留空自动生成" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input name="maxUses" type="number" min="1" defaultValue="20" className={inputClass} />
              <input name="days" type="number" min="1" defaultValue="14" className={inputClass} />
            </div>
            <SubmitButton pendingText="生成中...">生成口令</SubmitButton>
          </form>
          <div className="mt-4 grid gap-2">
            {invites.map((invite) => (
              <div key={invite.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-semibold text-text-primary">{invite.label}</p>
                <p className="mt-1 text-text-secondary">{invite.usedCount}/{invite.maxUses} · {invite.expiresAt.toLocaleDateString("zh-CN")} · {invite.status}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 ">
          <h2 className="text-xl font-black text-text-primary">用户审核与角色</h2>
          <div className="mt-4 grid gap-3">
            {visibleUsers.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{item.realName}</strong>
                  <Badge>{item.username}</Badge>
                  <Badge>{divisionLabels[item.division]}</Badge>
                  <Badge>{teamLabels[item.team]}</Badge>
                  <Badge tone={item.status === "ACTIVE" ? "green" : item.status === "BANNED" ? "red" : "amber"}>{statusLabels[item.status]}</Badge>
                  <Badge>{roleLabels[item.role]}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveUserAction} className="flex gap-2">
                    <input type="hidden" name="userId" value={item.id} />
                    <select name="role" defaultValue={item.role} className={inputClass}>
                      <option value="MEMBER">普通成员</option>
                      <option value="LEADER">部门负责人</option>
                      {user.role === "ADMIN" ? <option value="ADMIN">管理员</option> : null}
                    </select>
                    <SubmitButton variant="secondary" pendingText="保存中...">审核/更新</SubmitButton>
                  </form>
                  {item.role !== "ADMIN" ? (
                    <form action={banUserAction} className="flex gap-2">
                      <input type="hidden" name="userId" value={item.id} />
                      <input name="reason" placeholder="禁用原因" className={inputClass} />
                      <SubmitButton variant="secondary" pendingText="处理中...">禁用</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 ">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black text-text-primary">举报队列</h2>
          {reports.length > 0 ? (
            <Badge tone="red">待处理 {reports.length}</Badge>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3">
          {reports.map((report) => {
            const target = report.post ?? report.reply;
            const author = report.post?.author ?? report.reply?.author;
            return (
              <div key={report.id} className="rounded-md border border-border p-4 text-sm">
                <p className="font-semibold text-text-primary">举报人：{report.reporter.realName} · {report.reason}</p>
                <p className="mt-1 text-text-secondary">{report.createdAt.toLocaleString("zh-CN")}</p>
                <p className="mt-2 text-text-secondary">内容：{target?.content.slice(0, 160)}</p>
                {user.role === "ADMIN" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.post?.isAnonymous ? (
                      <form action={revealAnonymousAuthorAction}>
                        <input type="hidden" name="postId" value={report.post.id} />
                        <input name="reason" value={`处理举报 ${report.id}`} readOnly className="sr-only" />
                        <SubmitButton variant="secondary" pendingText="记录中...">追溯匿名：{author?.realName}</SubmitButton>
                      </form>
                    ) : null}
                    <form action={resolveReportAction}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <SubmitButton variant="secondary" pendingText="处理中...">标记已处理</SubmitButton>
                    </form>
                    <form action={dismissReportAction}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <SubmitButton variant="secondary" pendingText="处理中...">驳回举报</SubmitButton>
                    </form>
                  </div>
                ) : null}
              </div>
            );
          })}
          {reports.length === 0 ? <p className="text-sm text-text-secondary">暂无待处理举报。</p> : null}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 ">
        <h2 className="text-xl font-black text-text-primary">匿名追溯审计日志</h2>
        <div className="mt-4 grid gap-2">
          {audits.map((audit) => (
            <p key={audit.id} className="rounded-md bg-elevated p-3 text-sm text-text-secondary">
              {audit.createdAt.toLocaleString("zh-CN")} · {audit.actor.realName} · {audit.action} · {audit.target}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
