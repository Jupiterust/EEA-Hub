"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageScope, requireLeader, requireUser } from "@/lib/authz";
import { uploadImageObject, uploadObject } from "@/lib/storage";

const divisionEnum = z.enum(["SOFTWARE", "ANALOG", "GENERAL"]);
const teamEnum = z.enum(["CONTROL", "VISION", "FPGA", "HARDWARE", "GENERAL"]);

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function redirectWithError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}success=${encodeURIComponent(message)}`);
}

function friendlyError(error: unknown, fallback: string) {
  if (isNextRedirectError(error)) {
    throw error;
  }
  if (error instanceof z.ZodError) {
    return "请检查表单内容是否填写完整且格式正确";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");
      if (target.includes("username")) {
        return "该用户名已被使用，请换一个";
      }
      if (target.includes("email")) {
        return "该邮箱已被注册";
      }
      if (target.includes("slug")) {
        return "该文档地址已存在,请换一个";
      }
      if (target.includes("codeHash")) {
        return "该邀请口令已存在,请换一个";
      }
      return "存在重复数据,请调整后再试";
    }
    if (error.code === "P2025") {
      return "要操作的数据不存在或已被删除";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function safeReturnTo(formData: FormData, fallback: string) {
  const value = stringValue(formData, "returnTo");
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function registerAction(formData: FormData) {
  try {
    const schema = z.object({
      username: z.string().min(3).max(32),
      email: z.string().email().optional().or(z.literal("")),
      password: z.string().min(6).max(128),
      realName: z.string().min(2).max(32),
      division: z.enum(["SOFTWARE", "ANALOG"]),
      team: z.enum(["CONTROL", "VISION", "FPGA", "HARDWARE"]),
      inviteCode: z.string().min(4),
    });
    const data = schema.parse({
      username: stringValue(formData, "username"),
      email: stringValue(formData, "email"),
      password: stringValue(formData, "password"),
      realName: stringValue(formData, "realName"),
      division: stringValue(formData, "division"),
      team: stringValue(formData, "team"),
      inviteCode: stringValue(formData, "inviteCode"),
    });

    const codeHash = await hashInviteCode(data.inviteCode);
    const invite = await prisma.inviteCode.findUnique({ where: { codeHash } });
    if (
      !invite ||
      invite.status !== "ACTIVE" ||
      invite.expiresAt < new Date() ||
      invite.usedCount >= invite.maxUses
    ) {
      throw new Error("邀请口令无效或已过期");
    }

    if (data.email) {
      const existingEmail = await prisma.user.findFirst({ where: { email: data.email } });
      if (existingEmail) {
        throw new Error("该邮箱已被注册");
      }
    }

    await prisma.$transaction([
      prisma.user.create({
        data: {
          username: data.username,
          email: data.email || null,
          passwordHash: await hash(data.password, 12),
          realName: data.realName,
          division: data.division,
          team: data.team,
          inviteCodeId: invite.id,
        },
      }),
      prisma.inviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      }),
    ]);
  } catch (error) {
    redirectWithError("/register", friendlyError(error, "注册失败,请稍后再试"));
  }

  redirect("/login?registered=1");
}

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      identifier: stringValue(formData, "identifier"),
      password: stringValue(formData, "password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=CredentialsSignin");
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function createInviteAction(formData: FormData) {
  try {
    const user = await requireLeader();
    const rawCode = stringValue(formData, "code") || crypto.randomUUID().slice(0, 8);
    const maxUses = Number(stringValue(formData, "maxUses") || 20);
    const days = Number(stringValue(formData, "days") || 14);
    if (!Number.isFinite(maxUses) || maxUses < 1 || !Number.isFinite(days) || days < 1) {
      throw new Error("使用次数和有效天数必须大于 0");
    }
    await prisma.inviteCode.create({
      data: {
        codeHash: await hashInviteCode(rawCode),
        label: stringValue(formData, "label") || "新成员邀请",
        maxUses,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        createdById: user.id,
      },
    });
    revalidatePath("/admin");
    redirect(`/admin?invite=${encodeURIComponent(rawCode)}`);
  } catch (error) {
    redirectWithError("/admin", friendlyError(error, "邀请口令生成失败,请稍后再试"));
  }
}

export async function approveUserAction(formData: FormData) {
  try {
    const user = await requireLeader();
    const targetId = stringValue(formData, "userId");
    const role = z.enum(["MEMBER", "LEADER", "ADMIN"]).parse(stringValue(formData, "role") || "MEMBER");
    const target = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    if (!canManageScope(user, target) || (role === "ADMIN" && user.role !== "ADMIN")) {
      throw new Error("无权审核该成员");
    }
    await prisma.user.update({
      where: { id: targetId },
      data: {
        status: "ACTIVE",
        role,
        approvedAt: new Date(),
        approvedById: user.id,
      },
    });
    revalidatePath("/admin");
    redirectWithSuccess("/admin", "成员审核已更新");
  } catch (error) {
    redirectWithError("/admin", friendlyError(error, "成员审核失败,请稍后再试"));
  }
}

export async function banUserAction(formData: FormData) {
  try {
    const user = await requireLeader();
    const targetId = stringValue(formData, "userId");
    const target = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    if (!canManageScope(user, target) || target.role === "ADMIN") {
      throw new Error("无权禁用该成员");
    }
    await prisma.user.update({
      where: { id: targetId },
      data: { status: "BANNED", bannedReason: stringValue(formData, "reason") || "管理员禁用" },
    });
    revalidatePath("/admin");
    redirectWithSuccess("/admin", "成员已禁用");
  } catch (error) {
    redirectWithError("/admin", friendlyError(error, "禁用成员失败,请稍后再试"));
  }
}

export async function createDocAction(formData: FormData) {
  let slug = "";
  try {
    const user = await requireLeader();
    const division = divisionEnum.parse(stringValue(formData, "division"));
    const team = teamEnum.parse(stringValue(formData, "team"));
    if (!canManageScope(user, { division, team })) {
      throw new Error("无权发布该范围文档");
    }
    const title = stringValue(formData, "title");
    if (!title) {
      throw new Error("请填写文档标题");
    }
    slug = await uniqueDocSlug(stringValue(formData, "slug") || title);
    await prisma.techDoc.create({
      data: {
        title,
        slug,
        excerpt: stringValue(formData, "excerpt"),
        content: stringValue(formData, "content"),
        division,
        team,
        path: stringValue(formData, "path") || title,
        authorId: user.id,
      },
    });
    revalidatePath("/docs");
  } catch (error) {
    redirectWithError("/docs/new", friendlyError(error, "文档发布失败,请稍后再试"));
  }

  redirect(`/docs/${slug}`);
}

export async function createPostAction(formData: FormData) {
  try {
    const user = await requireUser();
    const imageUrls = await uploadForumImages(formData, `forum/posts/${user.id}`);
    await prisma.forumPost.create({
      data: {
        title: stringValue(formData, "title"),
        content: stringValue(formData, "content"),
        division: divisionEnum.parse(stringValue(formData, "division") || "GENERAL"),
        team: teamEnum.parse(stringValue(formData, "team") || "GENERAL"),
        tags: stringValue(formData, "tags").split(/[,\s]+/).filter(Boolean).slice(0, 8),
        imageUrls,
        isAnonymous: boolValue(formData, "isAnonymous"),
        authorId: user.id,
      },
    });
    revalidatePath("/forum");
    redirect("/forum");
  } catch (error) {
    redirectWithError("/forum/new", friendlyError(error, "帖子发布失败,请稍后再试"));
  }
}

export async function replyAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  const returnTo = safeReturnTo(formData, postId ? `/forum/${postId}` : "/forum");
  try {
    const user = await requireUser();
    const imageUrls = await uploadForumImages(formData, `forum/replies/${postId}/${user.id}`);
    await prisma.forumReply.create({
      data: {
        postId,
        content: stringValue(formData, "content"),
        imageUrls,
        isAnonymous: boolValue(formData, "isAnonymous"),
        authorId: user.id,
      },
    });
    revalidatePath(`/forum/${postId}`);
    redirectWithSuccess(returnTo, "回复已发布");
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "回复发布失败,请稍后再试"));
  }
}

export async function reportAction(formData: FormData) {
  const returnTo = safeReturnTo(formData, "/forum");
  try {
    const user = await requireUser();
    const reason = stringValue(formData, "reason");
    if (!reason) {
      throw new Error("请填写举报原因");
    }
    await prisma.report.create({
      data: {
        reason,
        reporterId: user.id,
        postId: stringValue(formData, "postId") || null,
        replyId: stringValue(formData, "replyId") || null,
      },
    });
    revalidatePath("/admin");
    redirectWithSuccess(returnTo, "举报已提交");
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "举报提交失败,请稍后再试"));
  }
}

export async function createAssignmentAction(formData: FormData) {
  try {
    const user = await requireLeader();
    const division = divisionEnum.parse(stringValue(formData, "division"));
    const team = teamEnum.parse(stringValue(formData, "team"));
    if (!canManageScope(user, { division, team })) {
      throw new Error("无权发布该范围作业");
    }
    const dueAt = new Date(stringValue(formData, "dueAt"));
    if (Number.isNaN(dueAt.getTime())) {
      throw new Error("请填写有效的截止时间");
    }
    const file = formData.get("attachment");
    const uploaded = file instanceof File && file.size > 0 ? await uploadObject(file, "assignment-assets") : null;
    await prisma.assignment.create({
      data: {
        title: stringValue(formData, "title"),
        description: stringValue(formData, "description"),
        division,
        team,
        dueAt,
        attachmentUrl: uploaded?.url,
        attachmentName: file instanceof File ? file.name : null,
        authorId: user.id,
      },
    });
    revalidatePath("/assignments");
    redirect("/assignments");
  } catch (error) {
    redirectWithError("/assignments/new", friendlyError(error, "作业发布失败,请稍后再试"));
  }
}

export async function submitAssignmentAction(formData: FormData) {
  const assignmentId = stringValue(formData, "assignmentId");
  const returnTo = safeReturnTo(formData, assignmentId ? `/assignments/${assignmentId}` : "/assignments");
  try {
    const user = await requireUser();
    const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("请选择要提交的文件");
    }
    const uploaded = await uploadObject(file, `submissions/${assignmentId}/${user.id}`);
    await prisma.submission.create({
      data: {
        assignmentId,
        studentId: user.id,
        fileUrl: uploaded.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        isLate: new Date() > assignment.dueAt,
      },
    });
    revalidatePath(`/assignments/${assignmentId}`);
    redirectWithSuccess(returnTo, "作业已提交");
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "作业提交失败,请稍后再试"));
  }
}

export async function reviewSubmissionAction(formData: FormData) {
  const returnTo = safeReturnTo(formData, "/assignments");
  try {
    const user = await requireLeader();
    const submission = await prisma.submission.findUniqueOrThrow({
      where: { id: stringValue(formData, "submissionId") },
      include: { assignment: true },
    });
    if (!canManageScope(user, submission.assignment)) {
      throw new Error("无权批改该作业");
    }
    const scoreText = stringValue(formData, "score");
    const score = scoreText ? Number(scoreText) : null;
    if (score !== null && !Number.isFinite(score)) {
      throw new Error("分数必须是数字");
    }
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        verdict: z.enum(["UNREVIEWED", "PASS", "FAIL"]).parse(stringValue(formData, "verdict")),
        score,
        feedback: stringValue(formData, "feedback"),
        reviewedAt: new Date(),
        reviewerId: user.id,
      },
    });
    revalidatePath(`/assignments/${submission.assignmentId}`);
    redirectWithSuccess(returnTo, "批改结果已保存");
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "批改保存失败,请稍后再试"));
  }
}

export async function revealAnonymousAuthorAction(formData: FormData) {
  try {
    const user = await requireLeader();
    if (user.role !== "ADMIN") {
      throw new Error("仅管理员可追溯匿名身份");
    }
    const postId = stringValue(formData, "postId");
    await prisma.auditLog.create({
      data: {
        action: "REVEAL_ANONYMOUS_AUTHOR",
        target: postId,
        actorId: user.id,
        metadata: { reason: stringValue(formData, "reason") },
      },
    });
    revalidatePath("/admin");
    redirectWithSuccess("/admin", "匿名追溯已记录到审计日志");
  } catch (error) {
    redirectWithError("/admin", friendlyError(error, "匿名追溯记录失败,请稍后再试"));
  }
}

async function hashInviteCode(code: string) {
  const data = new TextEncoder().encode(code.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueDocSlug(value: string) {
  const base = slugify(value) || `doc-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  let candidate = base;
  for (let index = 2; index <= 50; index += 1) {
    const existing = await prisma.techDoc.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${index}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function uploadForumImages(formData: FormData, prefix: string) {
  const files = formData
    .getAll("images")
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > 9) {
    throw new Error("最多上传 9 张图片");
  }
  const uploads = await Promise.all(
    files.map((file) => uploadImageObject(file, prefix)),
  );
  return uploads.map((item) => item.url);
}

