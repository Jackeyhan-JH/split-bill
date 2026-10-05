import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflowPath = path.join(repoRoot, ".github/workflows/books.yml");

describe("books CI workflow", () => {
  test("exists with path filters for books only", () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const yaml = fs.readFileSync(workflowPath, "utf8");
    expect(yaml).toMatch(/books\/\*\*/);
    expect(yaml).toMatch(/\.github\/workflows\/books\.yml/);
    expect(yaml).not.toMatch(/pull_request:[\s\S]*paths:[\s\S]*app\//);
    expect(yaml).toContain("working-directory: books");
  });
});
