import { defineConfig } from "vitest/config";
export default defineConfig({
  // Relative URLs work at both a domain root and GitHub Pages project paths.
  base: "./",
  test: { include: ["tests/*.test.ts"] },
  build: { chunkSizeWarningLimit: 1500 },
});
