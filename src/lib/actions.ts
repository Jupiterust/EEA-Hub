"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { signIn, signOut, auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageScope, requireLeader, requireUser } from "@/lib/authz";
import { uploadImageObject, uploadObject } from "@/lib/storage";
import { extractMentionUsernames, buildMentionMap } from "@/lib/mentions";

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

export async function updateProfileAction(formData: FormData) {
  try {
    const user = await requireUser();
    const realName = stringValue(formData, "realName").trim();
    const email = stringValue(formData, "email").trim() || null;
    const qq = stringValue(formData, "qq").trim() || null;
    const bio = stringValue(formData, "bio").trim() || null;
    const major = stringValue(formData, "major").trim() || null;
    const grade = stringValue(formData, "grade").trim() || null;
    if (!realName) {
      throw new Error("真实姓名不能为空");
    }
    if (bio && bio.length > 100) {
      throw new Error("个性签名不能超过 100 字");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("邮箱格式不正确");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { realName, email, qq, bio, major, grade },
    });
    redirectWithSuccess("/dashboard", "资料已更新，姓名变更将在重新登录后生效");
  } catch (error) {
    redirectWithError("/dashboard", friendlyError(error, "资料更新失败，请稍后再试"));
  }
}

export async function changePasswordAction(formData: FormData) {
  try {
    const user = await requireUser();
    const currentPassword = stringValue(formData, "currentPassword");
    const newPassword = stringValue(formData, "newPassword");
    const confirmPassword = stringValue(formData, "confirmPassword");
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error("请填写所有密码字段");
    }
    if (newPassword.length < 6) {
      throw new Error("新密码至少需要 6 位");
    }
    if (newPassword !== confirmPassword) {
      throw new Error("新密码与确认密码不一致");
    }
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    const ok = await compare(currentPassword, dbUser.passwordHash);
    if (!ok) {
      throw new Error("当前密码不正确");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(newPassword, 12) },
    });
    redirectWithSuccess("/dashboard", "密码修改成功");
  } catch (error) {
    redirectWithError("/dashboard", friendlyError(error, "密码修改失败，请稍后再试"));
  }
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
    const user = await requireUser();
    const division = divisionEnum.parse(stringValue(formData, "division"));
    const team = teamEnum.parse(stringValue(formData, "team"));
    if (user.role === "MEMBER") {
      if (division !== user.division || (team !== user.team && team !== "GENERAL")) {
        throw new Error("普通成员只能在自己所属的部门/小组发布文档");
      }
    } else if (!canManageScope(user, { division, team })) {
      throw new Error("无权发布该范围文档");
    }
    const title = stringValue(formData, "title");
    if (!title) {
      throw new Error("请填写文档标题");
    }
    slug = await uniqueDocSlug(stringValue(formData, "slug") || title);
    const doc = await prisma.techDoc.create({
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
    // Notify followers of new doc
    const docFollowers = await prisma.follow.findMany({
      where: { followingId: user.id },
      select: { followerId: true },
    });
    await Promise.all(
      docFollowers.map((f) =>
        createNotification({
          recipientId: f.followerId,
          type: "FOLLOW",
          message: `${user.name ?? "有用户"} 发布了新文档《${title}》`,
          linkUrl: `/docs/${doc.slug}`,
          relatedId: doc.id,
        })
      )
    );
    revalidatePath("/docs");
  } catch (error) {
    redirectWithError("/docs/new", friendlyError(error, "文档发布失败,请稍后再试"));
  }

  redirect(`/docs/${slug}`);
}

