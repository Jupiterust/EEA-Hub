import Link from "next/link";
import { BookOpen, ClipboardCheck, MessageSquare, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";

const modules = [
  {
    title: "技术文档",
    desc: "以开发者文档站形式沉淀 STM32、GD32、FPGA、视觉与控制资料。",
    href: "/docs",
    icon: BookOpen,
  },
  {
    title: "作业流程",
    desc: "负责人发布作业，成员提交 zip/pdf/doc，系统保留历史并支持批改统计。",
    href: "/assignments",
    icon: ClipboardCheck,
  },
  {
    title: "技术论坛",
    desc: "实名或匿名提问、回复、举报与问题解决状态，兼顾讨论和秩序。",
    href: "/forum",
    icon: MessageSquare,
  },
  {
    title: "权限后台",
    desc: "邀请口令、账号审核、角色分配、举报处理和匿名追溯审计。",
    href: "/admin",
    icon: ShieldCheck,
  },
];

export default async function Home() {
  const session = await auth();

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
      <section className="flex flex-col justify-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
          Electrical & Electronic Association
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-text-primary sm:text-6xl">
          电气与电子信息协会内部协作平台
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-text-secondary">
          面向几十至上百名协会成员，统一管理技术资料、论坛交流、作业提交与批改。以低运维成本为前提，适配 Vercel、PostgreSQL、Prisma、Auth.js 和对象存储。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={session?.user ? "/dashboard" : "/login"} className="rounded-md bg-primary px-5 py-3 text-sm font-bold text-bg hover:bg-secondary">
            进入平台
          </Link>
          <Link href="/docs" className="rounded-md border border-border bg-surface px-5 py-3 text-sm font-bold text-text-primary hover:bg-elevated">
            浏览文档
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {modules.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-lg border border-border bg-surface p-5  transition hover:-translate-y-0.5 ">
            <item.icon className="size-8 text-primary" />
            <h2 className="mt-4 text-lg font-bold text-text-primary">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{item.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
