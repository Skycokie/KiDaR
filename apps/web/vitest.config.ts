import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig keeps `jsx: preserve` for Next; tests that render components need a real transform.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