export async function createPostAction(formData: FormData) {
  try {
    const user = await requireUser();
    const isAnonymous = boolValue(formData, "isAnonymous");
    const title = stringValue(formData, "title");
    const imageUrls = await uploadForumImages(formData, `forum/posts/${user.id}`);
    const post = await prisma.forumPost.create({
      data: {
        title,
        content: stringValue(formData, "content"),
        division: divisionEnum.parse(stringValue(formData, "division") || "GENERAL"),
        team: teamEnum.parse(stringValue(formData, "team") || "GENERAL"),
        tags: stringValue(formData, "tags").split(/[,\s]+/).filter(Boolean).slice(0, 8),
        imageUrls,
        isAnonymous,
        authorId: user.id,
      },
    });
    // Only notify followers for non-anonymous posts to protect anonymity
    if (!isAnonymous) {
      const postFollowers = await prisma.follow.findMany({
        where: { followingId: user.id },
        select: { followerId: true },
      });
      await Promise.all(
        postFollowers.map((f) =>
          createNotification({
            recipientId: f.followerId,
            type: "FOLLOW",
            message: `${user.name ?? "有用户"} 发布了新帖子《${post.title}》`,
            linkUrl: `/forum/${post.id}`,
            relatedId: post.id,
          })
        )
      );
    }
    await notifyMentions(post.title + "\n" + stringValue(formData, "content"), {
      senderId: user.id,
      senderName: user.name ?? "",
      isAnonymous,
      linkUrl: `/forum/${post.id}`,
      relatedId: post.id,
      contextLabel: "帖子",
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
    const isAnonymous = boolValue(formData, "isAnonymous");
    const content = stringValue(formData, "content");
    const parentIdInput = stringValue(formData, "parentId") || null;
    const replyToIdInput = stringValue(formData, "replyToId") || null;

    // Validate post and parent reply in parallel
    const [post, parentReplyData] = await Promise.all([
      prisma.forumPost.findUnique({ where: { id: postId }, select: { authorId: true, title: true } }),
      parentIdInput
        ? prisma.forumReply.findUnique({ where: { id: parentIdInput }, select: { postId: true, parentId: true } })
        : Promise.resolve(null),
    ]);
    if (!post) throw new Error("帖子不存在");

    // Resolve parentId: flatten to 1 level (if someone passes a sub-reply id, go up to its parent)
    let parentId: string | null = null;
    let replyToId: string | null = null;
    if (parentIdInput) {
      if (!parentReplyData || parentReplyData.postId !== postId) throw new Error("被回复的回复不存在");
      parentId = parentReplyData.parentId ?? parentIdInput;
      replyToId = replyToIdInput ?? parentIdInput;
    }

    const imageUrls = await uploadForumImages(formData, `forum/replies/${postId}/${user.id}`);
    await prisma.forumReply.create({
      data: { postId, content, imageUrls, isAnonymous, authorId: user.id, parentId, replyToId },
    });

    const actorName = isAnonymous ? "有匿名用户" : (user.name ?? "有用户");
    if (parentId && replyToId) {
      // Sub-reply: notify the @-mentioned reply's author
      const mentionedReply = await prisma.forumReply.findUnique({
        where: { id: replyToId },
        select: { authorId: true },
      });
      if (mentionedReply && mentionedReply.authorId !== user.id) {
        await createNotification({
          recipientId: mentionedReply.authorId,
          type: "REPLY",
          message: `${actorName}回复了你在《${post.title}》中的回复`,
          linkUrl: `/forum/${postId}`,
          relatedId: `reply:${replyToId}`,
        });
      }
    } else if (post.authorId !== user.id) {
      // Main reply: notify post author
      await createNotification({
        recipientId: post.authorId,
        type: "REPLY",
        message: `${actorName}回复了你的帖子《${post.title}》`,
        linkUrl: `/forum/${postId}`,
        relatedId: postId,
      });
    }

    await notifyMentions(content, {
      senderId: user.id,
      senderName: user.name ?? "",
      isAnonymous,
      linkUrl: `/forum/${postId}`,
      relatedId: postId,
      contextLabel: "回复",
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
    if (assignment.status === "CLOSED") {
      throw new Error("作业已关闭，无法提交");
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("请选择要提交的文件");
    }
    const uploaded = await uploadObject(file, `submissions/${assignmentId}/${user.id}`);
    const submissionData = {
      fileUrl: uploaded.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      isLate: new Date() > assignment.dueAt,
    };
    await prisma.submission.upsert({
      where: { studentId_assignmentId: { studentId: user.id, assignmentId } },
      create: { assignmentId, studentId: user.id, ...submissionData },
      update: {
        ...submissionData,
        // Reset review state when student resubmits
        verdict: "UNREVIEWED",
        feedback: null,
        score: null,
        reviewedAt: null,
        reviewerId: null,
        submittedAt: new Date(),
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
    const verdict = z.enum(["UNREVIEWED", "PASS", "FAIL"]).parse(stringValue(formData, "verdict"));
    const feedback = stringValue(formData, "feedback");
    await prisma.submission.update({
      where: { id: submission.id },
      data: { verdict, score, feedback, reviewedAt: new Date(), reviewerId: user.id },
    });
    if (verdict !== "UNREVIEWED") {
      const resultText = verdict === "PASS" ? "通过" : "需修改";
      const message = feedback
        ? `你提交的作业《${submission.assignment.title}》已批改，结果：${resultText}。反馈：${feedback}`
        : `你提交的作业《${submission.assignment.title}》已批改，结果：${resultText}`;
      await createNotification({
        recipientId: submission.studentId,
        type: "COMMENT",
        message,
        linkUrl: `/assignments/${submission.assignmentId}`,
        relatedId: submission.id,
      });
    }
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

export async function resolveReportAction(formData: FormData) {
  try {
    const user = await requireLeader();
    if (user.role !== "ADMIN") {
      throw new Error("仅管理员可处理举报");
    }
    const reportId = stringValue(formData, "reportId");
    const deleteContent = stringValue(formData, "deleteContent") === "true";

    if (deleteContent) {
      const report = await prisma.report.findUnique({
        where: { id: reportId },
        select: { postId: true, replyId: true },
      });
      if (report?.postId) {
        // Cascade deletes all replies and related reports
        await prisma.forumPost.deleteMany({ where: { id: report.postId } });
        revalidatePath("/forum");
      } else if (report?.replyId) {
        const replyId = report.replyId;
        const [childCount, mentionCount] = await Promise.all([
          prisma.forumReply.count({ where: { parentId: replyId } }),
          prisma.forumReply.count({ where: { replyToId: replyId } }),
        ]);
        if (childCount > 0 || mentionCount > 0) {
          await prisma.forumReply.update({ where: { id: replyId }, data: { isDeleted: true } });
        } else {
          // Hard delete cascades to related reports
          await prisma.forumReply.deleteMany({ where: { id: replyId } });
        }
      }
      // No-op if report was already cascade-deleted
      await prisma.report.updateMany({ where: { id: reportId }, data: { status: "RESOLVED" } });
    } else {
      await prisma.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
    }

    revalidatePath("/admin");
    redirectWithSuccess("/admin", deleteContent ? "举报已处理，内容已删除" : "举报已标记为已处理");
  } catch (error) {
    redirectWithError("/admin", friendlyError(error, "操作失败，请稍后再试"));
  }
}

export async function dismissReportAction(formData: FormData) {
  try {
    const user = await requireLeader();
    if (user.role !== "ADMIN") {
      throw new Error("仅管理员可处理举报");
    }
    await prisma.report.update({
      where: { id: stringValue(formData, "reportId") },
      data: { status: "DISMISSED" },
    });
    revalidatePath("/admin");
    redirectWithSuccess("/admin", "举报已驳回");
  } catch (error) {
    redirectWithError("/admin", friendlyError(error, "操作失败，请稍后再试"));
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

/** Send MENTION notifications for every @username found in content */
async function notifyMentions(
  content: string,
  {
    senderId,
    senderName,
    isAnonymous,
    linkUrl,
    relatedId,
    contextLabel,
  }: {
    senderId: string;
    senderName: string;
    isAnonymous: boolean;
    linkUrl: string;
    relatedId: string;
    contextLabel: string; // e.g. "帖子" | "回复" | "评论"
  }
) {
  try {
    const usernames = extractMentionUsernames(content);
    if (usernames.length === 0) return;
    const mentionMap = await buildMentionMap(usernames);
    const actor = isAnonymous ? "有人" : senderName;
    await Promise.all(
      [...mentionMap.values()]
        .filter((u) => u.id !== senderId)
        .slice(0, 10)
        .map((u) =>
          createNotification({
            recipientId: u.id,
            type: "MENTION",
            message: `${actor}在${contextLabel}中@了你`,
            linkUrl,
            relatedId,
          })
        )
    );
  } catch {
    // mention notification failure must never break the main action
  }
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

async function createNotification(data: {
  recipientId: string;
  type: "REPLY" | "ACCEPT" | "LIKE" | "COMMENT" | "DEADLINE" | "FOLLOW" | "MENTION";
  message: string;
  linkUrl: string;
  relatedId: string;
}) {
  try {
    await prisma.notification.create({ data });
  } catch {
    // notification failure must never break the main action
  }
}

async function upsertLikeNotification(data: {
  recipientId: string;
  linkUrl: string;
  relatedId: string;
  buildMessage: (count: number) => string;
}) {
  try {
    const existing = await prisma.notification.findFirst({
      where: { recipientId: data.recipientId, type: "LIKE", relatedId: data.relatedId, isRead: false },
    });
    if (existing) {
      const newCount = existing.count + 1;
      await prisma.notification.update({
        where: { id: existing.id },
        data: { count: newCount, message: data.buildMessage(newCount) },
      });
    } else {
      await prisma.notification.create({
        data: {
          recipientId: data.recipientId,
          type: "LIKE",
          message: data.buildMessage(1),
          linkUrl: data.linkUrl,
          relatedId: data.relatedId,
        },
      });
    }
  } catch {
    // notification failure must never break the main action
  }
}

export async function updateDocAction(formData: FormData) {
  let slug = "";
  try {
    const user = await requireUser();
    const docId = stringValue(formData, "docId");
    const doc = await prisma.techDoc.findUniqueOrThrow({ where: { id: docId } });
    slug = doc.slug;

    if (doc.authorId !== user.id && user.role !== "ADMIN") {
      throw new Error("无权编辑该文档");
    }

    const division = divisionEnum.parse(stringValue(formData, "division"));
    const team = teamEnum.parse(stringValue(formData, "team"));
    if (user.role === "MEMBER") {
      if (division !== user.division || (team !== user.team && team !== "GENERAL")) {
        throw new Error("普通成员只能将文档范围设为自己所属的部门/小组");
      }
    } else if (!canManageScope(user, { division, team })) {
      throw new Error("无权将文档范围改为该部门/小组");
    }

    const title = stringValue(formData, "title");
    if (!title) throw new Error("请填写文档标题");

    await prisma.$transaction([
      // Save version snapshot of the CURRENT content before overwriting
      prisma.docVersion.create({
        data: {
          docId,
          title: doc.title,
          content: doc.content,
          editorId: user.id,
        },
      }),
      prisma.techDoc.update({
        where: { id: docId },
        data: {
          title,
          path: stringValue(formData, "path") || title,
          excerpt: stringValue(formData, "excerpt"),
          content: stringValue(formData, "content"),
          division,
          team,
        },
      }),
    ]);

    revalidatePath(`/docs/${slug}`);
    revalidatePath(`/docs/${slug}/history`);
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
    const [reply, childCount, mentionCount] = await Promise.all([
      prisma.forumReply.findUniqueOrThrow({ where: { id: replyId } }),
      prisma.forumReply.count({ where: { parentId: replyId } }),
      prisma.forumReply.count({ where: { replyToId: replyId } }),
    ]);

    if (reply.authorId !== user.id && user.role !== "ADMIN") {
      throw new Error("无权删除该回复");
    }

    // Soft-delete when any reply has this as parent OR @-mentions it,
    // so sub-reply context and @-mention anchors remain valid
    if (childCount > 0 || mentionCount > 0) {
      await prisma.forumReply.update({ where: { id: replyId }, data: { isDeleted: true } });
    } else {
      await prisma.forumReply.delete({ where: { id: replyId } });
    }
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
      prisma.forumPost.findUniqueOrThrow({ where: { id: postId }, select: { authorId: true, solutionReplyId: true, title: true } }),
      prisma.forumReply.findUniqueOrThrow({ where: { id: replyId }, select: { postId: true, authorId: true } }),
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
    if (reply.authorId !== user.id) {
      await createNotification({
        recipientId: reply.authorId,
        type: "ACCEPT",
        message: `你的回复被采纳为最佳答案（帖子：《${post.title}》）`,
        linkUrl: `/forum/${postId}`,
        relatedId: replyId,
      });
    }
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
      prisma.forumPost.update({ where: { id: postId }, data: { solutionReplyId: null, isSolved: false } }),
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
    const [existing, post] = await Promise.all([
      prisma.postLike.findUnique({ where: { userId_postId: { userId: user.id, postId } } }),
      prisma.forumPost.findUnique({ where: { id: postId }, select: { authorId: true, title: true } }),
    ]);
    if (existing) {
      await prisma.postLike.delete({ where: { userId_postId: { userId: user.id, postId } } });
    } else {
      await prisma.postLike.create({ data: { userId: user.id, postId } });
      if (post && post.authorId !== user.id) {
        await upsertLikeNotification({
          recipientId: post.authorId,
          linkUrl: `/forum/${postId}`,
          relatedId: `post:${postId}`,
          buildMessage: (count) =>
            count === 1 ? `有人点赞了你的帖子《${post.title}》` : `${count} 人点赞了你的帖子《${post.title}》`,
        });
      }
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
    const [existing, reply] = await Promise.all([
      prisma.replyLike.findUnique({ where: { userId_replyId: { userId: user.id, replyId } } }),
      prisma.forumReply.findUnique({ where: { id: replyId }, select: { authorId: true } }),
    ]);
    if (existing) {
      await prisma.replyLike.delete({ where: { userId_replyId: { userId: user.id, replyId } } });
    } else {
      await prisma.replyLike.create({ data: { userId: user.id, replyId } });
      if (reply && reply.authorId !== user.id) {
        await upsertLikeNotification({
          recipientId: reply.authorId,
          linkUrl: `/forum/${postId}`,
          relatedId: `reply:${replyId}`,
          buildMessage: (count) =>
            count === 1 ? "有人点赞了你的回复" : `${count} 人点赞了你的回复`,
        });
      }
    }
    revalidatePath(`/forum/${postId}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "点赞操作失败，请稍后重试"));
  }
  redirect(returnTo);
}

export async function toggleDocLikeAction(formData: FormData) {
  const docId = stringValue(formData, "docId");
  const slug = stringValue(formData, "slug");
  const returnTo = safeReturnTo(formData, `/docs/${slug}`);
  try {
    const user = await requireUser();
    const [existing, doc] = await Promise.all([
      prisma.docLike.findUnique({ where: { userId_docId: { userId: user.id, docId } } }),
      prisma.techDoc.findUnique({ where: { id: docId }, select: { authorId: true, title: true } }),
    ]);
    if (existing) {
      await prisma.docLike.delete({ where: { userId_docId: { userId: user.id, docId } } });
    } else {
      await prisma.docLike.create({ data: { userId: user.id, docId } });
      if (doc && doc.authorId !== user.id) {
        await upsertLikeNotification({
          recipientId: doc.authorId,
          linkUrl: `/docs/${slug}`,
          relatedId: `doc:${docId}`,
          buildMessage: (count) =>
            count === 1 ? `有人点赞了你的文档《${doc.title}》` : `${count} 人点赞了你的文档《${doc.title}》`,
        });
      }
    }
    revalidatePath(`/docs/${slug}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "点赞操作失败，请稍后重试"));
  }
  redirect(returnTo);
}

export async function createDocCommentAction(formData: FormData) {
  const docId = stringValue(formData, "docId");
  const slug = stringValue(formData, "slug");
  const returnTo = safeReturnTo(formData, `/docs/${slug}`);
  try {
    const user = await requireUser();
    const content = stringValue(formData, "content");
    if (!content) throw new Error("评论内容不能为空");
    const isAnonymous = boolValue(formData, "isAnonymous");
    const parentIdInput = stringValue(formData, "parentId") || null;
    const replyToIdInput = stringValue(formData, "replyToId") || null;

    const [doc, parentCommentData] = await Promise.all([
      prisma.techDoc.findUnique({ where: { id: docId }, select: { authorId: true, title: true } }),
      parentIdInput
        ? prisma.docComment.findUnique({ where: { id: parentIdInput }, select: { docId: true, parentId: true } })
        : Promise.resolve(null),
    ]);
    if (!doc) throw new Error("文档不存在");

    // Flatten to 1 level: if parent is itself a sub-comment, go up to its parent
    let parentId: string | null = null;
    let replyToId: string | null = null;
    if (parentIdInput) {
      if (!parentCommentData || parentCommentData.docId !== docId) throw new Error("被回复的评论不存在");
      parentId = parentCommentData.parentId ?? parentIdInput;
      replyToId = replyToIdInput ?? parentIdInput;
    }

    await prisma.docComment.create({ data: { docId, authorId: user.id, content, isAnonymous, parentId, replyToId } });

    const actorName = isAnonymous ? "有匿名用户" : (user.name ?? "有用户");
    if (parentId && replyToId) {
      // Sub-comment: notify the @-mentioned comment's author
      const mentionedComment = await prisma.docComment.findUnique({
        where: { id: replyToId },
        select: { authorId: true },
      });
      if (mentionedComment && mentionedComment.authorId !== user.id) {
        await createNotification({
          recipientId: mentionedComment.authorId,
          type: "REPLY",
          message: `${actorName}回复了你在文档《${doc.title}》中的评论`,
          linkUrl: `/docs/${slug}`,
          relatedId: `comment:${replyToId}`,
        });
      }
    } else if (doc.authorId !== user.id) {
      // Top-level comment: notify doc author
      await createNotification({
        recipientId: doc.authorId,
        type: "COMMENT",
        message: `${actorName}评论了你的文档《${doc.title}》`,
        linkUrl: `/docs/${slug}`,
        relatedId: docId,
      });
    }

    await notifyMentions(content, {
      senderId: user.id,
      senderName: user.name ?? "",
      isAnonymous,
      linkUrl: `/docs/${slug}`,
      relatedId: docId,
      contextLabel: "评论",
    });

    revalidatePath(`/docs/${slug}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "评论发表失败，请稍后重试"));
  }
  redirect(returnTo);
}

export async function updateDocCommentAction(formData: FormData) {
  const commentId = stringValue(formData, "commentId");
  const slug = stringValue(formData, "slug");
  const returnTo = safeReturnTo(formData, `/docs/${slug}`);
  try {
    const user = await requireUser();
    const comment = await prisma.docComment.findUniqueOrThrow({ where: { id: commentId } });
    if (comment.authorId !== user.id) throw new Error("无权编辑该评论");
    const content = stringValue(formData, "content");
    if (!content) throw new Error("评论内容不能为空");
    await prisma.docComment.update({ where: { id: commentId }, data: { content } });
    revalidatePath(`/docs/${slug}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "评论更新失败，请稍后重试"));
  }
  redirectWithSuccess(returnTo, "评论已更新");
}

export async function deleteDocCommentAction(formData: FormData) {
  const commentId = stringValue(formData, "commentId");
  const slug = stringValue(formData, "slug");
  const returnTo = safeReturnTo(formData, `/docs/${slug}`);
  try {
    const user = await requireUser();
    const [comment, childCount, mentionCount] = await Promise.all([
      prisma.docComment.findUniqueOrThrow({ where: { id: commentId } }),
      prisma.docComment.count({ where: { parentId: commentId } }),
      prisma.docComment.count({ where: { replyToId: commentId } }),
    ]);
    if (comment.authorId !== user.id && user.role !== "ADMIN") throw new Error("无权删除该评论");
    if (childCount > 0 || mentionCount > 0) {
      await prisma.docComment.update({ where: { id: commentId }, data: { isDeleted: true } });
    } else {
      await prisma.docComment.delete({ where: { id: commentId } });
    }
    revalidatePath(`/docs/${slug}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "评论删除失败，请稍后重试"));
  }
  redirectWithSuccess(returnTo, "评论已删除");
}

export async function toggleDocCommentLikeAction(formData: FormData) {
  const commentId = stringValue(formData, "commentId");
  const slug = stringValue(formData, "slug");
  const returnTo = safeReturnTo(formData, `/docs/${slug}`);
  try {
    const user = await requireUser();
    const [existing, comment] = await Promise.all([
      prisma.docCommentLike.findUnique({ where: { userId_commentId: { userId: user.id, commentId } } }),
      prisma.docComment.findUnique({ where: { id: commentId }, select: { authorId: true, docId: true } }),
    ]);
    if (existing) {
      await prisma.docCommentLike.delete({ where: { userId_commentId: { userId: user.id, commentId } } });
    } else {
      await prisma.docCommentLike.create({ data: { userId: user.id, commentId } });
      if (comment && comment.authorId !== user.id) {
        await upsertLikeNotification({
          recipientId: comment.authorId,
          linkUrl: `/docs/${slug}`,
          relatedId: `comment:${commentId}`,
          buildMessage: (count) =>
            count === 1 ? "有人点赞了你的评论" : `${count} 人点赞了你的评论`,
        });
      }
    }
    revalidatePath(`/docs/${slug}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "点赞操作失败，请稍后重试"));
  }
  redirect(returnTo);
}

export async function markNotificationReadAction(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: session.user.id },
    data: { isRead: true },
  }).catch(() => {});
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.notification.updateMany({
    where: { recipientId: session.user.id, isRead: false },
    data: { isRead: true },
  }).catch(() => {});
}

export async function deleteNotificationAction(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.notification.deleteMany({
    where: { id: notificationId, recipientId: session.user.id },
  }).catch(() => {});
}

export async function clearReadNotificationsAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.notification.deleteMany({
    where: { recipientId: session.user.id, isRead: true },
  }).catch(() => {});
}

export async function uploadAvatarAction(formData: FormData) {
  try {
    const user = await requireUser();
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw new Error("请选择一张图片");
    if (file.size > 2 * 1024 * 1024) throw new Error("头像图片不能超过 2MB");
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.type)) throw new Error("头像仅支持 jpg、png、webp 格式");
    const { url } = await uploadImageObject(file, `avatars/${user.id}`);
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
    revalidatePath("/dashboard");
  } catch (error) {
    redirectWithError("/dashboard", friendlyError(error, "头像上传失败，请稍后重试"));
  }
  redirectWithSuccess("/dashboard", "头像已更新");
}

export async function toggleFollowAction(followingId: string) {
  try {
    const user = await requireUser();
    if (user.id === followingId) throw new Error("不能关注自己");
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: user.id, followingId } },
    });
    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId: user.id, followingId } },
      });
    } else {
      await prisma.follow.create({ data: { followerId: user.id, followingId } });
      await createNotification({
        recipientId: followingId,
        type: "FOLLOW",
        message: `${user.name ?? "有用户"} 关注了你`,
        linkUrl: `/profile/${user.id}`,
        relatedId: user.id,
      });
    }
    revalidatePath(`/profile/${followingId}`);
    revalidatePath(`/profile/${user.id}`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    // follow toggle failure is non-critical; swallow silently
  }
}

export async function togglePinAction(formData: FormData) {
  const postId = stringValue(formData, "postId");
  const returnTo = safeReturnTo(formData, postId ? `/forum/${postId}` : "/forum");
  try {
    await requireLeader();
    const post = await prisma.forumPost.findUniqueOrThrow({
      where: { id: postId },
      select: { isPinned: true },
    });
    if (post.isPinned) {
      await prisma.forumPost.update({
        where: { id: postId },
        data: { isPinned: false, pinnedAt: null },
      });
    } else {
      const pinnedCount = await prisma.forumPost.count({ where: { isPinned: true } });
      if (pinnedCount >= 5) throw new Error("最多只能置顶 5 条帖子");
      await prisma.forumPost.update({
        where: { id: postId },
        data: { isPinned: true, pinnedAt: new Date() },
      });
    }
    revalidatePath("/forum");
    revalidatePath(`/forum/${postId}`);
  } catch (error) {
    redirectWithError(returnTo, friendlyError(error, "置顶操作失败，请稍后重试"));
  }
  redirect(returnTo);
}
