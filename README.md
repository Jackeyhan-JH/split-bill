# 聚餐分账

建一个饭局，拿到别人猜不到的链接。不注册。

## 技术栈

后面的功能沿用这一套，不另换。

- Next.js（App Router）与 TypeScript
- SQLite，驱动是 better-sqlite3。数据库文件是 `data/split-bill.sqlite`，第一次访问时自动创建
- 不接外部服务，没有登录

饭局写在表 `gatherings`（`id`、`name`、`created_at`）。参与人、账目、分摊以后加在同一个 SQLite 文件的新表里，用 `gathering_id` 指向饭局。饭局页地址是 `/g/<id>`。`id` 是 16 字节随机数，编码为 base64url。

线框在 `docs/wireframes/`。

## 本地运行

需要 Node.js 22。

```bash
npm install && npm run dev
```

打开 http://localhost:3000

## 检查与测试

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

`npm test` 覆盖创建、读取、找不到饭局、链接唯一且不可猜，以及参与人的增删改。`npm run test:e2e` 用 Playwright，视口 375×667，覆盖建饭局与参与人相关 AC。

AC8（已入账不可删）在单元测试里用 `lib/expenses.seedExpense` 写入最小账目行；端到端在 `E2E_TEST_HELPERS=1` 时调用 `POST /api/gatherings/<id>/test/expenses`（Playwright 的 webServer 已设置该变量）。该路由仅用于测试，生产 dev 默认不可用。

GitHub Actions 在 pull request 和推送到 `main` 时安装依赖、跑 lint、类型检查、单元测试，并安装 Playwright 浏览器后跑端到端测试。
