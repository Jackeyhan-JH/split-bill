# Create gathering

用户输入饭局名并创建，进入 `/g/<id>` 饭局页，G1 显示名称；链接可在新 browser context 中打开同一饭局。

## Sub-features

- `create-named` — 输入名称后进入饭局页，URL 变化。
- `create-link-reopen` — 新 context 打开同一 URL 见相同 G1。
- `create-isolated` — 两个饭局链接不同，各自只显示自己的名称。

## How to get to it (user POV)

- 首页输入饭局名称 → 点「创建饭局」。

## Driving it with Playwright

Preconditions:

- `helpers/doctor.sh` 通过。
- 可选：`RUN_ID` 环境变量区分证据目录。

- **创建（helper）。** `RUN_ID=... node helpers/drive-create-gathering.mjs`。stdout JSON 含 `url` 与 `screenshot`；页面 heading level 1 等于饭局名。
- **新 context 验证。** `browser.newContext()` → `goto(url)` → 同一 G1 文案；截图 `fresh-context.png`。
- **双饭局。** 连续两次从 `/` 创建「A」「B」；`urlA !== urlB`；分别 goto 只见到对应标题。

## Gotchas

- Gathering id 为 22 字符 URL-safe 字符串；路由 `app/g/[id]/page.tsx`。
- G2/G3/G5a/G13 本切片可能无业务逻辑；仅验证可见与尺寸，不要求点击有效。
- SQLite 文件在 repo 本地；并发验收取决于单 dev 实例，勿并行两个 drive 改同一 DB 除非隔离数据目录（当前 skill 未配置 DATA_DIR 覆盖）。
