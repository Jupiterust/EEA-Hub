# 电协 Hub —— Markdown 实时预览 + 语法提示需求

## 背景

Next.js (App Router, TypeScript) + Prisma + Tailwind 的电协内部网站（EEA_Hub），暗色主题，已上线。

现有 MarkdownView 组件（已有代码高亮、prose-doc 样式）。以下页面有 Markdown 输入框但目前没有预览功能：论坛发帖（/forum/new）、论坛编辑帖子（/forum/[id]/edit）、文档新建（/docs/new）、文档编辑（/docs/[slug]/edit）。

本次：给这4个页面的 Markdown 正文输入框加上"编写/预览"Tab 切换 + Markdown 语法提示图标。

配色：主背景 #212733、卡片 #2A3140、主文字 #E8ECF1、主交互 #4FD1C5、次级 #6D96B4、边框 #3A4250。

---

## 功能

### 1. 编写/预览 Tab 切换

在 Markdown 正文输入框上方加两个 Tab："编写" 和 "预览"：

- **编写 Tab**（默认）：显示现有的 textarea 输入框，用户正常写内容
- **预览 Tab**：隐藏 textarea，显示当前输入内容的 Markdown 渲染结果（复用现有 MarkdownView 组件）
- 切换 Tab 时内容不丢失
- Tab 样式符合暗色主题，当前激活的 Tab 用主交互色 `#4FD1C5` 高亮
- 如果内容为空时点预览，显示一个灰色的"暂无内容"占位提示

### 2. Markdown 语法提示（ⓘ 图标）

在"编写/预览"Tab 旁边（或正文标签旁边）加一个 ⓘ 信息图标：
- 鼠标悬停或点击弹出 tooltip 说明
- 提示文案：「支持 Markdown 语法，例如：**粗体**、# 标题、\`代码\`、\`\`\`代码块\`\`\`。切换到"预览"查看渲染效果。」
- tooltip 样式符合暗色主题（深色背景、浅色文字、圆角），复用项目现有的 tooltip/信息提示组件（如果有）

### 3. 范围

以下4个页面的 Markdown 正文输入框都要加：
- `/forum/new`（论坛发帖）
- `/forum/[id]/edit`（论坛编辑帖子）
- `/docs/new`（文档新建）
- `/docs/[slug]/edit`（文档编辑）

**不加的地方**：回复框、评论框（这些通常是短文本，加预览反而复杂）

---

## 技术要求

- Tab 切换是纯前端交互（React state），不涉及后端
- 预览直接复用现有 MarkdownView 组件，保持渲染样式一致
- 建议封装成一个 MarkdownEditor 客户端组件（含 Tab + textarea + 预览 + ⓘ 提示），在4个页面复用，避免重复代码
- 切换预览时 textarea 的 value 要保持同步（受控组件）
- 手机端 Tab 也能正常使用，不挤压
- 改完跑 npm run lint、npm run build，两项通过

## 验收要点

- 4个页面的正文输入框上方都有"编写 | 预览"Tab
- 编写 Tab：正常输入
- 预览 Tab：显示 Markdown 渲染效果，样式和文档阅读页一致（有代码高亮、标题层级等）
- 切换 Tab 内容不丢失
- 内容为空时预览有占位提示
- ⓘ 图标悬停弹出 Markdown 语法说明
- 手机端正常

## 本次不做

- 左右分栏实时预览（只做 Tab 切换）
- 回复/评论框的预览
- Markdown 工具栏（加粗/斜体快捷按钮）