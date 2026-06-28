# 电协 Hub —— 关注功能需求

## 背景

Next.js (App Router, TypeScript) + Prisma + PostgreSQL + Auth.js + Tailwind + Supabase 的电协内部网站（EEA_Hub），暗色主题，已上线。

通知系统已完整（Notification 表、NotificationType 枚举、createNotification 函数、NotificationBell 铃铛）。公开个人主页 /profile/[userId] 已实现。

本次：实现用户关注功能。

配色：主背景 #212733、卡片 #2A3140、主文字 #E8ECF1、主交互 #4FD1C5、次级 #6D96B4、成功 #6DAB70、边框 #3A4250。

---

## 一、数据库

新增 Follow 表：
```prisma
model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
  follower    User     @relation("Following", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("Followers", fields: [followingId], references: [id], onDelete: Cascade)
  @@id([followerId, followingId])
}
```

User 表加两个关系字段：
- `following Follow[] @relation("Following")` — 我关注的人
- `followers Follow[] @relation("Followers")` — 关注我的人

NotificationType 枚举加入 `FOLLOW`。

生成 migration + npx prisma generate。

---

## 二、Server Actions

### `toggleFollowAction(followingId)`
- 校验：不能关注自己（followerId === followingId → 报错）
- 已关注 → 取消关注（delete）
- 未关注 → 关注（create）+ 给被关注者发通知（type: FOLLOW，message: "XX 关注了你"，linkUrl: /profile/followerId）
- 服务端校验登录状态

### `createPostAction`（修改现有）
在发帖成功后，给所有关注该作者的用户发通知：
- **仅实名帖（isAnonymous: false）才触发**，匿名帖不触发（保护匿名性）
- 查出所有 followerId where followingId = post.authorId
- 给每个 follower 发通知：type REPLY（或新增 NEW_POST 类型，你判断），message: "XX 发布了新帖子《帖子标题》"，linkUrl: /forum/postId
- 自己不给自己发

### `createDocAction`（修改现有）
在发文档成功后，给所有关注该作者的用户发通知：
- **仅实名文档才触发**（文档本身没有匿名机制，所以正常触发）
- 查出所有关注者
- 给每个 follower 发通知：message: "XX 发布了新文档《文档标题》"，linkUrl: /docs/slug
- 自己不给自己发

---

## 三、公开个人主页 /profile/[userId]

### 关注/取消关注按钮
- 显示在资料卡片右上角（或姓名旁边）
- 已登录且不是本人 → 显示"关注"或"已关注"按钮
- 是本人 → 不显示关注按钮（显示 ⚙️ 齿轮设置按钮）
- 未登录 → 不显示关注按钮

### 关注数/粉丝数
- 资料卡片显示：X 关注 · X 粉丝
- 点击"关注"数 → 可以考虑跳转到关注列表（可选，不强制）

### 关注列表（可选，建议做）
- /profile/[userId]?tab=following → 显示该用户关注的人列表
- /profile/[userId]?tab=followers → 显示该用户的粉丝列表
- 每个用户显示头像、姓名、个性签名、关注/取消关注按钮

---

## 四、个人主页 /dashboard

- 显示自己的关注数和粉丝数
- 可选：加"我的关注"和"我的粉丝"快捷入口（点击跳转到 /profile/[userId]?tab=following）

---

## 五、通知铃铛

NotificationBell 加入 FOLLOW 类型图标（建议用 👥 或 ❤️）

---

## 六、匿名保护（关键）

- **匿名帖不触发关注通知**：createPostAction 里，isAnonymous=true 的帖子不给关注者发通知
- **关注列表不显示匿名内容**：/profile/[userId] 的帖子 Tab 已有 isAnonymous=false 过滤，保持不变
- 关注关系本身是公开的（谁关注谁可以看到），这不涉及匿名

---

## 七、技术要求

- Follow 表 + NotificationType.FOLLOW，生成 migration
- toggleFollowAction：不能关注自己，关注时通知被关注者
- createPostAction / createDocAction：关注者通知，匿名帖跳过
- 改完跑 npm run prisma:generate、lint、build，全部通过

## 八、验收要点

- /profile/[userId] 有关注/取消关注按钮，点击生效
- 关注数/粉丝数正确显示
- 不能关注自己（按钮不显示或禁用）
- A 关注 B → B 收到"A 关注了你"通知
- B 发实名帖 → A 收到通知；B 发匿名帖 → A 不收到通知 ⚠️
- B 发新文档 → A 收到通知
- 取消关注正常工作

## 九、本次不做

- 私信功能
- 关注推荐（"你可能认识的人"）
- 关注上限