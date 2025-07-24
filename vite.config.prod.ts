import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

installGlobals();

export default defineConfig({
    plugins: [
        remix({
            ssr: false,
            ignoredRouteFiles: [
                "routes/maps.*",
                "routes/api.*"
            ],
        }),
        tsconfigPaths()
    ],
    server: {
        port: 3001
    },
    optimizeDeps: {
        include: ["phaser", "dat.gui"],
    },
    define: {
        global: "globalThis",
    },
});