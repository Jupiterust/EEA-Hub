# 电协 Hub —— 个人资料扩展 + 公开个人主页需求

## 背景

Next.js (App Router, TypeScript) + Prisma + PostgreSQL + Auth.js + Tailwind 的电协内部网站（EEA_Hub），暗色主题，已上线。

User 表现有字段：id、username、realName、email、passwordHash、role、division、team、status、avatarUrl。

本次两块：1）扩展个人资料字段；2）新建公开个人主页页面。

配色：主背景 #212733、卡片 #2A3140、主文字 #E8ECF1、主交互 #4FD1C5、次级 #6D96B4、暖金 #C4AC60、边框 #3A4250。

---

## 第一块：扩展个人资料字段

### 1. Schema 变更
User 表新增以下可选字段（全部 String?）：
- `qq` — QQ 号
- `bio` — 个性签名（短文本，建议限制 100 字以内）
- `major` — 专业
- `grade` — 年级（如"大二"、"2024级"等，自由文本）

生成 migration。

### 2. 编辑资料表单（dashboard 设置面板）
在现有"编辑资料" Tab 里，除了姓名和邮箱，加上这四个新字段：
- QQ 号（输入框，选填）
- 个性签名（textarea，选填，前端限制 100 字）
- 专业（输入框，选填）
- 年级（输入框，选填，placeholder 如"大二 / 2024级"）

升级 `updateProfileAction`：把这四个新字段也一起保存到数据库。

---

## 第二块：公开个人主页 /profile/[userId]

### 3. 新建页面 src/app/profile/[userId]/page.tsx

显示某个用户的公开资料，任何登录用户都可以查看。

**页面内容：**

顶部资料卡片：
- 头像（大尺寸，用现有 Avatar 组件）
- 真实姓名 + 用户名
- 个性签名（如果有）
- 专业 / 年级（如果有）
- QQ 号（如果有，显示"QQ: xxxxx"）
- 部门 / 小组 Badge
- 角色 Badge（MEMBER/LEADER/ADMIN）

下方内容列表（Tab 切换）：
- **"发布的文档"** Tab：该用户发布的所有文档（只显示已发布的），卡片样式参考 /docs 页面
- **"发布的帖子"** Tab：该用户发布的所有**实名**帖子（isAnonymous=false 的），卡片样式参考 /forum 页面

**匿名保护：**
- 匿名发的帖子**不出现**在公开主页（isAnonymous=false 才显示）
- 匿名发的文档评论不显示

**访问控制：**
- 需要登录才能查看（未登录跳转到登录页）
- 查看自己的 /profile/[userId] 正常显示（和别人看到的一样）

### 4. 作者名字变成可点击链接

在以下地方，把显示作者名字的地方改成 `<Link href="/profile/${authorId}">` 可点击链接，点击跳转到该用户的公开主页：
- 论坛帖子列表（/forum）：每个帖子卡片的作者名
- 论坛帖子详情页（/forum/[id]）：帖子作者名、每条回复的作者名
- 文档详情页（/docs/[slug]）：文档作者名
- 文档评论：每条评论的作者名

**匿名保护（重要）：**
- **匿名内容的作者名（"匿名楼主"、"匿名用户A"等）不能变成链接**，绝对不能通过点击匿名作者跳转到真实用户的主页（这会直接暴露匿名者身份）
- 只有实名显示的作者名才加链接

---

## 技术要求

- User 表加4个字段，生成 migration
- updateProfileAction 更新这4个字段
- /profile/[userId] 是新页面，需要登录
- 作者链接只加在实名内容上，匿名内容绝对不加链接
- 改完跑 npm run prisma:generate、lint、build，全部通过

## 验收要点

- 编辑资料能填写并保存 QQ、个性签名、专业、年级
- /profile/[userId] 显示用户资料 + 他的文档和实名帖子
- 论坛/文档的实名作者名可点击，跳转到对应主页
- **匿名内容的"匿名用户X"不是链接，点不了** ⚠️
- 未登录访问 /profile 跳转登录页

## 本次不做

- 关注功能（下一批）
- 私信功能
- 封禁用户的公开主页处理（暂时正常显示）