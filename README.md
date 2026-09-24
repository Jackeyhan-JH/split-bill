# 聚餐分账

建一个饭局，拿到别人猜不到的链接。不注册。

## 技术栈

后面的功能沿用这一套，不另换。

- Next.js（App Router）与 TypeScript
- SQLite，通过 `@libsql/client` 连接。本地开发时数据在 `data/split-bill.db`；线上用 [Turso](https://turso.tech/)（libSQL）。第一次访问时自动建表
- 不接登录；线上部署见下文「上线部署」

饭局写在表 `gatherings`（`id`、`name`、`created_at`）。参与人、账目、分摊写在同一库的新表里，用 `gathering_id` 指向饭局。饭局页地址是 `/g/<id>`。`id` 是 16 字节随机数，编码为 base64url。

线框在 `docs/wireframes/`。

## 本地运行

需要 Node.js 22。不配置 Turso 环境变量时，会自动使用本地文件 `data/split-bill.db`。

```bash
npm install && npm run dev
```

打开 http://localhost:3000

## 上线部署

公开网址：待部署后填写

### 一次性上线

1. **Turso 数据库**（账号持有人操作）
   - 安装 [Turso CLI](https://docs.turso.tech/cli) 并登录。
   - 创建数据库：`turso db create split-bill`（名称可自定）。
   - 记下连接 URL：`turso db show split-bill --url`。
   - 创建访问令牌：`turso db tokens create split-bill`。
2. **Vercel 项目**
   - 在 [Vercel](https://vercel.com) 用 GitHub 导入本仓库。
   - 使用默认 Next.js 构建设置，无需自定义 Server。
   - 在 **Production** 环境变量中设置：
     - `TURSO_DATABASE_URL`：上一步的数据库 URL
     - `TURSO_AUTH_TOKEN`：上一步的令牌
   - 首次部署完成后，把 Vercel 提供的 `https://…` 地址填到上文「公开网址」一行并提交到 main。

### 更新线上版本

- 代码合并进 `main` 后，Vercel 会自动触发新的 Production 部署。
- 也可在 Vercel 项目 **Deployments** 里选中某次部署，点 **Redeploy** 手动重新部署（例如只改了环境变量、未改代码时）。

饭局与账目保存在 Turso，重新部署不会清空数据。

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
