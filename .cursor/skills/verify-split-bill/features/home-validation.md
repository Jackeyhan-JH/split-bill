# Home validation

P1 首页：展示应用名与创建表单；空饭局名提交时显示「请填写饭局名称」且不跳转。

## Sub-features

- `home-visible` — H1–H4 可见（聚餐分账、说明、标签+占位、创建饭局按钮）。
- `home-empty-error` — 不输入点创建，出现 role=alert 文案「请填写饭局名称」，URL 仍为 `/`。

## How to get to it (user POV)

- 打开 `/`（手机宽度 375px）。

## Driving it with Playwright

Preconditions:

- `helpers/doctor.sh` 通过。
- 视口 `{ width: 375, height: 667 }`。

- **打开首页。** `page.goto('http://127.0.0.1:3000/')`。可见 heading「聚餐分账」、text「不注册，靠链接分享」、label「饭局名称」、placeholder「例如：周五火锅」、button「创建饭局」。
- **触发校验。** `page.getByRole('button', { name: '创建饭局' }).click()`。`main` 内 `role=alert` 文本为「请填写饭局名称」；`page.url()` 以 `/` 结尾且无 `/g/`。
- **Proof。** `page.screenshot({ path: '.../home-empty-error.png', fullPage: true })`。

## Gotchas

- 只含空格的名称是否视为空由实现决定；issue #2 验收以 trim 后为空为准，但不应单独判 PR 不合格。
- 首页只有一个 text input；勿与登录表单混淆（本应用无登录）。
