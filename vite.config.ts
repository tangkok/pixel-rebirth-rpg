import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  // Relative URLs work at both a domain root and GitHub Pages project paths.
  base: "./",
  test: { include: ["tests/*.test.ts"] },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        astra: resolve(__dirname, "astra/index.html"),
      },
    },
  },
});
