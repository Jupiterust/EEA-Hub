已确认的根因（用开发者工具实测得出，不要再怀疑别的原因）

在论坛帖子详情页 src/app/forum/[id]/page.tsx，帖子级的"编辑帖子"和"删除帖子"两个按钮尺寸不一致：


编辑帖子 是一个 <Link>（渲染为 <a>），实测尺寸 75.02 × 30
删除帖子 是 ConfirmDelete 组件内的 <button>，实测尺寸 91.28 × 38


两者用的 className 完全一样（都是 cn(editButtonClass / deleteButtonClass, "px-3 py-1.5 text-xs")），但因为浏览器对 <button> 和 <a> 元素施加了不同的原生默认样式（默认 font-size、box-sizing、padding、line-height 等），导致 <button> 比 <a> 大。

已经尝试过加 appearance-none 和 leading-none，无效，按钮依然不一致。所以需要用更强制的方式。

要求的解法：用固定高度 + box-border + 重置，强制两种元素渲染一致

请修改 src/components/ui.tsx 中的 editButtonClass 和 deleteButtonClass，做到无论元素是 <a> 还是 <button>，渲染出的盒子尺寸完全相同。具体措施（全部要做）：


固定高度：用 h-9（或合适的固定高度）替代 py-2 这种垂直 padding，配合 inline-flex items-center justify-center 让文字垂直居中。固定高度能消除 <button> 和 <a> 的高度差异。
box-border：加 box-border，确保 border 算进固定高度内，两种元素一致。
重置 button 原生样式：保留 appearance-none，并确保 <button> 的 font-size、line-height、font-family 都被显式设定（不要依赖继承），与 <a> 完全一致。可加 leading-none，并确保 text-sm（或实际使用的字号）被强制应用。
强制字号一致：实测两者字号渲染不同（button 字更大），这说明 <button> 的 font-size 没有正确继承。请确保 className 里的字号 class（如 text-sm/text-xs）对 <button> 实际生效——必要时在 ConfirmDelete 组件内部的 <button> 上也显式补充字号，或在全局 CSS 里对 button { font-size: inherit; font-family: inherit; line-height: inherit; } 做重置。
全局 button 重置（推荐，最彻底）：在全局样式文件（如 globals.css 或 Tailwind 的 base layer）中加入对 button 元素的重置，让 button 默认继承父级的 font 属性：


css   button {
     font-family: inherit;
     font-size: inherit;
     line-height: inherit;
   }

这是最根本的修复——很多 UI 库都这么做。这样所有 <button> 就不会再有"字比周围大"的问题，不只是这两个按钮。

验证标准

修改后，请确认：


论坛帖子详情页的"编辑帖子"和"删除帖子"两个按钮，高度、字号、padding 完全一致，只有颜色不同（编辑雾蓝 accent，删除红色 danger）
用浏览器开发者工具检查两个元素的 computed 尺寸应该完全相同（或仅因文字宽度不同而宽度略有差异，但高度和字号必须一致）
同样的修复要覆盖所有"编辑/删除"成对出现的地方：论坛帖子级按钮、文档详情页、个人主页等
论坛回复级的"编辑/删除"小链接（editLinkClass / deleteLinkClass）也要保证一致


收尾


跑 npm run lint 和 npm run build 确保通过
只改样式相关代码，不要动功能逻辑（编辑/删除的 server action、权限校验都不要改）


重点提示

根因是浏览器对 <button> 元素的原生样式。最干净的修法是在全局 CSS 里对 button 做 font 继承重置（第 5 点），这能一劳永逸解决所有 button 和 a/文字大小不一致的问题，而不是只在单个 class 上打补丁。请优先采用这个方案。