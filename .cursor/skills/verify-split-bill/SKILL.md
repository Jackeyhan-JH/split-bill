---
name: verify-split-bill
description: "Drive the split-bill Next.js web app (聚餐分账) at 375×667 with Playwright: launch dev server, health-check, create gatherings, capture AC evidence under /opt/cursor/artifacts/. Use when verifying PRs for issues #1–#2 or regressions on home, empty gathering, and not-found pages."
---

# verify-split-bill

Primary surface: mobile-first web UI (`http://127.0.0.1:3000`). Data persists in local SQLite via `better-sqlite3` (`lib/db.ts`); each verification run should use an isolated process and not assume a clean DB unless you note leftover gatherings.

## Launch

From repo root (Node ≥ 22):

```bash
.cursor/skills/verify-split-bill/helpers/launch.sh
```

- Starts `npm run dev` in tmux session `verify-split-bill-dev` (cwd = repo root).
- Ready when `curl -sf http://127.0.0.1:3000/` succeeds (script polls up to 120s).
- Writes PID/session marker to `/tmp/verify-split-bill-dev.pid` (contains tmux session name).

Teardown is **not** part of launch; use Cleanup below.

## Doctor

```bash
.cursor/skills/verify-split-bill/helpers/doctor.sh
```

Read-only checks (exit 0 only if all pass):

1. `node -v` reports major ≥ 22.
2. HTTP GET `http://127.0.0.1:3000/` returns 200.
3. Response body includes `聚餐分账` (home shell reachable).
4. tmux session `verify-split-bill-dev` exists **or** port 3000 responds (allows driving against an already-running dev server you did not start).

Run doctor before every drive when anything looks stale.

## Drive

Harness: **Playwright** (`@playwright/test` / `playwright` from devDependencies). Viewport **375×667**. Prefer roles and labels from `lib/copy.ts`:

| UI | Stable handle |
|----|----------------|
| 饭局名输入 | `getByLabel('饭局名称')` |
| 创建 | `getByRole('button', { name: '创建饭局' })` |
| 饭局标题 G1 | `getByRole('heading', { level: 1 })` |
| 复制链接 G2 | `getByRole('button', { name: '复制链接' })` |
| 分享 G3 | `getByRole('button', { name: '分享' })` |
| + 加人 G5a | `getByRole('button', { name: '+ 加人' })` |
| 记一笔 G13 | `getByRole('button', { name: '记一笔' })` |
| 找不到页 | `getByRole('heading', { name: '找不到这个饭局' })` |

Example — drive **create gathering** (maps to `features/create-gathering.md`):

```bash
RUN_ID=${RUN_ID:-$(date +%s)} \
  node .cursor/skills/verify-split-bill/helpers/drive-create-gathering.mjs
```

Creates饭局「验收技能」from `/`, asserts URL matches `/g/<id>`, saves screenshot and JSON under `/opt/cursor/artifacts/verify-split-bill/$RUN_ID/`.

For full issue #2 / #1 AC matrix, see feature map in `features/README.md`. One-off PR verification script pattern lives in helpers as reference only; extend feature files instead of duplicating AC lists in SKILL.md.

## Evidence

- Directory: `/opt/cursor/artifacts/verify-split-bill/<RUN_ID>/` (created by drive helpers).
- Each proof: **screenshot** (`.png`, full page) plus **structured JSON** (`.json`) with URL, visible copy, and measured px where relevant.
- Standards: use real UI paths (form submit → navigation), not direct API calls alone. Capture state after the user action (error alert, new URL, heading text). For link persistence, open a **new browser context** with the same URL.
- Side effects: creating a gathering inserts a SQLite row; record the gathering URL in JSON if later cleanup must target it.
- Compare layout to wireframes under `docs/wireframes/` (`w1-home.png`, `w2b-gathering-empty.png`, `w5-not-found.png`) visually; filenames should reference the AC or page.

Proof artifacts must survive Cleanup.

## Cleanup

```bash
.cursor/skills/verify-split-bill/helpers/cleanup.sh
```

- Sends `C-c` to tmux session `verify-split-bill-dev` only if `/tmp/verify-split-bill-dev.pid` exists and records that session (never `pkill node`).
- Removes `/tmp/verify-split-bill-dev.pid`.
- Does **not** delete `/opt/cursor/artifacts/**`.

After cleanup, confirm evidence still exists:

```bash
test -f "/opt/cursor/artifacts/verify-split-bill/$RUN_ID/create-gathering.png"
```

## Helpers

All paths relative to repo root; `chmod +x` already set in git.

| Script | Purpose |
|--------|---------|
| `helpers/launch.sh` | tmux + `npm run dev`, wait for :3000 |
| `helpers/doctor.sh` | readiness + Node version |
| `helpers/drive-create-gathering.mjs` | Playwright: home → create → gathering screenshot |
| `helpers/cleanup.sh` | stop dev session started by launch |

Invoke drive helper with repo devDependencies:

```bash
cd /path/to/split-bill && NODE_PATH=$PWD/node_modules node .cursor/skills/verify-split-bill/helpers/drive-create-gathering.mjs
```

Maintenance: keep `features/` aligned with routes under `app/`; use `/maintain-verification-skill` when the app adds flows (加人, 记一笔, etc.).
