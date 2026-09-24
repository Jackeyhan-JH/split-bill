import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "split-bill-")), "test.sqlite");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_PATH: databasePath,
    },
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
});
