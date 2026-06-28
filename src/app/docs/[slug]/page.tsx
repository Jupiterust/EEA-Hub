import Link from "next/link";
import { notFound } from "next/navigation";
import { ThumbsUp } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createDocCommentAction,
  deleteDocAction,
  deleteDocCommentAction,
  toggleDocCommentLikeAction,
  toggleDocLikeAction,
  toggleDocPinAction,
  updateDocCommentAction,
} from "@/lib/actions";
import { requireUser } from "@/lib/authz";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DocTree } from "@/components/doc-tree";
import { FeedbackBanner } from "@/components/feedback-banner";
import { InlineCommentReplyForm } from "@/components/inline-comment-reply-form";
import { MarkdownView } from "@/components/markdown-view";
import { SubmitButton } from "@/components/submit-button";
import { TableOfContents } from "@/components/table-of-contents";
import { Avatar } from "@/components/avatar";
import { Badge, cn, deleteButtonClass, deleteLinkClass, editButtonClass, editLinkClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Heading = { id: string; text: string; level: number };

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const seen: Record<string, number> = {};
  for (const match of markdown.matchAll(/^(#{2,4})\s+(.+)$/gm)) {
    const level = match[1].length;
    const text = match[2].replace(/[`*_[\]]/g, "").trim();
    let id = text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w一-龥-]/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
    const count = seen[id] ?? 0;
    if (count > 0) id = `${id}-${count}`;
    seen[id] = count + 1;
    headings.push({ level, text, id });
  }
  return headings;
}

function anonymousLetter(index: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < letters.length) return letters[index];
  return `${letters[index % letters.length]}${Math.floor(index / letters.length) + 1}`;
}

export default async function DocDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; success?: string; editComment?: string }>;
}) {
  const [{ slug }, query, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);

  // requireUser for comment actions — but doc is public-readable; fall back gracefully
  let currentUser: Awaited<ReturnType<typeof requireUser>> | null = null;
  try {
    currentUser = await requireUser();
  } catch {
    // not logged in — read-only view
  }

  const [doc, allDocs] = await Promise.all([
    prisma.techDoc.findUnique({
      where: { slug },
      include: {
        author: { select: { realName: true, avatarUrl: true } },
        _count: { select: { docLikes: true } },
        docLikes: currentUser
          ? { where: { userId: currentUser.id }, select: { userId: true } }
          : false,
        comments: {
          include: {
            author: { select: { realName: true, username: true, avatarUrl: true } },
            _count: { select: { commentLikes: true } },
            commentLikes: currentUser
              ? { where: { userId: currentUser.id }, select: { userId: true } }
              : false,
            replyTo: {
              select: { id: true, authorId: true, isAnonymous: true, author: { select: { realName: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.techDoc.findMany({
      where: { published: true },
      select: { slug: true, title: true, division: true, team: true, path: true },
      orderBy: [{ division: "asc" }, { team: "asc" }, { order: "asc" }],
    }),
  ]);

  if (!doc) notFound();

  const currentUserId = session?.user?.id;
  const currentUserRole = session?.user?.role;
  const isAuthor = !!currentUserId && currentUserId === doc.authorId;
  const canDelete = isAuthor || currentUserRole === "ADMIN";
  const canPinDoc = currentUserRole === "LEADER" || currentUserRole === "ADMIN";

  const userLikedDoc = Array.isArray(doc.docLikes) && doc.docLikes.length > 0;
  const docLikeCount = doc._count.docLikes;

  // Build anonymous label map across ALL comments (main + sub) in creation order
  const anonLabels = new Map<string, string>();
  let anonIndex = 0;
  for (const c of doc.comments) {
    if (!c.isAnonymous) continue;
    if (!anonLabels.has(c.authorId)) {
      anonLabels.set(c.authorId, `匿名用户${anonymousLetter(anonIndex++)}`);
    }
  }

  function getDisplayName(c: { isAnonymous: boolean; authorId: string; author: { realName: string } }) {
    return c.isAnonymous ? (anonLabels.get(c.authorId) ?? "匿名用户") : c.author.realName;
  }

  function getAtLabel(
    replyTo: { id: string; authorId: string; isAnonymous: boolean; author: { realName: string } } | null,
  ) {
    if (!replyTo) return null;
    if (replyTo.isAnonymous) return anonLabels.get(replyTo.authorId) ?? "匿名用户";
    return replyTo.author.realName;
  }

  // Separate main and sub comments
  const mainComments = doc.comments.filter((c) => c.parentId === null);
  const subCommentsMap = new Map<string, typeof doc.comments>();
  for (const c of doc.comments) {
    if (c.parentId === null) continue;
    const list = subCommentsMap.get(c.parentId) ?? [];
    list.push(c);
    subCommentsMap.set(c.parentId, list);
  }

  const headings = extractHeadings(doc.content);
  const editCommentId = query.editComment;

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-6 py-8 md:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_220px]">

        {/* ── Left: doc tree ─────────────────────────────────── */}
        <aside className="hidden md:block">
          <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4">
            <Link href="/docs" className="mb-3 block text-xs font-semibold text-primary hover:underline">
              ← 技术文档
            </Link>
            <DocTree allDocs={allDocs} currentSlug={slug} />
          </div>
        </aside>

        {/* ── Center: content ────────────────────────────────── */}
        <main className="min-w-0">
          <div className="mb-4 md:hidden">
            <Link href="/docs" className="text-sm font-semibold text-primary">← 返回文档列表</Link>
          </div>

          <FeedbackBanner error={query.error} success={query.success} />

          <div className="rounded-lg border border-border bg-surface p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <Badge tone={doc.division === "GENERAL" ? "blue" : "slate"}>
                {divisionLabels[doc.division]}
              </Badge>
              <Badge>{teamLabels[doc.team]}</Badge>
              {doc.path && <span className="text-xs text-text-secondary/70">{doc.path}</span>}
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
                <Avatar url={doc.author.avatarUrl} size="xs" alt={doc.author.realName} />
                <Link href={`/profile/${doc.authorId}`} className="hover:text-primary hover:underline">
                  {doc.author.realName}
                </Link>
                {" · "}更新于 {doc.updatedAt.toLocaleDateString("zh-CN")}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black text-text-primary">{doc.title}</h1>
            {doc.excerpt && (
              <p className="mt-2 text-base leading-relaxed text-text-secondary">{doc.excerpt}</p>
            )}

            {(isAuthor || canDelete || canPinDoc) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {isAuthor && (
                  <Link href={`/docs/${slug}/edit`} className={cn(editButtonClass, "text-xs px-3")}>
                    编辑文档
                  </Link>
                )}
                {(isAuthor || canDelete) && (
                  <Link href={`/docs/${slug}/history`} className={cn(editButtonClass, "text-xs px-3")}>
                    历史版本
                  </Link>
                )}
                {canDelete && (
                  <ConfirmDelete
                    action={deleteDocAction}
                    fields={{ docId: doc.id, slug: doc.slug }}
                    message="确定要删除这篇文档吗？"
                    buttonLabel="删除文档"
                    buttonClassName={cn(deleteButtonClass, "text-xs px-3")}
                  />
                )}
                {canPinDoc && (
                  <form action={toggleDocPinAction}>
                    <input type="hidden" name="docId" value={doc.id} />
                    <input type="hidden" name="returnTo" value={`/docs/${slug}`} />
                    <SubmitButton variant="secondary" pendingText="..." className="px-3 py-1.5 text-xs">
                      {doc.isPinned ? "取消置顶" : "📌 置顶"}
                    </SubmitButton>
                  </form>
                )}
              </div>
            )}

            <div className="mt-8">
              <MarkdownView content={doc.content} />
            </div>

            {/* ── Like button ── */}
            <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
              {currentUser ? (
                <form action={toggleDocLikeAction}>
                  <input type="hidden" name="docId" value={doc.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="returnTo" value={`/docs/${slug}`} />
                  <SubmitButton
                    variant="secondary"
                    pendingText="..."
                    className={cn(
                      "gap-1.5 px-3 py-1.5 text-xs",
                      userLikedDoc && "border-success/40 bg-success/10 text-success hover:bg-success/20",
                    )}
                  >
                    <ThumbsUp className="size-3.5" />
                    {userLikedDoc ? "已点赞" : "点赞"}{docLikeCount > 0 ? ` ${docLikeCount}` : ""}
                  </SubmitButton>
                </form>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
                  <ThumbsUp className="size-3.5" /> {docLikeCount}
                </span>
              )}
            </div>
          </div>

          {/* ── Comments ── */}
          <section className="mt-6">
            <h2 className="mb-4 text-xl font-black text-text-primary">
              评论 {doc.comments.length > 0 && <span className="text-base font-normal text-text-secondary">（{doc.comments.length}）</span>}
            </h2>

            <div className="grid gap-3">
              {mainComments.map((comment) => {
                const authorLabel = getDisplayName(comment);
                const isCommentAuthor = currentUserId === comment.authorId;
                const canDeleteComment = isCommentAuthor || currentUserRole === "ADMIN";
                const isEditing = editCommentId === comment.id && isCommentAuthor;
                const userLikedComment = Array.isArray(comment.commentLikes) && comment.commentLikes.length > 0;
                const commentLikeCount = comment._count.commentLikes;
                const subComments = subCommentsMap.get(comment.id) ?? [];

                return (
                  <div
                    key={comment.id}
                    id={`comment-${comment.id}`}
                    className="scroll-mt-20 rounded-lg border border-border bg-surface"
                  >
                    {/* Main comment — soft-deleted placeholder */}
                    {comment.isDeleted ? (
                      <div className="p-4">
                        <p className="text-sm italic text-text-secondary">[该评论已删除]</p>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <Avatar
                            url={comment.isAnonymous ? null : comment.author.avatarUrl}
                            anonymous={comment.isAnonymous}
                            size="xs"
                            alt={authorLabel}
                          />
                          <span>
                            {comment.isAnonymous ? (
                              authorLabel
                            ) : (
                              <Link href={`/profile/${comment.authorId}`} className="hover:text-primary hover:underline">
                                {authorLabel}
                              </Link>
                            )}
                            {" · "}{comment.createdAt.toLocaleString("zh-CN")}
                          </span>
                        </div>

                        {isEditing ? (
                          <form action={updateDocCommentAction} className="mt-3 grid gap-3">
                            <input type="hidden" name="commentId" value={comment.id} />
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="returnTo" value={`/docs/${slug}`} />
                            <textarea
                              name="content"
                              defaultValue={comment.content}
                              className={`${inputClass} font-mono`}
                              rows={4}
                              required
                            />
                            <div className="flex gap-2">
                              <SubmitButton pendingText="保存中..." className="text-xs px-3 py-1.5">保存</SubmitButton>
                              <Link href={`/docs/${slug}`} className={`${secondaryButtonClass} text-xs px-3 py-1.5`}>取消</Link>
                            </div>
                          </form>
                        ) : (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-text-primary">{comment.content}</p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {isCommentAuthor && !isEditing && (
                            <Link href={`/docs/${slug}?editComment=${comment.id}`} className={editLinkClass}>编辑</Link>
                          )}
                          {canDeleteComment && (
                            <ConfirmDelete
                              action={deleteDocCommentAction}
                              fields={{ commentId: comment.id, slug }}
                              message="确定要删除这条评论吗？"
                              buttonLabel="删除"
                              buttonClassName={deleteLinkClass}
                            />
                          )}
                          {currentUser && !isEditing && (
                            <InlineCommentReplyForm
                              docId={doc.id}
                              slug={slug}
                              parentId={comment.id}
                              replyToId={comment.id}
                              atLabel={authorLabel}
                            />
                          )}
                          {currentUser && (
                            <form action={toggleDocCommentLikeAction} className="ml-auto">
                              <input type="hidden" name="commentId" value={comment.id} />
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="returnTo" value={`/docs/${slug}`} />
                              <SubmitButton
                                variant="secondary"
                                pendingText="..."
                                className={cn(
                                  "gap-1 px-2 py-1 text-xs",
                                  userLikedComment && "border-success/40 bg-success/10 text-success hover:bg-success/20",
                                )}
                              >
                                <ThumbsUp className="size-3" />
                                {commentLikeCount > 0 ? commentLikeCount : ""}
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sub-comments */}
                    {subComments.length > 0 && (
                      <div className="border-t border-border/60">
                        {subComments.map((sub, subIndex) => {
                          const subLabel = getDisplayName(sub);
                          const atLabel = getAtLabel(sub.replyTo);
                          const isSubAuthor = currentUserId === sub.authorId;
                          const canDeleteSub = isSubAuthor || currentUserRole === "ADMIN";
                          const isEditingSub = editCommentId === sub.id && isSubAuthor;
                          const userLikedSub = Array.isArray(sub.commentLikes) && sub.commentLikes.length > 0;
                          const subLikeCount = sub._count.commentLikes;

                          return (
                            <div
                              key={sub.id}
                              id={`comment-${sub.id}`}
                              className={cn(
                                "scroll-mt-20 px-4 py-3 sm:pl-10",
                                subIndex < subComments.length - 1 && "border-b border-border/40",
                                "bg-elevated/20",
                              )}
                            >
                              {sub.isDeleted ? (
                                <p className="text-sm italic text-text-secondary">[该评论已删除]</p>
                              ) : (
                                <>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Avatar
                                      url={sub.isAnonymous ? null : sub.author.avatarUrl}
                                      anonymous={sub.isAnonymous}
                                      size="xs"
                                      alt={subLabel}
                                    />
                                    <span className="text-xs text-text-secondary">
                                      {sub.isAnonymous ? (
                                        <span className="font-medium text-text-primary">{subLabel}</span>
                                      ) : (
                                        <Link href={`/profile/${sub.authorId}`} className="font-medium text-text-primary hover:text-primary hover:underline">
                                          {subLabel}
                                        </Link>
                                      )}
                                      {atLabel && sub.replyToId && (
                                        <span className="mx-1">
                                          回复{" "}
                                          <a
                                            href={`#comment-${sub.replyToId}`}
                                            className="text-primary hover:underline"
                                          >
                                            @{atLabel}
                                          </a>
                                        </span>
                                      )}
                                      · {sub.createdAt.toLocaleString("zh-CN")}
                                    </span>
                                  </div>

                                  {isEditingSub ? (
                                    <form action={updateDocCommentAction} className="mt-2 grid gap-2">
                                      <input type="hidden" name="commentId" value={sub.id} />
                                      <input type="hidden" name="slug" value={slug} />
                                      <input type="hidden" name="returnTo" value={`/docs/${slug}`} />
                                      <textarea
                                        name="content"
                                        defaultValue={sub.content}
                                        className={`${inputClass} font-mono text-sm`}
                                        rows={4}
                                        required
                                      />
                                      <div className="flex gap-2">
                                        <SubmitButton pendingText="保存中..." className="px-3 py-1.5 text-xs">保存</SubmitButton>
                                        <Link href={`/docs/${slug}`} className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}>取消</Link>
                                      </div>
                                    </form>
                                  ) : (
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-text-primary">{sub.content}</p>
                                  )}

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {isSubAuthor && !isEditingSub && (
                                      <Link href={`/docs/${slug}?editComment=${sub.id}`} className={editLinkClass}>编辑</Link>
                                    )}
                                    {canDeleteSub && (
                                      <ConfirmDelete
                                        action={deleteDocCommentAction}
                                        fields={{ commentId: sub.id, slug }}
                                        message="确定要删除这条评论吗？"
                                        buttonLabel="删除"
                                        buttonClassName={deleteLinkClass}
                                      />
                                    )}
                                    {currentUser && !isEditingSub && (
                                      <InlineCommentReplyForm
                                        docId={doc.id}
                                        slug={slug}
                                        parentId={comment.id}
                                        replyToId={sub.id}
                                        atLabel={subLabel}
                                      />
                                    )}
                                    {currentUser && (
                                      <form action={toggleDocCommentLikeAction} className="ml-auto">
                                        <input type="hidden" name="commentId" value={sub.id} />
                                        <input type="hidden" name="slug" value={slug} />
                                        <input type="hidden" name="returnTo" value={`/docs/${slug}`} />
                                        <SubmitButton
                                          variant="secondary"
                                          pendingText="..."
                                          className={cn(
                                            "gap-1 px-2 py-1 text-xs",
                                            userLikedSub && "border-success/40 bg-success/10 text-success hover:bg-success/20",
                                          )}
                                        >
                                          <ThumbsUp className="size-3" />
                                          {subLikeCount > 0 ? subLikeCount : ""}
                                        </SubmitButton>
                                      </form>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New top-level comment form */}
            {currentUser ? (
              <div className="mt-4 rounded-lg border border-border bg-surface p-5">
                <h3 className="text-base font-bold text-text-primary">发表评论</h3>
                <form action={createDocCommentAction} className="mt-3 grid gap-3">
                  <input type="hidden" name="docId" value={doc.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="returnTo" value={`/docs/${slug}`} />
                  <textarea
                    name="content"
                    placeholder="写下你的评论…"
                    className={`${inputClass} font-mono`}
                    rows={4}
                    required
                  />
                  <div className="flex items-center justify-between gap-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <input name="isAnonymous" type="checkbox" className="size-4" />
                      匿名评论
                    </label>
                    <SubmitButton pendingText="发表中...">发表评论</SubmitButton>
                  </div>
                </form>
                <p className="mt-2 text-xs text-text-secondary">
                  当前身份：{currentUser.name}。匿名评论前端不会展示真实身份。
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-secondary">
                <Link href="/login" className="text-primary hover:underline">登录</Link> 后可发表评论。
              </p>
            )}
          </section>
        </main>

        {/* ── Right: TOC ─────────────────────────────────────── */}
        <aside className="hidden xl:block">
          <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4">
            <TableOfContents initialHeadings={headings} />
          </div>
        </aside>

      </div>
    </div>
  );
}
