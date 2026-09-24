# split-bill verification map

Maintained recipes for user-visible behavior in 聚餐分账. Read this index before driving; match routes under `app/`.

## Baseline preconditions

- Dev server at `http://127.0.0.1:3000` (`verify-split-bill` Launch or `npm run dev`).
- `helpers/doctor.sh` exits 0.
- Playwright Chromium installed: `npx playwright install chromium` (once per environment).
- Viewport **375×667** unless a feature says otherwise.

## Driving conventions

- Prefer `getByRole` / `getByLabel` with Chinese copy from `lib/copy.ts`.
- Start from home `/` unless preconditions say otherwise.
- Evidence under `/opt/cursor/artifacts/verify-split-bill/<RUN_ID>/`.
- Do not delete proof artifacts during cleanup.

## Features

- [Home validation](./home-validation.md) — P1 首页 H1–H4，空名错误 H5。
- [Create gathering](./create-gathering.md) — issue #2 建饭局、专属链接、双饭局隔离。
- [Not found](./not-found.md) — P5 无效链接。

Planned (later issues): 加人 / 记一笔 / 分享 — add feature files when routes become interactive.
