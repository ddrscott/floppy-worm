import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import fs from "fs";

// Custom plugin to filter out service worker files
const filterPublicFiles = () => ({
    name: 'filter-public-files',
    generateBundle() {
        // Files to exclude from public directory
        const excludeFiles = ['service-worker.js', 'register-sw.js', 'manifest.json'];
        excludeFiles.forEach(file => {
            const filePath = path.join(__dirname, 'build/itch', file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    }
});

export default defineConfig({
    root: path.resolve(__dirname),
    plugins: [
        tsconfigPaths(),
        filterPublicFiles()
    ],
    build: {
        outDir: "build/itch",
        emptyOutDir: true,
        base: './', // Use relative paths for all assets
        rollupOptions: {
            input: {
                index: path.resolve(__dirname, "itch.html")
            }
        },
        assetsInlineLimit: 0, // Don't inline assets, keep them as files
        chunkSizeWarningLimit: 2000, // Increase chunk size warning limit for Phaser
    },
    publicDir: "public",
    optimizeDeps: {
        include: ["phaser", "dat.gui"],
    },
    define: {
        global: "globalThis",
        'import.meta.env.BUILD_MODE': JSON.stringify('static'),
        'import.meta.env.HAS_API': JSON.stringify('false'),
        'import.meta.env.HAS_EDITOR': JSON.stringify('false'),
    },
    resolve: {
        alias: {
            "~": path.resolve(__dirname, "./app"),
            "/src": path.resolve(__dirname, "./src"),
            "@": path.resolve(__dirname, "./src")
        }
    }
});
