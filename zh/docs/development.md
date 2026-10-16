# 从源码构建

[English](../../docs/development.md) · **简体中文**

读完本页就能在克隆的仓库里检查、测试并打包扩展；需要 [`.nvmrc`](../../.nvmrc) 指定版本的 Node.js 与 npm。

## 构建与测试

依次运行下面五条命令，就能从全新克隆得到一个测试过的 VSIX，放在 `artifacts/` 下。最后一条 `npm run package` 还会断言包内内容。

```bash
npm ci
npm run check       # 图标、清单、l10n 与模板漂移检查
npm run typecheck
npm test
npm run package     # 生成 artifacts/<name>-<version>.vsix 并断言包内内容
```

## npm 12 下的安装脚本

npm 12 的 `npm ci` 只接受从 `registry.npmjs.org` 解析的 lockfile，依赖的安装脚本（`esbuild`、`@vscode/vsce-sign`、`fsevents`）默认跳过。检查、测试和打包都用不到它们；只有本地签名或发布失败时，才用 `npm install-scripts approve <package>` 放行对应的包。CI 使用 `.nvmrc` 中 Node.js 版本自带的 npm，不受影响。

## 重新生成截图

`npm run shots` 重新生成 `media/screenshots/` 下的 README 截图。只能在 macOS 上运行，运行期间会弹出 VS Code 窗口。截图由 README 从 GitHub 加载，不打进扩展包。
