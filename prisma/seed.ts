import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function hashInviteCode(code: string) {
  const data = new TextEncoder().encode(code.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "eea-admin-123456";
  const inviteCode = process.env.SEED_INVITE_CODE ?? "EEA2026";

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@example.com",
      realName: "技术负责人",
      passwordHash: await hash(adminPassword, 12),
      role: "ADMIN",
      status: "ACTIVE",
      division: "GENERAL",
      team: "GENERAL",
      approvedAt: new Date(),
    },
  });

  await prisma.inviteCode.upsert({
    where: { codeHash: await hashInviteCode(inviteCode) },
    update: {},
    create: {
      codeHash: await hashInviteCode(inviteCode),
      label: "初始化邀请口令",
      maxUses: 100,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdById: admin.id,
    },
  });

  await prisma.techDoc.upsert({
    where: { slug: "new-member-guide" },
    update: {},
    create: {
      title: "新人学习路径",
      slug: "new-member-guide",
      path: "新人指南 > 学习路径",
      excerpt: "电协新人入门建议：基础工具、嵌入式开发、FPGA 与硬件调试。",
      content: [
        "# 新人学习路径",
        "",
        "## 通用准备",
        "",
        "- Git 与 Markdown",
        "- C/C++ 基础",
        "- 示波器、万用表和串口工具",
        "",
        "## STM32 GPIO 示例",
        "",
        "```c",
        "HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, GPIO_PIN_RESET);",
        "```",
      ].join("\n"),
      division: "GENERAL",
      team: "GENERAL",
      authorId: admin.id,
    },
  });

  console.log("Seed complete");
  console.log(`Admin: admin / ${adminPassword}`);
  console.log(`Invite: ${inviteCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