export async function updateDocAction(formData: FormData) {
  let slug = "";
  try {
    const user = await requireLeader();
    const docId = stringValue(formData, "docId");
    const doc = await prisma.techDoc.findUniqueOrThrow({ where: { id: docId } });
    slug = doc.slug;

    if (doc.authorId !== user.id) {
      throw new Error("无权编辑该文档");
    }

    const division = divisionEnum.parse(stringValue(formData, "division"));
    const team = teamEnum.parse(stringValue(formData, "team"));
    if (!canManageScope(user, { division, team })) {
      throw new Error("无权将文档范围改为该部门/小组");
    }

    const title = stringValue(formData, "title");
    if (!title) throw new Error("请填写文档标题");

    await prisma.techDoc.update({
      where: { id: docId },
      data: {
        title,
        path: stringValue(formData, "path") || title,
        excerpt: stringValue(formData, "excerpt"),
        content: stringValue(formData, "content"),
        division,
        team,
      },
    });

    revalidatePath(`/docs/${slug}`);
    revalidatePath("/docs");
  } catch (error) {
    redirectWithError(slug ? `/docs/${slug}/edit` : "/docs", friendlyError(error, "文档更新失败,请稍后再试"));
  }

  redirect(`/docs/${slug}?success=${encodeURIComponent("文档已更新")}`);
}

