# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## v0.0.4 2026-10-16 文档重写

**变更**：

- 文档：README 改为简短的概览；schema、ANSI、Python 调试、网络访问和故障排查各有一页，放在[使用指南](https://github.com/HeavenSky/editor-lang-toolkit/blob/HEAD/zh/docs/README.md)下，中文页面移到 `zh/` 目录。

## v0.0.3 2026-10-13 uv 项目的 Python 调试

**新增**：

- 支持调试 uv 项目中的 Python，不需要微软的 Python 扩展：在 `.py` 文件中按 F5，或使用 _Python (uv)_ 的 `launch.json` 模板（[指南](https://github.com/HeavenSky/editor-lang-toolkit/blob/HEAD/zh/docs/python-debugging.md#调试当前文件)）。

**变更**：

- YAML 与 TOML 语言服务器改为在打开第一个 YAML 或 TOML 文件时才启动，不再随扩展激活启动；打开 ANSI 文件或开始 Python 调试不会再拉起它们。

## v0.0.2 2026-10-12 ANSI 与 TOML 修复

**修复**：

- ANSI：SGR 21 现在显示为双下划线，与 xterm 和 VS Code 终端一致，不再是关闭粗体。冒号写法 `4:n` 也能识别（`4:2` 为双下划线，`4:0` 为关闭，其余样式画成单下划线）；其他冒号子参数作为转义序列隐藏，不再显示成文字。
- ANSI：文档用到超过 512 种样式组合时，淘汰旧装饰类型可能把仍在屏幕上的类型也释放掉，颜色会悄无声息地消失。现在任一可见编辑器在用的类型都不会被淘汰；上限改为软上限。
- TOML 语法更新：扩展升级后，内置语法替换了已更新的语法，但保存的 ETag 一直换来 `304 Not Modified`，于是再也下载不到更新。现在只有磁盘上的语法与保存 ETag 时的内容一致，才会发送 ETag。
- ANSI：现在会显示下划线颜色（SGR `58;5;n`、`58;2;r;g;b` 以及冒号写法 `58:5:n`、`58:2::r:g:b`），`59` 将其复位。此前 `58` 把颜色参数留在原处，所以 `4;58;2;255;0;0` 丢了下划线（末尾的 `0` 复位了全部样式），`58;5;n` 则打开了闪烁。
- ANSI：下划线或双下划线与删除线同时使用时，不再丢失全部文字装饰；原因是拼出的 CSS 值顺序不被浏览器接受。
- TOML：诊断的来源现在写作 `TOML`，与 YAML 诊断的来源 `YAML` 一致，不再是上游扩展名 `Even Better TOML`。
- 打包：上游已删除的 yaml-language-server 过期语言包，不再残留在 `l10n/yaml-language-server/` 里并随扩展发布。

**其他**：

- 文档：README 现在为每个功能配了一张截图。图片在查看页面时从 GitHub 加载，不打包进扩展。

## v0.0.1 2026-08-07

首个版本。

**YAML**（内置 [yaml-language-server](https://github.com/redhat-developer/yaml-language-server) 1.24.0）：

- JSON Schema 校验（draft-04 / 07 / 2019-09 / 2020-12）、未使用锚点检测、流式风格规则、映射键顺序
- schema 查找：modeline、文件内的 `$schema` 属性、`yaml.schemas` 设置，以及 SchemaStore 目录
- 补全、悬停提示、文档符号、折叠、锚点跳转到定义、重命名、文档链接、选区范围、代码操作、CodeLens
- 格式化与输入时格式化

**TOML**（内置 [Taplo](https://github.com/tamasfe/taplo) 0.7.0 的 WebAssembly 版本）：

- 语法高亮（上游的 TextMate 语法）与语义标记
- JSON Schema 校验、补全、悬停提示、文档符号、折叠、重命名、文档链接、格式化
- 通过 `.taplo.toml`（与命令行读取的是同一个文件）或 `langToolkit.taplo` 设置配置

**ANSI**（解析器移植自 [vscode-ansi](https://github.com/iliazeus/vscode-ansi)）：

- 完整支持 SGR：16 色及其高亮色、256 色（`38;5;n`）、真彩色（`38;2;r;g;b`），以及粗体、暗淡、斜体、下划线、双下划线、删除线、上划线、反色和隐藏
- 颜色对应主题的 `terminal.ansi*` 调色板，不需要另外同步任何设置
- 非 SGR 的 CSI 序列（光标移动、清行）会被识别并调暗显示，不会渲染成乱码
- 预览是虚拟文档而不是 webview，搜索、选择、复制和并排滚动都是编辑器原生行为
- 比上游多两点：输入时 300 ms 防抖，以及装饰类型 512 个的 LRU 上限，真彩色输出不会无限占用宿主资源

**其他**：

- 两个语言服务器都已内置，扩展**不依赖任何外部命令行工具**。`scripts/check-extra.mjs` 把这一承诺做成发布前门禁，同时检查源码与清单。
- 每周在后台检查一次 TOML 语法更新。下载内容必须能解析为 JSON 并声明 `source.toml` scope，才会以原子方式写入；更新在重载窗口后生效。可用 `langToolkit.toml.grammarUpdate.enabled` 关闭。
- 图标由三部分组成，每部分对应一种支持的语言的特征：内含色块的 `[ ]` 是 TOML 的 `[table]`，缩进的行是键值结构，带 `>` 提示符的多彩行是带 ANSI 着色的终端输出。前景有意不用单色：着色正是这个扩展做的事，所以图标每行用多种颜色来表达。
- 界面提供 English 与简体中文，跟随 VS Code 的显示语言。
- 没有遥测。
- 构建时把 Taplo 的 WebAssembly 从上游内联的 base64 中提取成独立的 `out/taplo.wasm`，压缩后的体积从约 9.9 MB 降到 6.6 MB。
