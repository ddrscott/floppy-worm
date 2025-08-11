import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

installGlobals();

export default defineConfig({
    plugins: [
        remix({
            ssr: false,
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
        'import.meta.env.BUILD_MODE': JSON.stringify('server'),
        'import.meta.env.HAS_API': 'true',
        'import.meta.env.HAS_EDITOR': 'true',
    },
});