export async function deleteDocAction(formData: FormData) {
  const slug = stringValue(formData, "slug");
  try {
    const user = await requireUser();
    const docId = stringValue(formData, "docId");
    const doc = await prisma.techDoc.findUniqueOrThrow({ where: { id: docId } });

    if (doc.authorId !== user.id && user.role !== "ADMIN") {
      throw new Error("无权删除该文档");
    }

    await prisma.techDoc.delete({ where: { id: docId } });
    revalidatePath("/docs");
  } catch (error) {
    redirectWithError(slug ? `/docs/${slug}` : "/docs", friendlyError(error, "文档删除失败,请稍后再试"));
  }

  redirect("/docs");
}

export async function updatePostAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  try {
    const user = await requireUser();
    const post = await prisma.forumPost.findUniqueOrThrow({ where: { id: postId } });

    if (post.authorId !== user.id) {
      throw new Error("无权编辑该帖子");
    }

    const keepImages = formData
      .getAll("keepImage")
      .filter((v): v is string => typeof v === "string");
    const newImageUrls = await uploadForumImages(formData, `forum/posts/${user.id}`);
    if (keepImages.length + newImageUrls.length > 9) {
      throw new Error("最多保留 9 张图片");
    }

    await prisma.forumPost.update({
      where: { id: postId },
      data: {
        title: stringValue(formData, "title"),
        content: stringValue(formData, "content"),
        tags: stringValue(formData, "tags")
          .split(/[,\s]+/)
          .filter(Boolean)
          .slice(0, 8),
        imageUrls: [...keepImages, ...newImageUrls],
      },
    });

    revalidatePath(`/forum/${postId}`);
    revalidatePath("/forum");
  } catch (error) {
    redirectWithError(`/forum/${postId}/edit`, friendlyError(error, "帖子更新失败,请稍后再试"));
  }

  redirect(`/forum/${postId}?success=${encodeURIComponent("帖子已更新")}`);
}

