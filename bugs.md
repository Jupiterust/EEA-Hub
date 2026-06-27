Here is the complete prioritized fix list:

---

## EEA_Hub 代码审查报告

---

## 🔴 高优先级

### H-1 缺少 `middleware.ts` — 路由保护无服务端网关

**问题：** 所有路由保护依赖各页面组件内部手动调用 `requireUser()`。若某页面漏写，服务端将完整渲染整个页面后再跳转，性能损耗高且存在安全盲点。

**修复：** 新建 `src/middleware.ts`，在 Edge 层拦截未登录请求：

```ts
// src/middleware.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const publicPaths = ["/login", "/register", "/api/auth"];
  if (publicPaths.some((p) => pathname.startsWith(p))) return;
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
```

---

### H-2 `/forum`、`/search`、`/departments` 未做身份验证，内部数据公开可读

**问题：** 这三个页面完全没有 `requireUser()` 调用，任何未登录访客只需直接访问 URL 即可浏览论坛内容、全站搜索结果及组织架构图。

| 文件                           | 行号 | 现状             |
| ------------------------------ | ---- | ---------------- |
| `src/app/forum/page.tsx`       | 1–15 | 无任何 auth 检查 |
| `src/app/search/page.tsx`      | 1–10 | 无任何 auth 检查 |
| `src/app/departments/page.tsx` | 1–10 | 无任何 auth 检查 |

**修复（以 `forum/page.tsx` 为例，其余相同）：**

```ts
// src/app/forum/page.tsx — 在数据查询前第一行加入
import { requireUser } from "@/lib/authz";

export default async function ForumPage(...) {
  await requireUser();   // ← 新增
  // ... 其余代码不变
}
```

> 若 H-1 的 `middleware.ts` 已添加，这里的 `requireUser()` 变为防御性二次校验，但仍建议保留（深度防御原则）。

---

### H-3 `docs/page.tsx` 调用 `auth()` 但未重定向未登录用户

**文件：** `src/app/docs/page.tsx:16`

**问题：** 当前代码只用 session 来决定是否显示"新建文档"按钮，未登录访客可以看到完整文档列表。

```ts
// 当前 (第 16 行)
const session = await auth();
// 缺少重定向
```

**修复：**

```ts
// 将 auth() 替换为 requireUser()
import { requireUser } from "@/lib/authz";

const user = await requireUser();  // 未登录自动 redirect("/login")
// 删除原 session 变量，用 user.role 替换 session?.user.role
```

---

## 🟡 中优先级

### M-1 `admin/page.tsx` 查询返回 `passwordHash`

**文件：** `src/app/admin/page.tsx:19`

**问题：** `prisma.user.findMany({ take: 80 })` 不加 `select`，返回的每个用户对象都包含 `passwordHash`，该字段随 React Server Component props 序列化到页面 HTML 中。

```ts
// 当前 (第 19 行)
prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
```

**修复：**

```ts
prisma.user.findMany({
  orderBy: { createdAt: "desc" },
  take: 80,
  select: {
    id: true, username: true, realName: true, email: true,
    role: true, status: true, division: true, team: true,
    bannedReason: true, avatarUrl: true, createdAt: true,
    approvedAt: true, approvedById: true,
    inviteCode: { select: { label: true } },
  },
}),
```

---

### M-2 根布局每次请求都执行通知查询

**文件：** `src/app/layout.tsx:41–47`

**问题：** 每个页面（包括静态资源路由）都会在根 layout 执行一次 `prisma.notification.findMany()`，每次页面切换都增加一次 DB 查询。

**修复方案：** 将通知数据的获取移到 `dashboard/page.tsx` 和 `NotificationBell` 内部（通过 Server Component 组合或 Route Handler 按需拉取），根 layout 改为仅检查登录状态：

```tsx
// src/app/layout.tsx — 移除 prisma import 和 notification query
// 将 NotificationBell 改为自包含，内部自行 fetch 通知
// 或者：保持现状但加 unstable_cache 缓存 5 秒
import { unstable_cache } from "next/cache";

const getNotifications = unstable_cache(
  async (userId: string) =>
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: [{ isRead: "asc" }, { updatedAt: "desc" }],
      take: 20,
    }),
  ["notifications"],
  { revalidate: 5 }
);
```

---

### M-3 邀请码明文出现在 URL 中

**文件：** `src/lib/actions.ts:188`

**问题：**

```ts
redirect(`/admin?invite=${encodeURIComponent(rawCode)}`);
```

邀请码以明文写入浏览器地址栏，会保存在浏览器历史记录和服务器访问日志中。

**修复：** 使用 session flash 或将邀请码存入数据库后仅展示 ID，避免在 URL 中传递敏感值。最简单的修复：

```ts
// 在 redirectWithSuccess 的 message 里传码，显示在页面的成功 banner 中
// success banner 只显示当次请求，不落入 URL history
redirectWithSuccess("/admin", `邀请口令已创建：${rawCode}`);
```

