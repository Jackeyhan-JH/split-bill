import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const booksRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: booksRoot,
  turbopack: {
    root: booksRoot,
  },
};

export default nextConfig;
