# 电协 Hub (EEA-Hub)

> 湖北理工学院电气与电子信息协会内部管理平台

---

## 项目简介

电协 Hub 是为电协（电气与电子信息协会）量身定制的内部网站，提供技术文档、技术论坛、作业管理三大核心功能，支持实名/匿名发帖、楼中楼回复、站内通知、关注系统等完整的社区功能。

**线上地址：** https://eea-hub.vercel.app

---

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 样式 | Tailwind CSS v4 |
| 数据库 ORM | Prisma 6 + PostgreSQL (Neon) |
| 认证 | Auth.js v5 (JWT Session) |
| 文件存储 | Supabase Storage |
| 部署 | Vercel |
| PWA | next-pwa (支持添加到手机桌面) |

---

## 功能清单

### 核心功能
- **技术文档**：GitBook 风格三栏布局（左侧目录树 + 中间正文 + 右侧 TOC）、Markdown 渲染、代码高亮、版本历史、置顶
- **技术论坛**：实名/匿名发帖、楼中楼嵌套回复、点赞、采纳最佳答案、排序、搜索、置顶
- **作业管理**：发布作业、提交文件、批改评分、截止提醒通知

### 用户系统
- 邀请码注册、JWT 登录、三层权限（MEMBER / LEADER / ADMIN）
- 用户头像（上传 + 裁剪）、个人资料（QQ/签名/专业/年级）
- 公开个人主页、关注系统、草稿自动保存

### 互动系统
- 点赞（帖子/回复/文档/评论）
- @mention（自动补全 + 通知）
- 站内通知（铃铛 + 聚合 + 删除 + 折叠）
- 文档/论坛评论楼中楼

### 管理功能
- 管理后台：审核成员、封禁、邀请码管理、举报处理（含删除内容）、管理日志

---

## 本地开发

### 前置要求

- Node.js 18+
- npm
- 梯子（本地连接 Neon 数据库和 Supabase 需要）

### 1. 克隆项目

```bash
git clone https://github.com/Jupiterust/EEA-Hub.git
cd EEA-Hub
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`（或直接创建 `.env`）：

```bash
# 数据库 (Neon PostgreSQL)
DATABASE_URL="postgresql://..."

# Auth.js
AUTH_SECRET="随机字符串，用 openssl rand -base64 32 生成"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"

# Supabase Storage
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
SUPABASE_STORAGE_BUCKET="eea-hub"

# 初始化种子数据（首次运行用）
SEED_ADMIN_PASSWORD="你的管理员密码"
SEED_INVITE_CODE="你的邀请码"
```

### 3. 初始化数据库

```bash
# 应用所有 migration
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate

# 初始化种子数据（创建管理员账号和邀请码）
npm run prisma:seed
```

### 4. 启动开发服务器

```bash
# 国内需要开梯子，让 Node.js 走代理连接 Neon 和 Supabase
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897

# 启动（MallocStackLogging=0 避免 macOS 内存日志问题）
MallocStackLogging=0 npm run dev
```

访问 http://localhost:3000

---

## 数据库管理

**数据库位置：** Neon PostgreSQL（新加坡节点）
- 登录 https://console.neon.tech 查看
- 账号信息由上一届负责人交接

**常用命令：**

```bash
# 查看数据库内容（网页端）
npx prisma studio

# 创建新的 migration（修改 schema 后）
npx prisma migrate dev --name 描述

# 部署 migration 到生产环境
npx prisma migrate deploy

# 重新生成 Prisma Client（修改 schema 后必须）
npx prisma generate
```

---

## 文件存储

**存储位置：** Supabase Storage
- 登录 https://supabase.com 查看
- Bucket 名称：`eea-hub`（Public）
- 存储内容：用户头像、帖子配图、作业附件

**注意：** service_role key 是敏感信息，只存在于：
- 本地 `.env` 文件（不提交到 Git）
- Vercel 环境变量

---

## 部署

项目部署在 **Vercel**，连接 GitHub 仓库 `Jupiterust/EEA-Hub`，main 分支自动部署。

### 更新网站
```bash
git add .
git commit -m "描述改动"
git push
# Vercel 自动检测到 push，1-2 分钟后自动部署
```

### Vercel 环境变量
登录 https://vercel.com → eea-hub 项目 → Settings → Environment Variables

需要配置的变量：
- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`（填线上域名）
- `AUTH_TRUST_HOST`（填 true）
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SEED_ADMIN_PASSWORD`
- `SEED_INVITE_CODE`

---

## 权限说明

| 角色 | 说明 | 能做什么 |
|------|------|----------|
| MEMBER | 普通成员 | 发帖、发文档、回复、提交作业 |
| LEADER | 部门负责人 | MEMBER 的所有权限 + 发布作业、置顶帖子/文档 |
| ADMIN | 管理员 | 所有权限 + 管理后台、封禁用户、处理举报 |

**初始管理员账号：** 用 `SEED_ADMIN_PASSWORD` 环境变量设置的密码，用户名为 `admin`

**邀请码：** 用 `SEED_INVITE_CODE` 环境变量设置，成员注册时需要填写

---

## 项目结构

```
EEA-Hub/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   ├── migrations/            # 数据库迁移记录
│   └── seed.ts                # 初始化数据
├── src/
│   ├── app/                   # Next.js App Router 页面
│   │   ├── admin/             # 管理后台
│   │   ├── assignments/       # 作业
│   │   ├── docs/              # 技术文档
│   │   ├── forum/             # 技术论坛
│   │   ├── dashboard/         # 个人主页
│   │   ├── profile/           # 公开个人主页
│   │   └── search/            # 全站搜索
│   ├── components/            # 可复用组件
│   ├── lib/
│   │   ├── actions.ts         # 所有 Server Actions（业务逻辑）
│   │   ├── authz.ts           # 权限校验函数
│   │   ├── prisma.ts          # Prisma Client 实例
│   │   └── storage.ts         # Supabase Storage 上传函数
│   └── auth.ts                # Auth.js 配置
├── public/                    # 静态资源（图标、默认头像等）
└── .env                       # 环境变量（不提交 Git）
```

---

## 维护注意事项

### 安全
- **绝对不要**把 `.env` 文件提交到 Git
- Supabase service_role key 和 Neon 数据库密码是敏感信息，定期轮换
- 如果密钥泄露，立刻在对应平台重新生成

### 数据库
- 每次修改 `schema.prisma` 后：
  1. 本地跑 `npx prisma migrate dev`
  2. 提交 migration 文件
  3. 生产环境会在部署时自动跑 `prisma migrate deploy`（需要在 Vercel 构建命令里配置）
- 不要用 `prisma db push` 做正式变更（会导致 migration 历史漂移）

### 常见问题
- **本地连不上数据库**：检查梯子是否开启，Node.js 需要走代理才能连 Neon
- **图片上传失败**：检查 Supabase key 是否有效，国内需要梯子
- **部署后功能异常**：检查 Vercel 环境变量是否都配置了

---

## 交接清单

接手时需要从上一届获取：
- [ ] Neon 数据库账号/密码（或 DATABASE_URL）
- [ ] Supabase 账号访问权限（或新建 project 迁移数据）
- [ ] Vercel 项目访问权限（或 transfer ownership）
- [ ] GitHub 仓库写权限
- [ ] 当前的邀请码和管理员密码

---

## 开发历史

项目由 **2024 级电协软件部** 从零开发，使用 AI 辅助编码（Claude Code + Codex）完成。

技术选型原则：快速迭代、易于维护、成本低（Neon/Supabase/Vercel 免费套餐）。

---

*最后更新：2026年6月*
