import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 120_000,
    // Avoid native sharp/onnx teardown crashes on Windows vitest workers.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: false
      }
    }
  }
});
