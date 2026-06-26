# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev           # start dev server on localhost:3000
npm run build         # production build
npm run lint          # ESLint
npm run prisma:generate  # regenerate Prisma client after schema changes
npm run prisma:migrate   # run migrations in dev (creates migration files)
npm run prisma:seed      # seed admin account and invite code
```

There are no automated tests in this project.

After any `prisma/schema.prisma` change, always run `prisma:generate` before building.

## Architecture

**Stack:** Next.js 16 App Router · TypeScript · Prisma + PostgreSQL · Auth.js v5 (next-auth beta) · Tailwind CSS v4 · Supabase Storage

**Key entry points:**
- `src/auth.ts` — Auth.js config (JWT strategy, credentials provider). Role/division/team are embedded in the JWT and exposed via `session.user`.
- `src/lib/prisma.ts` — singleton Prisma client.
- `src/lib/actions.ts` — all Server Actions (the only mutation layer; no separate API routes for data mutations).
- `src/lib/authz.ts` — `requireUser()`, `requireLeader()`, `canManageScope()`, `canSeeAssignment()` — call these at the top of every Server Action or page that has access restrictions.
- `src/lib/storage.ts` — Supabase Storage upload helpers used by actions (`uploadObject` for assignment files, `uploadImageObject` for forum images).
- `src/lib/labels.ts` — display strings for all enums; also defines `validTeamsByDivision` which drives the division→team constraint in the UI.

**Route structure** (`src/app/`):
- `/` root, `/login`, `/register` — public
- `/dashboard` — personal profile: submissions, authored posts, upcoming deadlines
- `/docs`, `/docs/[slug]`, `/docs/new` — tech docs (LEADER+ to create)
- `/forum`, `/forum/[id]`, `/forum/new` — forum with anonymous posting
- `/assignments`, `/assignments/[id]`, `/assignments/new` — assignments (LEADER+ to create; members submit files)
- `/departments` — org chart / department listing
- `/search` — full-site search across docs and forum
- `/admin` — user approval, role management, invite codes, report queue, audit log (LEADER+ access; some sections ADMIN-only)
- `/api/auth/[...nextauth]` — Auth.js catch-all

**Authorization model:**
- Three roles: `MEMBER < LEADER < ADMIN`.
- `canManageScope(user, target)` — a LEADER can only manage content in their own division/team; ADMIN can manage everything. `GENERAL` division/team is visible to all LEADERs.
- `canSeeAssignment(user, assignment)` — members only see assignments matching their division and team (or GENERAL team).
- Anonymous posts: `authorId` is always stored. Only ADMIN can trigger `revealAnonymousAuthorAction`, which writes an `AuditLog` entry.

**Enum constraints:**
- `Division`: `SOFTWARE | ANALOG | GENERAL`
- `Team`: `CONTROL | VISION | FPGA | HARDWARE | GENERAL`
- Valid team per division: SOFTWARE → CONTROL, VISION; ANALOG → FPGA, HARDWARE (see `validTeamsByDivision` in `src/lib/labels.ts`). Members cannot belong to GENERAL division/team.

**Error/redirect pattern in Server Actions:** use `redirectWithError(path, message)` / `redirectWithSuccess(path, message)` helpers (already defined in `actions.ts`). Pages read `?error=` and `?success=` search params to surface feedback banners via `<FeedbackBanner>`.

**File uploads:** handled directly in Server Actions via `src/lib/storage.ts` (raw fetch to Supabase Storage REST API — no SDK). Assignment attachments accept zip/pdf/doc/docx up to `MAX_UPLOAD_BYTES` (default 50 MB). Forum images accept jpg/png/webp up to 5 MB, max 9 per post/reply.

## Environment variables

Copy `.env.example` to `.env`. Required:

```
DATABASE_URL           # PostgreSQL connection string
AUTH_SECRET            # random secret (openssl rand -base64 32)
AUTH_URL               # http://localhost:3000 in dev
SUPABASE_URL           # https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET  # e.g. eea-hub
MAX_UPLOAD_BYTES       # defaults to 52428800 (50 MB)
SEED_ADMIN_PASSWORD    # used by prisma:seed
SEED_INVITE_CODE       # used by prisma:seed
```

Default seed credentials: username `admin`, password from `SEED_ADMIN_PASSWORD`.