export async function deletePostAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  try {
    const user = await requireUser();
    const post = await prisma.forumPost.findUniqueOrThrow({ where: { id: postId } });

    if (post.authorId !== user.id && user.role !== "ADMIN") {
      throw new Error("无权删除该帖子");
    }

    await prisma.forumPost.delete({ where: { id: postId } });
    revalidatePath("/forum");
  } catch (error) {
    redirectWithError(`/forum/${postId}`, friendlyError(error, "帖子删除失败,请稍后再试"));
  }

  redirect("/forum");
}

export async function updateReplyAction(formData: FormData) {
  const replyId = stringValue(formData, "replyId");
  const postId = stringValue(formData, "postId");
  const returnTo = safeReturnTo(formData, postId ? `/forum/${postId}` : "/forum");
  try {
    const user = await requireUser();
    const reply = await prisma.forumReply.findUniqueOrThrow({ where: { id: replyId } });

    if (reply.authorId !== user.id) {
      throw new Error("无权编辑该回复");
    }

    const content = stringValue(formData, "content");
    if (!content) throw new Error("回复内容不能为空");

    await prisma.forumReply.update({
      where: { id: replyId },
      data: { content },
    });

    revalidatePath(`/forum/${postId}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "回复更新失败,请稍后再试"));
  }

  redirectWithSuccess(returnTo, "回复已更新");
}

export async function deleteReplyAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  try {
    const user = await requireUser();
    const replyId = stringValue(formData, "replyId");
    const reply = await prisma.forumReply.findUniqueOrThrow({ where: { id: replyId } });

    if (reply.authorId !== user.id && user.role !== "ADMIN") {
      throw new Error("无权删除该回复");
    }

    await prisma.forumReply.delete({ where: { id: replyId } });
    revalidatePath(`/forum/${postId}`);
  } catch (error) {
    redirectWithError(`/forum/${postId}`, friendlyError(error, "回复删除失败,请稍后再试"));
  }

  redirectWithSuccess(`/forum/${postId}`, "回复已删除");
}

export async function acceptReplyAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  const replyId = stringValue(formData, "replyId");
  const returnTo = safeReturnTo(formData, `/forum/${postId}`);
  try {
    const user = await requireUser();
    const [post, reply] = await Promise.all([
      prisma.forumPost.findUniqueOrThrow({ where: { id: postId }, select: { authorId: true, solutionReplyId: true } }),
      prisma.forumReply.findUniqueOrThrow({ where: { id: replyId }, select: { postId: true } }),
    ]);
    if (post.authorId !== user.id) throw new Error("只有楼主才能采纳最佳答案");
    if (reply.postId !== postId) throw new Error("回复不属于该帖子");

    await prisma.$transaction(async (tx) => {
      if (post.solutionReplyId && post.solutionReplyId !== replyId) {
        await tx.forumReply.update({ where: { id: post.solutionReplyId }, data: { isAccepted: false } });
      }
      await tx.forumReply.update({ where: { id: replyId }, data: { isAccepted: true } });
      await tx.forumPost.update({ where: { id: postId }, data: { solutionReplyId: replyId, isSolved: true } });
    });
    revalidatePath(`/forum/${postId}`);
    revalidatePath("/forum");
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "采纳失败，请稍后重试"));
  }
  redirect(returnTo);
}

export async function unacceptReplyAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  const replyId = stringValue(formData, "replyId");
  const returnTo = safeReturnTo(formData, `/forum/${postId}`);
  try {
    const user = await requireUser();
    const post = await prisma.forumPost.findUniqueOrThrow({ where: { id: postId }, select: { authorId: true } });
    if (post.authorId !== user.id) throw new Error("只有楼主才能操作最佳答案");
    await prisma.$transaction([
      prisma.forumReply.update({ where: { id: replyId }, data: { isAccepted: false } }),
      prisma.forumPost.update({ where: { id: postId }, data: { solutionReplyId: null } }),
    ]);
    revalidatePath(`/forum/${postId}`);
    revalidatePath("/forum");
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "操作失败，请稍后重试"));
  }
  redirect(returnTo);
}

export async function toggleSolvedAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  const returnTo = safeReturnTo(formData, `/forum/${postId}`);
  try {
    const user = await requireUser();
    const post = await prisma.forumPost.findUniqueOrThrow({ where: { id: postId }, select: { authorId: true, isSolved: true } });
    if (post.authorId !== user.id) throw new Error("只有楼主才能切换解决状态");
    await prisma.forumPost.update({ where: { id: postId }, data: { isSolved: !post.isSolved } });
    revalidatePath(`/forum/${postId}`);
    revalidatePath("/forum");
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "操作失败，请稍后重试"));
  }
  redirect(returnTo);
}

export async function togglePostLikeAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  const returnTo = safeReturnTo(formData, `/forum/${postId}`);
  try {
    const user = await requireUser();
    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    });
    if (existing) {
      await prisma.postLike.delete({ where: { userId_postId: { userId: user.id, postId } } });
    } else {
      await prisma.postLike.create({ data: { userId: user.id, postId } });
    }
    revalidatePath(`/forum/${postId}`);
    revalidatePath("/forum");
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "点赞操作失败，请稍后重试"));
  }
  redirect(returnTo);
}

export async function toggleReplyLikeAction(formData: FormData) {
  const replyId = stringValue(formData, "replyId");
  const postId = stringValue(formData, "postId");
  const returnTo = safeReturnTo(formData, `/forum/${postId}`);
  try {
    const user = await requireUser();
    const existing = await prisma.replyLike.findUnique({
      where: { userId_replyId: { userId: user.id, replyId } },
    });
    if (existing) {
      await prisma.replyLike.delete({ where: { userId_replyId: { userId: user.id, replyId } } });
    } else {
      await prisma.replyLike.create({ data: { userId: user.id, replyId } });
    }
    revalidatePath(`/forum/${postId}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "点赞操作失败，请稍后重试"));
  }
  redirect(returnTo);
}
