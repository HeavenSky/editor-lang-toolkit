# Changelog

## [0.0.1] - 2026-08-07

首个版本.

**YAML** — 内置 [yaml-language-server](https://github.com/redhat-developer/yaml-language-server) 1.24.0:

- JSON Schema 校验 (draft-04 / 07 / 2019-09 / 2020-12), 未使用锚点检测, flow 风格规则, 映射键顺序
- Schema 发现: modeline, 文档内 `$schema`, `yaml.schemas` 设置, SchemaStore 目录
- 补全, 悬停提示, 文档符号, 折叠, 锚点跳转定义, 重命名, 文档链接, 智能选区, 快速修复, CodeLens
- 格式化与输入时格式化

**TOML** — 内置 [Taplo](https://github.com/tamasfe/taplo) 0.7.0 的 WebAssembly 构建:

- 语法高亮 (TextMate 语法来自上游) 与语义 token
- JSON Schema 校验, 补全, 悬停提示, 文档符号, 折叠, 重命名, 文档链接, 格式化
- 配置沿用 `.taplo.toml`, 或写在 `langToolkit.taplo` 设置里

**ANSI** — 移植自 [vscode-ansi](https://github.com/iliazeus/vscode-ansi) 的解析器:

- 完整 SGR: 16 色与亮色, 256 色 (`38;5;n`), 真彩色 (`38;2;r;g;b`), 以及粗体, 弱化, 斜体,
  下划线, 双下划线, 删除线, 上划线, 反色, 隐藏
- 颜色映射到 `terminal.ansi*` 主题色, 零配置项
- 非 SGR 的 CSI 序列 (光标移动, 清行) 被识别并淡化, 而不是渲染成乱码
- 预览为虚拟文档而非 webview, 因此搜索, 选择, 复制与并排滚动都是编辑器原生能力
- 相对上游补了两处: 连续输入时 300 ms 去抖; 装饰类型用 LRU 封顶 512 个, 避免真彩色场景下
  无界创建宿主资源

**其他**:

- 两个语言服务器都打包在扩展内, **不依赖任何外部 CLI 工具**; `scripts/check-extra.mjs`
  把这条约束固化成发布前门禁
- TOML 语法文件每周在后台检查更新: 内容需通过 JSON 解析与 `source.toml` scope 校验才会
  原子写入, 更新在窗口重载后生效; 可用 `langToolkit.toml.grammarUpdate.enabled` 关闭
- 界面支持英语与简体中文
- 无遥测
- Taplo 的 WebAssembly 在构建时从上游的 base64 内联形态拆成独立 `out/taplo.wasm`,
  压缩后体积从约 9.9 MB 降到约 6.6 MB
