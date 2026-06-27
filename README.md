# Chat Saver

A browser extension that allows you to save the current chat history from supported AI chat sites to your local device.

English | [中文](./README_ZH.md)

## Installation

[Chrome](https://chrome.google.com/webstore/detail/chat-saver/gbccnnpigcfcheaeicpldgmjjojjmldb)

[Edge](https://microsoftedge.microsoft.com/addons/detail/chat-saver/bcadbdekpengpfjjhdijmcmafplkjmeo)

## Supported Sites

- ChatGPT (`chatgpt.com`)
- DeepSeek (`chat.deepseek.com`)

## Tech Stack

- [Vite+](https://viteplus.dev/guide/) as the unified web toolchain and `vp` CLI.
- [Vue](https://vuejs.org/) for the extension popup UI.
- [TypeScript](https://www.typescriptlang.org/) for typed extension code.
- [html-to-image](https://github.com/bubkoo/html-to-image) for image export.
- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) for extension APIs.

## Runtime

- Node.js: `24.17.0`
- Package manager: `pnpm@11.9.0`
- Vite+ reads these settings from `package.json`.

First-time runtime setup:

```bash
vp env setup
vp env on
vp env install
```

## Development

Install dependencies:

```bash
vp install
```

Build the unpacked extension in watch mode:

```bash
vp run dev
```

Then load the `dist/` directory as an unpacked extension in Chrome or Edge.

## Build

Run the project build script through Vite+. This runs Vue type checking and the Vite+ production build in parallel:

```bash
vp run build
```

Use `vp build` only when you want to run the built-in Vite+ production build directly without the project script.

The production build outputs the unpacked extension files:

```text
dist/
```

## Validation

```bash
vp check
```

Run `vp help` to see the full list of Vite+ commands, or `vp <command> --help` for command-specific help.

## License

[GPL-3.0](LICENSE)
