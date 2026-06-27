# 电协 Hub —— 草稿自动保存需求（localStorage）

## 背景

Next.js (App Router, TypeScript) + Tailwind 的电协内部网站（EEA_Hub），暗色主题，已上线。

目前 /forum/new（发新帖）和 /docs/new（新建文档）的表单，如果用户写到一半意外关闭 tab 或刷新，内容全部丢失。本次用 localStorage 在浏览器本地自动保存草稿，防止内容丢失。

---

## 范围

只给以下两个"新建"页面加草稿：
- `/forum/new` — 论坛发新帖（保存：标题、正文、标签）
- `/docs/new` — 新建技术文档（保存：标题、目录路径、摘要、正文）

**不加的页面**：编辑页（/forum/[id]/edit、/docs/[slug]/edit）——编辑的内容已在数据库，不怕丢。

---

## 功能逻辑

### 1. 自动保存

- 用户在表单里输入时，**每隔 2 秒**（或 onChange 时节流）将表单内容保存到 localStorage
- localStorage key 建议：`draft_forum_new`、`draft_doc_new`（固定 key，每个页面一个）
- 保存的内容是 JSON 格式，包含各字段值和保存时间戳

### 2. 自动恢复

- 用户进入 /forum/new 或 /docs/new 时，检查 localStorage 是否有对应草稿
- 如果有草稿，**自动填入表单**，并在表单顶部显示一个提示横幅：
  - 文案：「已恢复上次草稿（保存于 XX:XX）」
  - 旁边有「清除草稿」按钮，点击清空 localStorage 草稿并重置表单
- 如果没有草稿，正常显示空表单

### 3. 发布成功后清除草稿

- 帖子/文档**成功发布后**，自动清除对应的 localStorage 草稿
- 避免下次进来又恢复已发布的内容

### 4. 清除草稿按钮

- 恢复提示横幅上有「清除草稿」按钮
- 点击后：清空 localStorage 草稿 + 重置表单为空 + 隐藏提示横幅

---

## 实现要点

- 纯前端逻辑，不涉及后端/数据库，不需要用户登录状态（localStorage 是浏览器本地的）
- 表单需要改成**受控组件**（React state 控制各字段值），才能监听变化并保存到 localStorage
- 注意：/forum/new 和 /docs/new 目前如果是服务端组件，需要把表单部分提取成客户端组件（"use client"）来实现 localStorage 操作
- 自动保存用节流（throttle）或 useEffect + debounce，避免每次按键都写 localStorage
- 已有 MarkdownEditor 组件（刚加的，有 Tab 切换），草稿保存要包含正文内容，和 MarkdownEditor 配合好（正文用受控 value 传入）
- 发布成功的判断：可以在 server action 成功后的回调/redirect 前清除，或者在页面检测到 ?success= 参数时清除草稿

## 交互细节

- 提示横幅样式：暗色主题，用次级颜色（如 #6D96B4 雾蓝）或成功绿，不要太抢眼
- 「清除草稿」按钮：小按钮，用 danger 色或灰色，点击有确认（或直接清除，因为用户主动点的）
- 自动保存不需要显示"已保存"提示（静默保存，不打扰用户）
- 草稿恢复提示只在有草稿时显示，没草稿时完全不显示任何东西

## 技术要求

- 纯前端，不改 server action、不改数据库
- 和现有的 MarkdownEditor、Field、inputClass 等组件配合
- 改完跑 npm run lint、npm run build，两项通过

## 验收要点

- /forum/new：写标题/正文/标签，关掉 tab，重新进来，内容恢复，有提示横幅
- /docs/new：写标题/路径/摘要/正文，关掉，重新进来，内容恢复
- 点「清除草稿」→ 表单清空、提示消失、localStorage 草稿删除
- 成功发布后，再进 /forum/new 或 /docs/new，表单是空的（草稿已清除）
- 没有草稿时，进入页面表单正常为空，无任何提示

## 本次不做

- 编辑页草稿（内容已在数据库，不需要）
- 云端草稿同步（只做本地 localStorage）
- 多设备草稿同步