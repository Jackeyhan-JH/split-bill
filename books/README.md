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

公开网址：**TBD（部署后填写）**

（与分账站 https://split-bill-pi-eight.vercel.app 不同项目、不同 Turso 库，互不影响。）

### 环境变量

线上由 [Vercel Marketplace 的 Turso 集成](https://vercel.com/integrations/turso) 绑定**书单专用**数据库后，会在 Production / Preview / Development **全部环境**自动注入：

| 变量 | 说明 |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso libSQL 连接 URL |
| `TURSO_AUTH_TOKEN` | 访问令牌 |

本地开发与 CI **不必**配置上述变量；`npm run build` 也**不需要**数据库环境变量。

### 协调人一次性 Vercel 配置（书单独立项目）

1. 在团队 **jackey-hung**（Hobby）新建 Vercel 项目，从本仓库导入；**不要**改已有 `split-bill` 分账项目。
2. **Root Directory** 设为 `books/`。
3. **Framework Preset**：Next.js（默认）。
4. **Install Command**：`npm install`（或 `npm ci`）。
5. **Build Command**：`npm run build`（默认）。
6. **Output Directory**：Next.js 默认（留空即可）。
7. **Node.js Version**：22（与 `package.json` 的 `engines` 一致；或在项目 Settings → General 中选 22.x）。
8. 在同一 Vercel 项目中通过 Turso 集成创建并绑定**新的** Turso 数据库（勿与分账库共用）。
9. 首次部署成功后，将 Production 的 `https://…vercel.app` 地址写进上文「公开网址」一行并推到 `main`。

### 更新线上版本

- 代码 **合并进 `main`** 后，书单 Vercel 项目会自动 **Production** 部署（仅当变更落在 `books/` 或 `.github/workflows/books.yml` 时，GitHub 会跑书单 CI；Vercel 仍监听整仓，以项目内 Root Directory 为准）。
- **Pull Request** 会生成 **Preview** 部署，用于合并前验收。
- 只改了环境变量、未改代码时：Vercel 控制台 → 书单项目 **Deployments** → 选中部署 → **Redeploy**。

书单与评分保存在 Turso；应用启动后按 `CREATE TABLE IF NOT EXISTS` 做 idempotent 建表，重新部署**不会**清空已有数据。
