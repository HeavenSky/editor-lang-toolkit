# Editor Lang Toolkit

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/HeavenSky.editor-lang-toolkit?label=marketplace)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.txt)

[English](./README.md) · **简体中文**

> 市场页只渲染英文版 README, 不随访问者的显示语言切换; 插件界面本身是双语的。

YAML 与 TOML 的语言支持: 校验, 补全, 悬停提示, 格式化与导航. 两个语言服务器都打包在扩展内,
无需另外安装任何东西.

## 为什么需要它

VS Code 内置了完整的 JSON 语言服务, 但对 YAML 只提供了 TextMate 语法, 对 TOML 则什么都没有.
本扩展补上这两处空缺, 而且不要求你先装一个 CLI 工具 —— 语言类扩展应该装上就能用.

|                      | JSON | YAML     | TOML     |
| -------------------- | ---- | -------- | -------- |
| 内置语法高亮         | 有   | 有       | **无**   |
| 内置语言服务         | 有   | **无**   | **无**   |
| 本扩展提供           | —    | **有**   | **有**   |

## 功能

以下能力全部来自两个内置的语言服务器. 不打开 YAML 或 TOML 文件时, 扩展不会启动任何进程.

### YAML — 基于 [yaml-language-server](https://github.com/redhat-developer/yaml-language-server)

- **校验**: JSON Schema (draft-04, draft-07, 2019-09, 2020-12), 未使用锚点, flow 风格规则,
  映射键顺序
- **Schema 发现**: modeline (`# yaml-language-server: $schema=…`), 文档内 `$schema` 属性,
  `yaml.schemas` 设置, 以及 [SchemaStore](https://www.schemastore.org/) 目录
- **补全**, **悬停提示**, **文档符号**, **代码折叠**, 锚点**跳转定义**, **重命名**,
  **文档链接**, **智能选区**, **快速修复**与 **CodeLens**
- **格式化**, 含输入时格式化

### TOML — 基于 [Taplo](https://github.com/tamasfe/taplo)

- **语法高亮**, 含语义 token
- **校验**: JSON Schema, schema 关联可通过 `.taplo.toml` 或设置指定
- **补全**, **悬停提示**, **文档符号**, **代码折叠**, **重命名**与**文档链接**
- **格式化**, 可通过 `.taplo.toml` 或 `langToolkit.taplo` 设置调整

### ANSI — 终端转义序列

抓取下来的终端输出 (`.ans`, `.ansi`) 会按其真实颜色渲染, 而不是显示成一堆转义码.

- **完整的 SGR 覆盖**: 16 色, 亮色变体, 256 色 (`38;5;n`) 与**真彩色** (`38;2;r;g;b`),
  以及粗体, 弱化, 斜体, 下划线, 双下划线, 删除线, 上划线, 反色与隐藏
- **颜色跟随主题** —— 映射到 VS Code 的 `terminal.ansi*` 颜色, 无需任何配置
- **非 SGR 序列被正确识别而不是渲染成乱码** —— 光标移动, 清行之类会被淡化显示;
  进度条与 spinner 正是由这些控制字符构成的
- **预览**: 打开一个**真正的编辑器**, 内容是剥离转义序列后的文本, 因此搜索, 选择与复制
  都照常可用

要给其他文件上色, 把它们关联到 `ansi` 语言:

```jsonc
{ "files.associations": { "*.log": "ansi" } }
```

代价是失去内置 `log` 语法的时间戳着色 —— 只有文件里确实含转义码时才划算, 因为那种情况下
内置语法本来也只会把它们渲染成噪声.

## 设置

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| `langToolkit.yaml.enabled` | `true` | 启用 YAML 语言服务器. 语法高亮不受影响. |
| `langToolkit.toml.enabled` | `true` | 启用 TOML 语言服务器. 语法高亮不受影响. |
| `langToolkit.taplo` | `{}` | 传给 Taplo 的设置, 键名 camelCase. 见 [Taplo 配置文档](https://taplo.tamasfe.dev/configuration/file.html). |
| `langToolkit.toml.grammarUpdate.enabled` | `true` | 每周在后台检查 TOML 语法是否有新版. |
| `langToolkit.toml.grammarUpdate.url` | 上游 `toml.tmLanguage.json` | 语法文件的来源地址. |

YAML 的 schema 关联沿用 `yaml.schemas` 与 `yaml.schemaStore.*` —— 这些键由
`yaml-language-server` 直接读取, 因此已有配置无需改动.

## 命令

| 命令 | 作用 |
| --- | --- |
| `Lang Toolkit: 重启语言服务器` | 重启两个服务器, 不需要重载窗口. |
| `Lang Toolkit: 检查 TOML 语法更新` | 立刻检查一次, 不等每周的自动检查. |
| `Lang Toolkit: 打开 ANSI 预览` | 以剥离转义序列后的形态打开当前文件. |
| `Lang Toolkit: 在侧边打开 ANSI 预览` | 同上, 并排显示. |

## 网络行为

有两处会访问网络, 都可以关闭:

1. **下载 schema.** 两个语言服务器都会下载文件中引用的 JSON Schema, YAML 还会额外下载
   SchemaStore 目录. 关掉对应的语言服务器即可完全停止.
2. **更新 TOML 语法.** 每周一次, 在后台检查上游的 TOML TextMate 语法是否有变化. 下载内容
   必须能解析为 JSON 且声明了 `source.toml` scope 才会被接受, 并且采用原子写入 —— 一次坏的
   响应不可能破坏内置语法. **语法更新需要重载窗口后才生效**, 因为 `contributes.grammars` 是
   在扩展加载时读取的. 把 `langToolkit.toml.grammarUpdate.enabled` 设为 `false` 即可一直使用
   内置语法, 且不再为此发起任何请求.

不含任何遥测.

## 体积

扩展内置了两个语言服务器, 因此比一般的语言类扩展大:

| 组成 | 体积 |
| --- | --- |
| `out/extension.js` (客户端 + YAML 服务器 + Taplo 胶水) | 约 1.7 MB |
| `out/taplo.wasm` | 约 25 MB (压缩后约 6.6 MB) |

Taplo 上游把 WebAssembly 以 base64 内联在一个 34 MB 的 JavaScript 文件里. 本扩展在构建时把它
拆成独立的 `.wasm`, 下载体积因此少掉约三分之一 —— base64 的 4/3 膨胀, gzip 压不回原始二进制
的密度.

## 许可

MIT, 见 [LICENSE.txt](./LICENSE.txt). 内置的第三方组件及其许可列在 [NOTICE.md](./NOTICE.md).