> 这样邀请码出现在 `?success=` 参数里，但仅由用户自己的 tab 可见，且会随下次导航消失。若需更高安全等级，可将码写入服务端 session 并用一次性令牌取回。

---

### M-4 Supabase 内部错误文本泄露给用户

**文件：** `src/lib/storage.ts:44` 和 `:87`

**问题：**

```ts
throw new Error(`文件上传失败：${await res.text()}`);
```

`res.text()` 可能包含 Supabase 内部错误信息（含 bucket 路径、策略名称等），通过 `friendlyError()` 直接透传到前端。

**修复：**

```ts
// 记录内部错误，向用户只返回友好提示
if (!res.ok) {
  const detail = await res.text();
  console.error("Supabase upload error:", res.status, detail);
  throw new Error("文件上传失败，请稍后再试");
}
```

---

## 🟢 低优先级

### L-1 `Avatar` 组件关闭了 Next.js 图片优化

**文件：** `src/components/avatar.tsx:37`

**问题：**

```tsx
unoptimized={src.startsWith("http")}
```

所有 Supabase 头像 URL 都是 `https://` 开头，因此所有远程头像都绕过了 Next.js Image Optimization（无 WebP 转换、无尺寸优化）。而 `next.config.ts` 已正确配置了 `remotePatterns`，根本不需要这个 flag。

**修复：**

```tsx
// src/components/avatar.tsx:37 — 删除 unoptimized prop
<Image
  src={src}
  alt={alt}
  fill
  className="object-cover"
  // 删除 unoptimized={...} 这一行
/>
```

---

### L-2 全站 16 个页面使用 `force-dynamic` 禁用缓存

**问题：** 所有列表页（`/forum`、`/docs`、`/assignments`、`/departments` 等）都设置了 `export const dynamic = "force-dynamic"`，导致每次请求都触发完整的服务端渲染，无法利用任何 CDN 或 Next.js 缓存。

**修复：** 对含有用户个性化内容的页面（dashboard、admin）保留 `force-dynamic`；对公共列表页改用短期 revalidate：

```ts
// src/app/docs/page.tsx 等列表页
// 删除: export const dynamic = "force-dynamic";
// 改为:
export const revalidate = 60; // 60 秒 ISR 缓存
```

> 注意：如果列表页内容依赖当前用户角色过滤，仍需保留 `force-dynamic`。`/docs`、`/forum` 需要结合 H-2/H-3 的 auth 修复一起评估。

---

### L-3 `storage.ts` 中 `uploadObject` 与 `uploadObjectWithType` 逻辑重复

**文件：** `src/lib/storage.ts:14–94`

`uploadObject`（作业文件）和 `uploadObjectWithType`（图片）共享几乎相同的 fetch 逻辑，只有 `Content-Type` 和校验不同，重复了约 30 行代码。

**修复：** 直接调用已存在的私有函数，`uploadObject` 的 fetch 逻辑改为委托给 `uploadObjectWithType`：

```ts
export async function uploadObject(file: File, prefix: string) {
  if (file.size > maxBytes) throw new Error("文件超过大小上限");
  if (!allowedTypes.has(file.type) && !file.name.toLowerCase().endsWith(".zip"))
    throw new Error("仅支持 zip、pdf、doc、docx 等作业文件");

  return uploadObjectWithType(file, prefix, file.type || "application/octet-stream");
  //     ↑ 委托已有私有函数，删除 uploadObject 内部的 fetch 代码
}
```

---

## 总结

| 级别    | 编号 | 核心问题                                 | 影响                            |
| ------- | ---- | ---------------------------------------- | ------------------------------- |
| 🔴 HIGH | H-1  | 无 `middleware.ts`                       | 任何漏写 requireUser 的页面裸奔 |
| 🔴 HIGH | H-2  | `/forum` `/search` `/departments` 无认证 | 内部数据公开                    |
| 🔴 HIGH | H-3  | `docs/page.tsx` 无重定向                 | 文档列表公开                    |
| 🟡 MED  | M-1  | `passwordHash` 随用户列表泄露            | 哈希值暴露于页面 HTML           |
| 🟡 MED  | M-2  | 通知查询在 layout 层全局执行             | 每页多一次 DB 查询              |
| 🟡 MED  | M-3  | 邀请码写入 URL                           | 浏览器历史 / 服务器日志留痕     |
| 🟡 MED  | M-4  | Supabase 错误文本透传用户                | 内部路径信息泄露                |
| 🟢 LOW  | L-1  | Avatar 关闭图片优化                      | 流量浪费，加载变慢              |
| 🟢 LOW  | L-2  | 全站 force-dynamic                       | 无法利用缓存                    |
| 🟢 LOW  | L-3  | storage.ts 重复代码                      | 维护负担                        |

**建议优先顺序：H-2 → H-3（两者可能有数据泄露风险，改动最小）→ H-1（加 middleware 是长期保障）→ M-1 → M-3 → M-4 → 余下 LOW 项。**