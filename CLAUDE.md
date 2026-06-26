# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev              # start dev server
npm run build            # production build
npm run lint             # ESLint
npm run prisma:generate  # regenerate Prisma client after schema changes
npm run prisma:migrate   # create and apply a new migration (dev only)
npm run prisma:seed      # seed admin user and invite code
```

For production database migrations: `npx prisma migrate deploy`

There are no automated tests.

## Architecture

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma 6 + PostgreSQL · Auth.js v5 (beta) · Supabase Storage · Tailwind CSS v4

### Data model

Three-tier roles: `MEMBER`, `LEADER`, `ADMIN`. Each user belongs to a `Division` (SOFTWARE, ANALOG, GENERAL) and a `Team` (CONTROL, VISION, FPGA, HARDWARE, GENERAL). The `validTeamsByDivision` map in `src/lib/labels.ts` enforces valid combinations. `GENERAL` division/team acts as a wildcard that is visible to everyone.

Core Prisma models: `User`, `InviteCode`, `TechDoc`, `DocVersion`, `ForumPost`, `ForumReply`, `Report`, `Assignment`, `Submission`, `AuditLog`.

### Auth & authorization

- `src/auth.ts` — Auth.js v5 config, JWT strategy with Credentials provider. Custom session fields: `id`, `role`, `status`, `division`, `team`.
- `src/lib/authz.ts` — server-side guards: `requireUser()` / `requireLeader()` redirect on failure; `canManageScope()` checks division/team ownership for LEADER; `canSeeAssignment()` filters assignment visibility.

### Server actions

All mutations live in `src/lib/actions.ts` (`"use server"`). The pattern is:
1. Call `requireUser()` / `requireLeader()` at the top.
2. Parse + validate with Zod.
3. Write to Prisma, call `revalidatePath()`, then `redirect()`.
4. Errors are caught and turned into `?error=` redirects via `redirectWithError()`; successes use `redirectWithSuccess()`.

`FeedbackBanner` in `src/components/feedback-banner.tsx` reads these query params client-side.

### File uploads

`src/lib/storage.ts` uploads directly to Supabase Storage via its REST API (no SDK). Two helpers:
- `uploadObject` — assignment attachments (zip/pdf/doc/docx, ≤ `MAX_UPLOAD_BYTES`).
- `uploadImageObject` — forum images (jpg/png/webp, ≤ `MAX_IMAGE_UPLOAD_BYTES`, default 5 MB).

Storage paths follow `<prefix>/<timestamp>-<uuid>-<safeName>` to avoid collisions.

### UI conventions

- `src/components/ui.tsx` exports `cn()` (clsx + tailwind-merge), `Badge`, `Field`, `inputClass`, `buttonClass`, `secondaryButtonClass`.
- Design tokens are CSS custom properties (e.g. `bg-surface`, `text-text-primary`, `border-border`, `bg-primary`). Use these instead of hardcoded Tailwind colors.
- `SubmitButton` in `src/components/submit-button.tsx` shows pending state during form submission.
- `MarkdownView` renders Markdown with `react-markdown` + `remark-gfm`.

### Route map

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/login` `/register` | Auth |
| `/dashboard` | Personal profile, submissions, reminders |
| `/docs` `/docs/[slug]` `/docs/new` | Tech docs (LEADER+ to create) |
| `/forum` `/forum/[id]` `/forum/new` | Forum (anonymous posting supported) |
| `/assignments` `/assignments/[id]` `/assignments/new` | Assignments |
| `/departments` | Department showcase |
| `/search` | Full-site search |
| `/admin` | User approval, role change, invite codes, reports, audit log (LEADER+) |

### Anonymity

Forum posts/replies can be anonymous. The DB stores `authorId` but the UI shows "匿名成员". Only ADMINs can trigger de-anonymization, which always writes an `AuditLog` entry (`REVEAL_ANONYMOUS_AUTHOR` action).
