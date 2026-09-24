# Not found

无效 `/g/<id>` 显示 P5：「找不到这个饭局」、说明文案、「回首页」链接，无饭局区块内容。

## Sub-features

- `not-found-copy` — N1–N3 文案与线框 `w5-not-found.png` 一致。
- `not-found-no-leak` — 无「账目」「结算」「记一笔」等饭局页元素。

## How to get to it (user POV)

- 直接打开 `/g/` + 不存在的 id（如 `/g/this-is-random-garbage-id-xyz`）。

## Driving it with Playwright

Preconditions:

- `helpers/doctor.sh` 通过。

- **打开无效链接。** `page.goto('http://127.0.0.1:3000/g/not-a-real-gathering')`。
- **断言。** heading「找不到这个饭局」；text「链接可能打错了，或饭局不存在」；link「回首页」；`getByText('账目')` count 0。
- **Proof。** 全页截图 `not-found.png`。

## Gotchas

- `notFound()` 使用 `app/g/[id]/not-found.tsx`；与有效 id 的 loading 态不同。
- 「回首页」为 Next.js `Link`，可测 bounding box ≥ 44px（issue #1 AC7 在 P5 上）。
