# Chat Saver

这是一个浏览器扩展，允许你将已支持 AI 聊天网站的当前对话历史保存到本地设备。

[English](./README.md) | 中文

## 安装

[Chrome](https://chrome.google.com/webstore/detail/chat-saver/gbccnnpigcfcheaeicpldgmjjojjmldb)

[Edge](https://microsoftedge.microsoft.com/addons/detail/chat-saver/bcadbdekpengpfjjhdijmcmafplkjmeo)

## 支持的网站

- ChatGPT（`chatgpt.com`）
- DeepSeek（`chat.deepseek.com`）

## 技术栈

- [Vite+](https://viteplus.dev/guide/) 作为统一 Web 工具链和 `vp` CLI。
- [Vue](https://vuejs.org/) 用于扩展弹窗界面。
- [TypeScript](https://www.typescriptlang.org/) 用于类型化扩展代码。
- [html-to-image](https://github.com/bubkoo/html-to-image) 用于图片导出。
- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) 用于扩展 API。

## 运行环境

- Node.js：`24.17.0`
- 包管理器：`pnpm@11.5.2`
- Vite+ 会从 `package.json` 读取这些设置。

首次运行时设置：

```bash
vp env setup
vp env on
vp env install
```

## 开发

安装依赖：

```bash
vp install
```

以监听模式构建未打包扩展：

```bash
vp run dev
```

然后在 Chrome 或 Edge 中将 `dist/` 目录作为未打包扩展加载。

## 打包

通过 Vite+ 运行项目构建脚本。该命令会并行执行 Vue 类型检查和 Vite+ 生产构建：

```bash
vp run build
```

只有在需要直接运行 Vite+ 内置生产构建、跳过项目构建脚本时，才使用 `vp build`。

生产构建会输出未打包扩展文件：

```text
dist/
```

## 校验

```bash
vp check
```

也可以运行 `vp help` 查看 Vite+ 提供的完整命令列表，或运行 `vp <command> --help` 查看单个命令的帮助。

## 许可证

[GPL-3.0](LICENSE)
