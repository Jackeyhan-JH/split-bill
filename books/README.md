# 书单

独立运行于 `books/` 目录的书单 Web 应用（私密链接、成员与「我是谁」）。

## 开发

在 `books/` 目录下：

```bash
npm install
npm run dev
```

默认端口 **3001**（与根目录分账应用的 3000 错开）。

## 检查

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

本地 SQLite 默认位于 `books/data/books.db`（可通过 `TURSO_DATABASE_URL` 覆盖）。
