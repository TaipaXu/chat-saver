import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite-plus';
import vueDevTools from 'vite-plugin-vue-devtools';
import vuetify from 'vite-plugin-vuetify';

const copyExtensionAssets = () => ({
    name: 'copy-extension-assets',
    async closeBundle() {
        const dist = path.resolve(process.cwd(), 'dist');

        await fs.mkdir(dist, { recursive: true });
        await Promise.all([
            fs.copyFile(
                path.resolve(process.cwd(), 'src/manifest.json'),
                path.join(dist, 'manifest.json'),
            ),
            fs.cp(path.resolve(process.cwd(), 'src/assets'), path.join(dist, 'assets'), {
                recursive: true,
            }),
        ]);
    },
});

export default defineConfig({
    staged: {
        '*': 'vp check --fix',
        'popup.html': 'eslint --fix',
        '**/*.vue': 'eslint --fix',
    },
    fmt: {
        ignorePatterns: [
            '**/*.vue',
            'popup.html',
            'node_modules/**',
            'dist/**',
            'dist-ssr/**',
            '.vite/**',
            '.vscode/**',
        ],
        semi: true,
        singleQuote: true,
        indentStyle: 'space',
        indentWidth: 4,
    },
    lint: {
        plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'vue'],
        categories: {
            correctness: 'error',
        },
        env: {
            browser: true,
            builtin: true,
        },
        ignorePatterns: ['**/dist/**', '**/dist-ssr/**'],
        rules: {
            'no-array-constructor': 'error',
            'typescript/ban-ts-comment': 'error',
            'typescript/no-empty-object-type': 'error',
            'typescript/no-explicit-any': 'error',
            'typescript/no-namespace': 'error',
            'typescript/no-require-imports': 'error',
            'typescript/no-unnecessary-type-constraint': 'error',
            'typescript/no-unsafe-function-type': 'error',
            'vite-plus/prefer-vite-plus-imports': 'error',
        },
        overrides: [
            {
                files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.vue'],
                rules: {
                    'constructor-super': 'off',
                    'getter-return': 'off',
                    'no-class-assign': 'off',
                    'no-const-assign': 'off',
                    'no-dupe-class-members': 'off',
                    'no-dupe-keys': 'off',
                    'no-func-assign': 'off',
                    'no-import-assign': 'off',
                    'no-new-native-nonconstructor': 'off',
                    'no-obj-calls': 'off',
                    'no-redeclare': 'off',
                    'no-setter-return': 'off',
                    'no-this-before-super': 'off',
                    'no-undef': 'off',
                    'no-unreachable': 'off',
                    'no-unsafe-negation': 'off',
                    'no-var': 'error',
                    'prefer-const': 'error',
                    'prefer-rest-params': 'error',
                    'prefer-spread': 'error',
                },
            },
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
        jsPlugins: [
            {
                name: 'vite-plus',
                specifier: 'vite-plus/oxlint-plugin',
            },
        ],
    },
    plugins: [vue(), vueDevTools(), vuetify(), copyExtensionAssets()],
    build: {
        rollupOptions: {
            input: ['popup.html', './src/service.ts', './src/inject.ts'],
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                dir: 'dist',
            },
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
