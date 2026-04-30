import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main/index.ts",
        vite: {
          build: {
            outDir: "dist-electron/main",
            emptyOutDir: true,
            rollupOptions: {
              external: ["screenshot-desktop"],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload/index.ts"),
        vite: {
          build: {
            outDir: "dist-electron/preload",
            emptyOutDir: true,
          },
        },
      },
      renderer: process.env.NODE_ENV === "test" ? undefined : {},
    }),
    renderer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
