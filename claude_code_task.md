在 src/app/forum/[id]/page.tsx 的子回复渲染块（第328行附近，subReplies.map((sub, subIndex) => { 这里），加上软删除占位判断。目前主回复有 reply.isDeleted 判断（第208行），但子回复完全没有。
请在子回复的渲染里加上：如果 sub.isDeleted === true，只显示一个灰色斜体的 [该回复已删除] 占位（隐藏内容、作者、点赞、编辑删除等所有操作），否则正常渲染。样式和主回复的占位保持一致。
同时删掉之前调试用的 console.log（reply.id, reply.isDeleted 那行）。
改完跑 lint 和 build。