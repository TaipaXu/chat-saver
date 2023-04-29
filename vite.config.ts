import { resolve } from "path";
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import copy from "rollup-plugin-copy";
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    plugins: [
        vue(),
        AutoImport({
            imports: ['vue'],
            dts: resolve('src/@types', 'auto-imports.d.ts'),
        }),
        Components({
            dts: resolve('src/@types', 'components.d.ts'),
        }),
        copy({
            targets: [
                { src: "src/manifest.json", dest: "dist", },
                { src: "src/assets", dest: "dist", },
            ],
            hook: "writeBundle",
        }),
    ],
    build: {
        rollupOptions: {
            input: ["popup.html", './src/service.ts', './src/inject.ts'],
            output: {
                entryFileNames: "[name].js",
                dir: "dist",
            },
        },
    },
})
