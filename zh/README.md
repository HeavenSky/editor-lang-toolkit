# Editor Lang Toolkit

[English](../README.md) · **简体中文**

> 扩展市场页只显示英文版 README；扩展界面会跟随 VS Code 的显示语言切换为中文。

YAML 与 TOML 的 schema 校验、补全和格式化，ANSI 日志按终端真实颜色显示，uv 项目里的 Python 按 F5 即可调试，不用另装语言服务器或命令行工具。

[![VS Marketplace](https://vsmarketplacebadges.dev/version-short/HeavenSky.editor-lang-toolkit.svg?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![Installs](https://vsmarketplacebadges.dev/installs-short/HeavenSky.editor-lang-toolkit.svg)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![License](https://img.shields.io/badge/license-MIT-blue)](../LICENSE.txt)

VS Code 给 JSON 内置了完整的语言服务，YAML 却只有语法高亮，TOML 连高亮都没有。补这块空缺的扩展大多要求先装 `taplo` 之类的命令行工具。**本扩展把两个语言服务器都打包在内，打开配置文件就能用。** 不收集任何遥测数据。

![YAML 文件按 JSON Schema 校验：「replicas: three」被标出 "Incorrect type. Expected integer"](../media/screenshots/yaml-validation.png)

## 快速开始

1. 安装扩展：

    ```bash
    code --install-extension HeavenSky.editor-lang-toolkit
    ```

2. 打开 GitHub workflow 这类常见的 YAML 文件，写错的地方立刻标出波浪线。
3. 其他 YAML 文件在第一行指定 schema，再按 `Ctrl+Space` 就能看到补全：

    ```yaml
    # yaml-language-server: $schema=./service.schema.json
    ```

## 边写边发现配置错误

编辑 YAML 和 TOML 时按 JSON Schema 实时校验，补全和悬停提示也来自同一份 schema。YAML 依次从 modeline、文档内的 `$schema`、`yaml.schemas` 设置和 SchemaStore 目录查找 schema；TOML 从 `.taplo.toml` 读取关联。完整规则见[为 YAML 与 TOML 指定 schema](docs/schemas.md)。

![YAML 文件里的补全，候选值与说明都取自 JSON Schema](../media/screenshots/yaml-completion.png)

## 编辑器和 CI 共用一份 TOML 配置

扩展读取的 `.taplo.toml` 就是 `taplo` 命令行读的那一份，格式化与 schema 规则两边一致，不用维护第二份。没有这个文件时，同样的选项写在 `langToolkit.taplo` 设置里。

![TOML 文件的语法高亮与 schema 报错](../media/screenshots/toml-validation.png)

## 按真实颜色阅读终端日志

语言为 `ansi` 的文件（`.ans`、`.ansi`）会把转义码渲染成颜色，从 16 色到 24 位真彩色都支持。颜色取自当前主题的终端调色板，无需配置。要给日志等其他文件着色，这样关联：

```jsonc
{ "files.associations": { "*.log": "ansi" } }
```

![着色后的 ANSI 日志，旁边是去掉转义码的预览](../media/screenshots/ansi-preview.png)

## 按 F5 调试 uv 项目

在 `.py` 文件里按 F5 就能下断点、单步、看变量，不需要微软的 Python 扩展，只要装好 `uv`。程序跑在 `uv run` 为项目解析出的环境里，`debugpy` 由 uv 临时拉取，不会写进项目依赖。`launch.json` 模板与附加调试见[在 uv 项目中调试 Python](docs/python-debugging.md)。

## 不适合的场景

Python 部分只有调试器：需要解释器选择、测试资源管理器或 notebook，请用微软的 Python 扩展。需要在编辑器之外格式化或校验 TOML，就对同一份 `.taplo.toml` 运行 `taplo` 命令行；本扩展不提供命令行工具。

## 延伸阅读

[使用指南](docs/README.md)涵盖 schema、ANSI 文件、Python 调试、网络访问与故障排查。命令和设置的完整清单见扩展市场页的 **Feature Contributions** 标签。各版本的变化见[更新日志](CHANGELOG.md)，打包在内的上游项目见 [NOTICE.md](../NOTICE.md)。

## 许可证

[MIT](../LICENSE.txt)
