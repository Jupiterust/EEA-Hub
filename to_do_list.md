# EEA-Hub 待办事项

> 基于代码审查生成，2026-06-27

---

## 🔴 Bug / 安全隐患（优先修复）

### 1. `unacceptReplyAction` 不清除 `isSolved` 字段
- **位置：** `src/lib/actions.ts` — `unacceptReplyAction`
- **问题：** 取消采纳时把 `solutionReplyId` 设为 null，但没有同时把 `ForumPost.isSolved` 改回 `false`，导致帖子在论坛列表里永远显示"已解决"绿色徽章。
- **修复：** 在 `$transaction` 里加 `isSolved: false`。改动量：1 行。

### 2. 已关闭作业仍可提交
- **位置：** `src/lib/actions.ts` — `submitAssignmentAction`
- **问题：** 只检查迟交时间，没有检查 `assignment.status === "CLOSED"`，Leader 关闭作业后成员仍可上传。
- **修复：** 拿到 assignment 后加 `if (assignment.status === "CLOSED") throw new Error("作业已关闭")`。改动量：3 行。

### 3. 被封禁用户在 JWT 过期前仍可正常使用网站
- **位置：** `src/auth.ts`
- **问题：** `authorize()` 只在登录时检查 `user.status !== "ACTIVE"`，之后全靠 JWT。Admin 封禁某人后，对方 JWT 未过期（默认 30 天）期间照常发帖、提交作业。
- **修复：** 在 `jwt` callback 里定期（或每次）从 DB 重新查 status，若不为 ACTIVE 则清除 token。改动量：中等。

### ~~4. 生产环境遗留 `console.log` 暴露用户信息~~ ✅ 已修复
- **位置：** `src/app/dashboard/page.tsx`
- ~~`console.log("临期检查:", user.id, user.division, user.team, ...)` 输出用户敏感信息。~~
- 已删除。

### 5. 举报永远无法标记为"已处理"
- **位置：** `src/app/admin/page.tsx`、`src/lib/actions.ts`
- **问题：** Admin 举报队列只能查看，没有"标记已解决/驳回"操作，`Report.status` 永远是 `OPEN`，举报只增不减。
- **修复：** 新增 `resolveReportAction` / `dismissReportAction`，Admin 页面加按钮。改动量：中等。

### 6. 作业批改后学生不收到通知
- **位置：** `src/lib/actions.ts` — `reviewSubmissionAction`
- **问题：** Leader 批改完提交（通过/不通过/加反馈）后，学生没有任何通知，其他操作（回复、点赞）都有通知，批改通知明显缺失。
- **修复：** 在 `reviewSubmissionAction` 末尾加 `createNotification(...)` 通知对应学生。改动量：小。

---

## 🟡 现有功能改善

### 7. `DocVersion` 模型存在但从未写入
- **位置：** `prisma/schema.prisma:141`、`src/lib/actions.ts` — `updateDocAction`
- **问题：** Schema 里有完整的 `DocVersion` 模型，但 `updateDocAction` 更新文档时从不创建版本快照，版本历史功能框架已搭好，只差执行。
- **改动量：** 小。`updateDocAction` 里加 `prisma.docVersion.create`，加版本历史页面。

### 8. 论坛 / 文档 / Admin 用户列表无分页
- **位置：** `src/app/forum/page.tsx`（无 take）、`src/app/assignments/page.tsx`（无 take）、`src/app/admin/page.tsx`（`take: 80` 硬截）
- **问题：** 内容多时全量加载，随数据增长变慢，Admin 页超过 80 名用户就看不全。
- **改动量：** 中等。URL 参数 `?page=N`，查询加 `skip/take`，页面底加翻页按钮。

### 9. 没有密码修改功能
- **位置：** `src/app/dashboard/page.tsx`
- **问题：** 用户注册后无法修改密码，也没有忘记密码入口。Admin 目前也无法替用户重置密码。
- **改动量：** 中等。Dashboard 加"修改密码"表单 + server action，Admin 页加"重置密码"入口。

### 10. 作业列表无搜索 / 状态筛选
- **位置：** `src/app/assignments/page.tsx`
- **问题：** 作业数量多时找不到特定作业，没有关键词搜索，没有按 OPEN/CLOSED 筛选。
- **改动量：** 小。加搜索框和状态 select，URL 参数传递，Prisma where 加条件。

### 11. 截止日期通知依赖用户主动访问 Dashboard
- **位置：** `src/app/dashboard/page.tsx:26`
- **问题：** 24 小时截止预警写在页面渲染里，不常开网站的成员收不到提醒。
- **改动量：** 中等。改为 `/api/cron/deadline-check` API Route + Vercel Cron，每小时自动运行。

### 12. 全站搜索不包含作业
- **位置：** `src/app/search/page.tsx`
- **问题：** 只搜索文档和论坛，作业无法被搜到。
- **改动量：** 小。`Promise.all` 里加 `prisma.assignment.findMany`，结果加"作业"类型 badge。

### 13. 角色 / 部门变更后需重新登录才生效
- **位置：** `src/auth.ts`（同第 3 条）
- **问题：** Admin 把某人从 MEMBER 升为 LEADER 后，对方需退出再登录才能发文档，体验差。
- **改动量：** 同第 3 条，JWT refresh 机制一并解决。

---

## 🟢 可以添加的新功能

### 14. 个人资料编辑（真实姓名、邮箱）
- **问题：** 注册后只能改头像，姓名写错或邮箱变更只能联系管理员手动改。
- **改动量：** 小。Dashboard 加"编辑资料"表单 + server action。

### 15. 文档点赞数在列表可见
- **问题：** `DocLike` 已有，但列表和搜索结果不显示点赞数，无法判断文档质量。
- **改动量：** 极小。docs/page.tsx 查询加 `_count: { select: { docLikes: true } }`，卡片上显示数字。

### 16. 邮件通知（截止日期、被回复、批改结果）
- **问题：** 站内通知已有，但不常看网站的成员收不到消息。
- **改动量：** 中等。引入 Resend / Supabase 邮件，在 `createNotification` 里按用户设置可选发邮件。
