import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { changePasswordAction, deleteDocAction, deleteDocCommentAction, deletePostAction, deleteReplyAction, updateProfileAction } from "@/lib/actions";
import { AvatarUpload } from "@/components/avatar-upload";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { NotificationsSection, type NotificationData } from "@/components/notification-bell";
import { Badge, editLinkClass, deleteLinkClass, inputClass } from "@/components/ui";
import { divisionLabels, roleLabels, statusLabels, teamLabels } from "@/lib/labels";
import { FeedbackBanner } from "@/components/feedback-banner";

export const dynamic = "force-dynamic";

const itemActionClass = editLinkClass;
const itemDangerClass = deleteLinkClass;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const now = new Date();

  // Deadline notification check: run before main data fetch so new notifications
  // appear immediately in this page load
  if (user.role === "MEMBER") {
    try {
      const deadline24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dueSoon = await prisma.assignment.findMany({
        where: {
          status: "OPEN",
          division: user.division,
          OR: [{ team: user.team }, { team: "GENERAL" }],
          dueAt: { gt: now, lte: deadline24h },
          submissions: { none: { studentId: user.id } },
        },
        select: { id: true, title: true },
      });
      for (const assignment of dueSoon) {
        const exists = await prisma.notification.findFirst({
          where: { recipientId: user.id, type: "DEADLINE", relatedId: assignment.id },
          select: { id: true },
        });
        if (!exists) {
          await prisma.notification.create({
            data: {
              recipientId: user.id,
              type: "DEADLINE",
              message: `作业《${assignment.title}》将在 24 小时内截止，请尽快提交`,
              linkUrl: `/assignments/${assignment.id}`,
              relatedId: assignment.id,
              isRead: false,
              count: 1,
            },
          });
        }
      }
    } catch {
      // deadline check must never break dashboard loading
    }
  }

  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [submissions, posts, anonPosts, anonReplies, docs, todos, adminStats, docComments, dbUser, notificationsRaw] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId: user.id },
      include: { assignment: { select: { id: true, title: true, dueAt: true } } },
      orderBy: { submittedAt: "desc" },
      take: 8,
    }),
    prisma.forumPost.findMany({
      where: { authorId: user.id, isAnonymous: false },
      select: { id: true, title: true, updatedAt: true, isSolved: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.forumPost.findMany({
      where: { authorId: user.id, isAnonymous: true },
      select: { id: true, title: true, updatedAt: true, isSolved: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.forumReply.findMany({
      where: { authorId: user.id, isAnonymous: true },
      include: { post: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    user.role !== "MEMBER"
      ? prisma.techDoc.findMany({
          where: { authorId: user.id },
          select: { id: true, title: true, slug: true, updatedAt: true, division: true },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([] as { id: string; title: string; slug: string; updatedAt: Date; division: string }[]),
    user.role === "MEMBER"
      ? prisma.assignment.findMany({
          where: {
            division: user.division,
            OR: [{ team: user.team }, { team: "GENERAL" }],
            dueAt: { gt: now, lt: soon },
            submissions: { none: { studentId: user.id } },
          },
          orderBy: { dueAt: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
    user.role === "MEMBER"
      ? Promise.resolve(null)
      : Promise.all([
          prisma.user.count({ where: { status: "PENDING" } }),
          prisma.report.count({ where: { status: "OPEN" } }),
          prisma.assignment.count(),
        ]),
    prisma.docComment.findMany({
      where: { authorId: user.id },
      include: { doc: { select: { slug: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true, realName: true, email: true, qq: true, bio: true, major: true, grade: true },
    }),
    prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: [{ isRead: "asc" }, { updatedAt: "desc" }],
      take: 30,
    }),
  ]);

  const avatarUrl: string | null = dbUser?.avatarUrl ?? null;
  const currentRealName: string = dbUser?.realName ?? user.name ?? "";
  const currentEmail: string = dbUser?.email ?? "";
  const currentQq: string = dbUser?.qq ?? "";
  const currentBio: string = dbUser?.bio ?? "";
  const currentMajor: string = dbUser?.major ?? "";
  const currentGrade: string = dbUser?.grade ?? "";

  const notifications: NotificationData[] = notificationsRaw.map((n) => ({
    id: n.id,
    type: n.type as NotificationData["type"],
    message: n.message,
    linkUrl: n.linkUrl,
    isRead: n.isRead,
    count: n.count,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <FeedbackBanner error={query.error} success={query.success} />

      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <AvatarUpload currentUrl={avatarUrl} />
          <div className="flex-1">
            <h1 className="text-3xl font-black text-text-primary">个人主页</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">{user.name}</Badge>
              <Badge>{divisionLabels[user.division]}</Badge>
              <Badge>{teamLabels[user.team]}</Badge>
              <Badge tone={user.role === "ADMIN" ? "red" : user.role === "LEADER" ? "amber" : "slate"}>{roleLabels[user.role]}</Badge>
              <Badge tone="green">{statusLabels[user.status]}</Badge>
            </div>
          </div>
        </div>
      </section>

      <NotificationsSection initialNotifications={notifications} />

      <section className="mt-6 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-xl font-black text-text-primary">编辑资料</h2>
        <form action={updateProfileAction} className="mt-4 grid gap-3 sm:max-w-sm">
          <input name="realName" defaultValue={currentRealName} placeholder="真实姓名" required className={inputClass} />
          <input name="email" type="email" defaultValue={currentEmail} placeholder="邮箱（选填）" className={inputClass} />
          <input name="qq" defaultValue={currentQq} placeholder="QQ 号（选填）" className={inputClass} />
          <textarea name="bio" defaultValue={currentBio} placeholder="个性签名（选填，100 字以内）" maxLength={100} rows={3} className={inputClass} />
          <input name="major" defaultValue={currentMajor} placeholder="专业（选填）" className={inputClass} />
          <input name="grade" defaultValue={currentGrade} placeholder="年级（选填，如：大二 / 2024级）" className={inputClass} />
          <SubmitButton pendingText="保存中...">保存资料</SubmitButton>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-xl font-black text-text-primary">修改密码</h2>
        <form action={changePasswordAction} className="mt-4 grid gap-3 sm:max-w-sm">
          <input type="password" name="currentPassword" placeholder="当前密码" required className={inputClass} />
          <input type="password" name="newPassword" placeholder="新密码（至少 6 位）" required className={inputClass} />
          <input type="password" name="confirmPassword" placeholder="确认新密码" required className={inputClass} />
          <SubmitButton pendingText="修改中...">修改密码</SubmitButton>
        </form>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {user.role === "MEMBER" ? (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xl font-black text-text-primary">待办提醒</h2>
            <div className="mt-4 grid gap-3">
              {todos.map((todo) => {
                const hoursLeft = Math.max(0, Math.ceil((todo.dueAt.getTime() - now.getTime()) / 3_600_000));
                return (
                  <Link key={todo.id} href={`/assignments/${todo.id}`} className="rounded-md bg-gold/15 p-3 text-sm text-gold">
                    {todo.title} · {todo.dueAt.toLocaleString("zh-CN")} · 剩余约 {hoursLeft} 小时
                  </Link>
                );
              })}
              {todos.length === 0 ? <p className="text-sm text-text-secondary">暂无临近截止未提交作业。</p> : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xl font-black text-text-primary">管理概览</h2>
            <div className="mt-4 grid gap-3 text-sm text-text-secondary">
              <p>待审核成员：{adminStats?.[0] ?? 0}</p>
              <p>待处理举报：{adminStats?.[1] ?? 0}</p>
              <p>作业总数：{adminStats?.[2] ?? 0}</p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-surface p-5 lg:col-span-2">
          <h2 className="text-xl font-black text-text-primary">我的作业记录</h2>
          <div className="mt-4 grid gap-3">
            {submissions.map((item) => (
              <Link key={item.id} href={`/assignments/${item.assignment.id}`} className="rounded-md border border-border p-3 text-sm hover:bg-elevated">
                <p className="font-semibold text-text-primary">{item.assignment.title}</p>
                <p className="mt-1 text-text-secondary">{item.submittedAt.toLocaleString("zh-CN")} · {item.isLate ? "迟交" : "按时"} · {item.verdict}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {user.role !== "MEMBER" && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-xl font-black text-text-primary">我发布的文档</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {docs.map((doc) => (
              <div key={doc.id} className="rounded-md border border-border p-3 text-sm">
                <Link href={`/docs/${doc.slug}`} className="block font-semibold text-text-primary hover:text-primary">
                  {doc.title}
                </Link>
                <p className="mt-1 text-text-secondary">
                  {divisionLabels[doc.division as keyof typeof divisionLabels]} · {doc.updatedAt.toLocaleString("zh-CN")}
                </p>
                <div className="mt-2 flex gap-3">
                  <Link href={`/docs/${doc.slug}/edit`} className={itemActionClass}>编辑</Link>
                  <ConfirmDelete
                    action={deleteDocAction}
                    fields={{ docId: doc.id, slug: doc.slug }}
                    message="确定要删除这篇文档吗？"
                    buttonLabel="删除"
                    buttonClassName={itemDangerClass}
                  />
                </div>
              </div>
            ))}
            {docs.length === 0 && (
              <p className="text-sm text-text-secondary col-span-2">暂无发布的文档。</p>
            )}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-xl font-black text-text-primary">我发布的实名帖子</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {posts.map((post) => (
            <div key={post.id} className="rounded-md border border-border p-3 text-sm">
              <Link href={`/forum/${post.id}`} className="block font-semibold text-text-primary hover:text-primary">
                {post.title}
              </Link>
              <p className="mt-1 text-text-secondary">
                {post.isSolved ? "已解决" : "讨论中"} · {post.updatedAt.toLocaleString("zh-CN")}
              </p>
              <div className="mt-2 flex gap-3">
                <Link href={`/forum/${post.id}/edit`} className={itemActionClass}>编辑</Link>
                <ConfirmDelete
                  action={deletePostAction}
                  fields={{ postId: post.id }}
                  message="确定要删除这个帖子吗？帖子下的所有回复也会一并删除。"
                  buttonLabel="删除"
                  buttonClassName={itemDangerClass}
                />
              </div>
            </div>
          ))}
          {posts.length === 0 ? (
            <p className="text-sm text-text-secondary col-span-2">暂无实名帖子。</p>
          ) : null}
        </div>
      </section>

      {docComments.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-xl font-black text-text-primary">我发布的文档评论</h2>
          <p className="mt-1 text-xs text-text-secondary">包含匿名评论，仅自己可见真实关联。公开页匿名评论仍以匿名方式显示。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {docComments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-border p-3 text-sm">
                <Link href={`/docs/${comment.doc.slug}`} className="block font-semibold text-text-primary hover:text-primary truncate">
                  {comment.isAnonymous && <span className="mr-1 text-xs text-text-secondary">[匿名]</span>}
                  {comment.doc.title}
                </Link>
                <p className="mt-1 text-text-secondary line-clamp-2">{comment.content}</p>
                <p className="mt-1 text-xs text-text-secondary">{comment.createdAt.toLocaleString("zh-CN")}</p>
                <div className="mt-2 flex gap-3">
                  <Link href={`/docs/${comment.doc.slug}?editComment=${comment.id}`} className={itemActionClass}>编辑</Link>
                  <ConfirmDelete
                    action={deleteDocCommentAction}
                    fields={{ commentId: comment.id, slug: comment.doc.slug }}
                    message="确定要删除这条评论吗？"
                    buttonLabel="删除"
                    buttonClassName={itemDangerClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(anonPosts.length > 0 || anonReplies.length > 0) && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-xl font-black text-text-primary">我发布的匿名内容</h2>
          <p className="mt-1 text-xs text-text-secondary">仅自己可见。在公开页面，这些内容仍以匿名方式显示。</p>

          {anonPosts.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-text-secondary">匿名帖子</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {anonPosts.map((post) => (
                  <div key={post.id} className="rounded-md border border-border p-3 text-sm">
                    <Link href={`/forum/${post.id}`} className="block font-semibold text-text-primary hover:text-primary">
                      {post.title}
                    </Link>
                    <p className="mt-1 text-text-secondary">
                      {post.isSolved ? "已解决" : "讨论中"} · {post.updatedAt.toLocaleString("zh-CN")}
                    </p>
                    <div className="mt-2 flex gap-3">
                      <Link href={`/forum/${post.id}/edit`} className={itemActionClass}>编辑</Link>
                      <ConfirmDelete
                        action={deletePostAction}
                        fields={{ postId: post.id }}
                        message="确定要删除这个匿名帖子吗？帖子下的所有回复也会一并删除。"
                        buttonLabel="删除"
                        buttonClassName={itemDangerClass}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {anonReplies.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-text-secondary">匿名回复</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {anonReplies.map((reply) => (
                  <div key={reply.id} className="rounded-md border border-border p-3 text-sm">
                    <Link href={`/forum/${reply.post.id}`} className="block font-semibold text-text-primary hover:text-primary truncate">
                      回帖：{reply.post.title}
                    </Link>
                    <p className="mt-1 text-text-secondary line-clamp-2">{reply.content}</p>
                    <p className="mt-1 text-xs text-text-secondary">{reply.createdAt.toLocaleString("zh-CN")}</p>
                    <div className="mt-2 flex gap-3">
                      <Link
                        href={`/forum/${reply.post.id}?editReply=${reply.id}`}
                        className={itemActionClass}
                      >
                        编辑
                      </Link>
                      <ConfirmDelete
                        action={deleteReplyAction}
                        fields={{ replyId: reply.id, postId: reply.post.id }}
                        message="确定要删除这条匿名回复吗？"
                        buttonLabel="删除"
                        buttonClassName={itemDangerClass}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
