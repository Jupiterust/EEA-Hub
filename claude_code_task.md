# 电协 Hub —— 文档浏览优化需求（GitBook 风格）

## 背景

Next.js (App Router, TypeScript) + Prisma + PostgreSQL + Auth.js + Tailwind + Supabase 的电协内部网站（EEA_Hub），暗色主题，已上线。技术文档（TechDoc）已有功能：Markdown 存储、按部门(division)/小组(team)分类、目录路径(path)字段、slug、标题/正文搜索、新建/编辑/删除。

当前文档的阅读体验比较朴素。本次目标：把文档区改造成 **GitBook / VitePress 风格的技术文档站**，提升浏览和阅读体验。

数据模型参考：文档有 division（GENERAL/SOFTWARE/ANALOG）、team（GENERAL/CONTROL/VISION/FPGA/HARDWARE）、path（如"新人学习路径 > STM32入门 > GPIO配置"）、title、slug、content(Markdown)、excerpt 等字段。

---

## 一、Markdown 正文美化

文档详情页（/docs/[slug]）的 Markdown 渲染要专业、好看，适配技术文档场景：

- 标题层级（h1-h4）清晰，有视觉层次和合理间距
- 段落、列表（有序/无序）、引用块(blockquote)、表格、分割线等都要有良好的排版样式
- 行内代码 `code` 有背景色块区分
- 链接、加粗、斜体等样式清晰
- 整体阅读舒适：合理的行高、字号、正文最大宽度（避免一行太长）、段落间距
- 全部符合暗色主题配色（背景深色、文字浅色、强调色用项目调色板）

建议用成熟的 Markdown 渲染方案（如 react-markdown + remark/rehype 插件，或项目已有的方案），不要手写解析。

---

## 二、代码块语法高亮

文档里的代码块要有语法高亮，重点适配嵌入式/协会常用语言：

- 支持 C、C++、Python、JavaScript/TypeScript、Verilog、Bash、JSON 等（STM32/GD32 用 C，视觉用 Python，FPGA 用 Verilog）
- 代码块有合适的暗色主题配色方案（如 highlight.js / Shiki / prism 的暗色主题）
- 代码块建议显示语言标签，并可选支持"复制代码"按钮
- 代码块字体用等宽字体，排版清晰

---

## 三、左侧目录树导航（GitBook 风格）—— 组织方式：部门分类 + 路径成树

在文档区（/docs 及文档详情页）增加**左侧目录树导航**，组织方式如下（两者结合）：

1. **第一层：按部门/小组分大类**
   - 顶层按 division 分组：通用/新人指南、软件部、模电部
   - division 下按 team 细分：软件部 > 控制组/视觉组，模电部 > FPGA组/硬件组，通用归到"通用"
2. **第二层及以下：组内按"目录路径"(path)拼成多级树**
   - 同一个部门/小组下的文档，解析它们的 path 字段（如"新人学习路径 > STM32入门 > GPIO配置"，用 > 或 / 分隔），自动拼成多级折叠树
   - 例如软件部-控制组下：
     ```
     软件部
       控制组
         新人学习路径
           STM32入门
             GPIO配置  ← 点击进入该文档
             定时器     ← 另一篇文档
     ```
3. **交互**：
   - 树节点可展开/折叠
   - 点击叶子节点（文档）跳转到该文档
   - 当前正在阅读的文档在树中高亮
   - 树在文档列表页和文档详情页都显示（作为持久的左侧导航栏）

实现提示：path 字段可能为空或格式不统一，需要容错处理（path 为空的文档可直接挂在其 team 下）。

---

## 四、右侧 TOC（文档内目录）

文档详情页右侧显示**当前文档的内部目录**：

- 自动提取当前文档 Markdown 中的标题（h2/h3 等），生成右侧 TOC 列表
- 点击 TOC 项跳转到正文对应标题位置（锚点跳转）
- 滚动正文时，TOC 中当前所在章节高亮（scroll spy，可选但推荐）
- 长文档没有标题时，TOC 可为空或隐藏

---

## 五、三栏布局

文档详情页采用**三栏布局**（桌面端）：

```
[ 左侧：目录树导航 ] [ 中间：文档正文 ] [ 右侧：本文 TOC ]
```

- 左栏：第三节的目录树
- 中栏：第一、二节的美化正文 + 代码高亮
- 右栏：第四节的 TOC
- **响应式**：窄屏/手机上，左侧目录树和右侧 TOC 应折叠为可展开的抽屉/按钮，不能挤压正文导致没法读。移动端优先保证正文可读。

文档列表页（/docs）可保留或调整为带左侧目录树的形式，由你判断更合理的布局。

---

## 六、技术要求

- 优先使用成熟库（react-markdown、rehype-highlight 或 shiki、rehype-slug、rehype-autolink-headings 等），不要手写 Markdown 解析或高亮
- 全部符合暗色主题配色（项目调色板：主背景 #212733、卡片 #2A3140、主文字 #E8ECF1、主交互 #4FD1C5、次级 #7CCACD/#6D96B4、成功 #6DAB70、点缀 #C4AC60）
- 如需新增依赖，正常安装
- 如涉及 schema 变更（一般本次不需要，path/content 字段已存在）则生成 migration
- 改完跑 npm run prisma:generate、npm run lint、npm run build，三项全部通过

## 七、验收要点（自测）

- 文档正文 Markdown 渲染美观，标题/列表/引用/表格/行内代码都正常
- 代码块有语法高亮（试 C/Python/Verilog），暗色配色舒适
- 左侧目录树：按部门/小组分类，组内按 path 成树，可展开折叠，点击跳转，当前文档高亮
- 右侧 TOC：能提取当前文档标题，点击跳转到对应章节
- 三栏布局在桌面端正常；手机端目录树/TOC 折叠不挤压正文
- path 为空或格式异常的文档不会导致目录树崩溃


上次执行"文档浏览优化"(claude_code_task.md)时网络中断了。你已经创建了 copy-code-wrapper、table-of-contents、doc-tree、markdown-view、docs/layout 等组件,但没做完,也没跑验证。请检查当前进度,继续完成剩余部分(三栏布局整合、目录树和 TOC 接入文档页面、响应式适配),最后跑 npm run lint 和 npm run build 确保通过。

## 八、本次不做

- 文档版本历史
- 论坛相关（已在上一批完成）