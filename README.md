# 电协 Hub

电气与电子信息协会内部管理平台，基于 Next.js App Router、TypeScript、Prisma、PostgreSQL、Auth.js、Tailwind CSS 和 Supabase Storage。

## 已实现范围

- 邀请口令注册、账号密码登录、待审核/激活/禁用状态。
- 普通成员、部门负责人、管理员三层角色权限。
- 技术文档：Markdown、部门/小组分类、目录路径、标题/正文搜索。
- 技术论坛：实名/匿名发帖与回复、标签、举报队列。
- 作业：发布、对象存储附件、成员多次提交、按时/迟交、批改反馈、统计。
- 个人主页：成员信息、提交记录、实名帖子、临近截止提醒。
- 管理后台：用户审核、角色调整、邀请口令、举报处理、匿名追溯审计日志。
- 部门展示页和全站搜索页。

## 环境变量

复制 `.env.example` 为 `.env`，至少配置：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
AUTH_SECRET="使用 openssl rand -base64 32 生成"
AUTH_URL="http://localhost:3000"

SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="Supabase service role key"
SUPABASE_STORAGE_BUCKET="eea-hub"
MAX_UPLOAD_BYTES="52428800"

SEED_ADMIN_PASSWORD="eea-admin-123456"
SEED_INVITE_CODE="EEA2026"
```

Vercel 部署时将 `AUTH_URL` 改为生产域名。Supabase Storage bucket 若不是 public，需要把 `uploadObject` 返回地址改为签名下载 URL。

## 本地开发

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

初始化账号默认为：

- 账号：`admin`
- 密码：`eea-admin-123456`
- 邀请口令：`SEED_INVITE_CODE`

## 部署到 Vercel

1. 创建 PostgreSQL 数据库，推荐 Supabase 或 Neon。
2. 创建 Supabase Storage bucket，例如 `eea-hub`。
3. 在 Vercel 项目中配置上方环境变量。
4. 构建命令保持 `npm run build`。
5. 首次上线后在本地或 CI 执行 `prisma migrate deploy`，再执行 seed 创建管理员。

生产数据库迁移建议使用：

```bash
npx prisma migrate deploy
npm run prisma:seed
```

## 匿名机制说明

匿名帖/匿名回复在普通页面只显示“匿名成员”。数据库保留 `authorId` 以便违规追溯，但用户可见界面和普通查询不展示真实身份。管理员在举报处理中触发追溯时会写入 `AuditLog`，用于换届和安全审计。
