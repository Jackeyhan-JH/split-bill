# 书单

独立运行于 `books/` 目录的书单 Web 应用（私密链接、成员与「我是谁」）。

## 开发

在 `books/` 目录下：

```bash
npm install
npm run dev
```

默认端口 **3001**（与根目录分账应用的 3000 错开）。

需要 Node.js **22**。未设置 Turso 环境变量时，数据在 `data/books.db`（相对 `books/` 目录）；首次访问 API 时自动建表，重新部署本地文件库不会丢表结构。

## 检查

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

## 线上网址

公开网址：https://split-bill-books.vercel.app

与分账站 https://split-bill-pi-eight.vercel.app 使用**不同的 Vercel 项目与 Turso 库**，互不影响。

### 当前线上配置

- **Vercel**：团队 **jackey-hung**（Hobby）下的项目 **`split-bill-books`**，**Root Directory** = `books/`，**Node.js** = **22.x**，Framework Preset 为 Next.js，Build Command 为 `npm run build`。
- **Turso**：数据库 **`split-bill-books`**（区域 **东京**，**Starter** 免费档），通过 [Vercel Marketplace 的 Turso 集成](https://vercel.com/integrations/turso) 创建并**仅**绑定书单 Vercel 项目；与分账项目 **`split-bill`** 及其 Turso 库 **`split-bill`** 完全独立。

### 环境变量

Turso 集成会在 Production / Preview / Development **全部环境**自动注入：

| 变量 | 说明 |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso libSQL 连接 URL |
| `TURSO_AUTH_TOKEN` | 访问令牌 |

本地开发与 CI **不必**配置上述变量；`npm run build` 也**不需要**数据库环境变量。

### 更新线上版本

- 代码 **合并进 `main`** 后，Vercel 会自动将 **`split-bill-books`** 的 **Production** 部署到最新 `main`（构建根目录为 `books/`）。
- **Pull Request** 会生成 **Preview** 部署，用于合并前验收。
- 需要手动重跑时（例如只改了环境变量、未改代码）：Vercel 控制台 → 项目 **`split-bill-books`** → **Deployments** → 选中某次部署 → **Redeploy**。

书单与评分保存在 Turso；应用启动后按 `CREATE TABLE IF NOT EXISTS` 做 idempotent 建表，重新部署**不会**清空已有数据。
