# 电协 Hub —— 作业截止临期提醒需求

## 背景

Next.js (App Router, TypeScript) + Prisma + PostgreSQL + Auth.js + Tailwind 的电协内部网站（EEA_Hub），暗色主题，已上线。

通知系统已完整：Notification 表（recipientId、type、message、linkUrl、relatedId、isRead、count、createdAt 等）、NotificationBell 铃铛、个人主页通知区、单条删除/清空已读。

作业系统已有：Assignment（作业，含 dueAt 截止时间、所属部门/小组等）、Submission（提交记录，含 studentId、assignmentId）。

本次：作业截止临期时，给还没提交的成员发送站内通知提醒。

---

## 功能逻辑

### 触发方式：用户进入页面时检查（不用定时任务）

当用户进入 **dashboard（个人主页）** 时（或作业列表页，由你判断更合适的位置，建议 dashboard），执行一次"临期作业检查"：

1. 查出当前用户**应该提交、但还没提交、且距截止时间 < 24 小时（且还没过期）**的作业
   - "应该提交"：根据作业的部门/小组范围和用户所属，沿用现有"用户能看到/需要提交哪些作业"的逻辑
   - "还没提交"：该用户对该作业没有 Submission 记录
   - "距截止 < 24h"：dueAt 在 now 和 now+24h 之间
2. 对每个符合条件的作业，生成一条临期提醒通知（如果还没生成过——见下方去重）

### 去重：同一作业只提醒一次

- **同一作业对同一用户，只生成一次临期提醒**，避免每次进 dashboard 都重复生成、刷屏
- 实现：生成前先查 Notification 表，是否已存在"该用户 + 该作业 + 类型为截止提醒"的记录；已存在则跳过
- 可以用 relatedId 存作业 id，type 用一个专门的值（如复用现有 NotificationType，或加一个 DEADLINE 类型）来标识临期提醒，便于去重查询

### 通知内容

- 文案如："作业《作业标题》将在 24 小时内截止，请尽快提交"
- linkUrl 指向该作业页面（点击跳转去提交）
- 正常进入未读/已读、可点击跳转、可删除（复用现有通知机制）

---

## 设计要点

- 距截止 < 24 小时开始提醒
- 同一作业只提醒一次（去重）
- 不用 Vercel Cron 等定时任务，用户进 dashboard 时触发检查即可
- 检查逻辑要高效（避免每次进 dashboard 都大量查询导致变慢）：只查临期未交的作业，数量通常很少
- 如果作业已提交、或已过期、或距截止还很远，不提醒

## 技术要求

- 临期检查可以放在 dashboard 的服务端数据加载里，或单独的 server action / 函数
- 如需新增 NotificationType（如 DEADLINE）则改 schema + migration；如复用现有类型则不用
- 生成通知复用现有的 createNotification 逻辑
- 出错不要影响 dashboard 正常加载（检查失败就跳过，不要让 dashboard 500）
- 改完跑 npm run prisma:generate（如有 schema 变更）、npm run lint、npm run build，通过

## 验收要点（自测）

- 有一个距截止 <24h 且未提交的作业 → 进 dashboard 后收到一条临期提醒通知
- 再次进 dashboard → 不重复生成第二条（去重生效）
- 该作业已提交 / 已过期 / 距截止还很远 → 不提醒
- 提醒通知能点击跳转到作业页、能标记已读、能删除
- dashboard 加载不受影响（检查不拖慢、不报错）

## 本次不做

- 邮件提醒
- 定时任务（Cron）
- 多次梯度提醒（如48h一次、24h一次、1h一次）——本次只在<24h提醒一次