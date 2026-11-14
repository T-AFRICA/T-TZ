import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Form tests type whole forms through user-event. They finish in well
    // under a second here, but a busy CI runner has taken several times
    // longer (two timed out at the 5 s default on 2026-11-14 in a run where
    // every suite was twice as slow). The limit only bounds a hung test.
    testTimeout: 15_000,
  },
});
