# 电协 Hub —— 通知删除 + 展开收合功能需求

## 背景

Next.js (App Router, TypeScript) + Prisma + PostgreSQL + Auth.js + Tailwind 的电协内部网站（EEA_Hub），暗色主题，已上线。

通知系统已实现：Notification 表（recipientId、type、message、linkUrl、relatedId、isRead、count、createdAt 等）、NotificationBell 组件（顶部铃铛+未读红点+下拉面板）、个人主页 NotificationsSection（通知列表卡片）、点击通知跳转并标记已读、"全部标记已读"按钮、markNotificationReadAction / markAllNotificationsReadAction。

本次两块：1）通知删除（单条删除 + 清空已读）；2）个人主页通知区展开/收合。

配色板：主背景 #212733、卡片 #2A3140、主文字 #E8ECF1、主交互 #4FD1C5、次级 #7CCACD/#6D96B4、成功 #6DAB70、暖金 #C4AC60、危险 danger、边框 #3A4250。

---

## 第一块：通知删除

### 1. 单条删除
- 每条通知（铃铛下拉面板 + 个人主页通知列表）增加一个删除按钮（小的 × 或垃圾桶图标，hover 时明显，放在每条右侧）
- 点击**物理删除**这条通知（真删，不留记录）
- 删除后列表即时更新（乐观更新：本地先移除，后台删除）
- 服务端校验：用户只能删自己的通知

### 2. 清空已读
- 通知区增加"清空已读"按钮（放在列表顶部，和"全部标记已读"并列或附近，样式克制）
- 点击**物理删除当前用户所有已读（isRead=true）的通知**，保留未读
- 删除后列表更新，只剩未读
- 服务端校验：只清空当前用户自己的已读通知
- 铃铛未读计数不受影响（删的是已读，未读数不变）

### Action
- `deleteNotificationAction(notificationId)` —— 物理删除单条，校验 recipientId == 当前用户
- `clearReadNotificationsAction()` —— 物理删除当前用户所有 isRead=true 的通知
- 用 prisma.notification.delete / deleteMany，无需 schema 变更

---

## 第二块：个人主页通知区展开/收合

个人主页的 NotificationsSection（通知列表）通知多了之后太长，占满屏幕。改成默认折叠：

- **默认只显示前 5 条**通知
- 如果通知超过 5 条，底部显示"展开全部（共 N 条）"按钮
- 点击"展开全部" → 显示所有通知，按钮变为"收起"
- 点"收起" → 回到只显示前 5 条
- 这是纯前端的展开/收合交互（用 React state 控制），数据可以一次性取来，只控制显示数量
- 折叠/展开状态切换流畅，符合暗色主题

注意：这个折叠只针对**个人主页的通知区**。铃铛下拉面板本来就有数量限制（最近20条），可以不动，或你判断是否也需要类似处理。

---

## 技术要求

- 删除 action 严格校验：用户只能删自己的通知（recipientId == session.user.id）
- 出错给中文提示或静默失败（参考现有 markNotificationReadAction），不要 500
- 展开/收合用 React state，不引入复杂依赖
- 复用现有 NotificationsSection / NotificationBell 的结构和交互模式
- 改完跑 npm run lint、npm run build，两项通过

## 验收要点

- 单条通知能删，删后即时消失
- "清空已读"删掉所有已读，保留未读；未读计数不变
- 用户只能删自己的通知
- 个人主页通知默认显示 5 条，超过时有"展开全部"，点击展开/收起正常
- 铃铛面板和个人主页两处删除都正常

## 本次不做

- 通知偏好设置、撤销删除