# Editor Lang Toolkit

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/HeavenSky.editor-lang-toolkit?label=marketplace)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/HeavenSky.editor-lang-toolkit)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.txt)

[English](./README.md) · **简体中文**

> 市场页只渲染英文版 README, 不随访问者的显示语言切换; 插件界面本身是双语的.

**YAML**, **TOML** 与 **ANSI 着色文本**的语言支持 —— schema 校验, 补全, 悬停提示, 格式化,
导航, 以及终端颜色.

两个语言服务器都已打包在内. 不需要安装任何 CLI 工具, 不需要配置工具链, 也没有遥测.

---

## 为什么需要它

VS Code 内置了完整的 JSON 语言服务. 对 YAML 只提供了 TextMate 语法. 对 TOML 则什么都没有.

|                    | JSON | YAML     | TOML     |
| ------------------ | ---- | -------- | -------- |
| 内置语法高亮       | 有   | 有       | **无**   |
| 内置语言服务       | 有   | **无**   | **无**   |
| 本扩展提供         | —    | **有**   | **有**   |

多数填补这些空缺的扩展都要求先装一个二进制 —— `taplo`, `buf`, 某个格式化器, 某个 linter.
对**工具**类扩展来说这很合理, 对**语言**类扩展则不然: 打开一个配置文件, 就该直接可用.

---

## 功能

### YAML

基于内置的 [yaml-language-server](https://github.com/redhat-developer/yaml-language-server).

**校验**

- JSON Schema, draft-04 / 07 / 2019-09 / 2020-12
- 未使用的锚点检测
- flow 风格规则 (`yaml.style.flowMapping`, `yaml.style.flowSequence`)
- 映射键顺序 (`yaml.keyOrdering`)
- Kubernetes CRD schema

**Schema 发现** —— 四种途径, 按优先级:

1. modeline: `# yaml-language-server: $schema=<url>`
2. 文档内的 `$schema` 属性
3. `yaml.schemas` 设置
4. [SchemaStore](https://www.schemastore.org/) 目录, 按文件名自动匹配

**编辑** —— 补全, 悬停提示, 文档符号, 折叠, 锚点跳转定义, 重命名, 文档链接, 智能选区,
快速修复, CodeLens, 格式化与输入时格式化.

### TOML

基于内置的 [Taplo](https://github.com/tamasfe/taplo) WebAssembly 构建.

- 语法高亮与语义 token
- JSON Schema 校验, 关联可来自 `.taplo.toml` 或设置
- 补全, 悬停提示, 文档符号, 折叠, 重命名, 文档链接
- 格式化, 可通过 `.taplo.toml` 或 `langToolkit.taplo` 设置调整

工作区里的 `.taplo.toml` 会被自动读取 —— 与 `taplo` CLI 是同一份文件, 因此编辑器与 CI
天然一致, 不需要维护两份配置.

### ANSI

抓取下来的终端输出会按其真实颜色渲染, 而不是显示成一堆转义码.

- **完整的 SGR 覆盖** —— 16 色及其亮色变体, 256 色 (`38;5;n`) 与**真彩色**
  (`38;2;r;g;b`); 粗体, 弱化, 斜体, 下划线, 双下划线, 删除线, 上划线, 反色与隐藏
- **颜色跟随主题** —— 映射到 VS Code 的 `terminal.ansi*` 调色板, 无需任何配置, 也不必
  跟着配色方案手动同步
- **控制序列被正确识别而不是渲染成乱码** —— 光标移动与清行会被淡化处理. 这比听起来重要:
  进度条, spinner 与 `docker build` 的输出几乎全由它们构成
- **预览打开的是真正的编辑器**, 不是 webview —— 搜索, 选择, 复制与并排滚动都照常可用,
  因为它本来就是编辑器

着色作用于 `ansi` 语言 (`.ans`, `.ansi`). 要覆盖其他文件:

```jsonc
{ "files.associations": { "*.log": "ansi" } }
```

代价是失去内置 `log` 语法的时间戳着色. 当文件里确实含转义码时这是划算的 —— 那种情况下
内置语法本来也只会把它们渲染成噪声.

---

## 环境要求

无. 两个语言服务器都已打包在内.

---

## 命令

全部命令位于命令面板的 **Lang Toolkit** 分类下.

| 命令 | 说明 |
| --- | --- |
| `重启语言服务器` | 重启两个服务器, 不需要重载窗口 |
| `检查 TOML 语法更新` | 立刻检查一次, 不等每周的自动检查 |
| `打开 ANSI 预览` | 以剥离转义序列后的形态打开当前文件 |
| `在侧边打开 ANSI 预览` | 同上, 并排显示 |

---

## 设置

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `langToolkit.yaml.enabled` | `true` | 启用 YAML 语言服务器. 语法高亮不受影响. |
| `langToolkit.toml.enabled` | `true` | 启用 TOML 语言服务器. 语法高亮不受影响. |
| `langToolkit.taplo` | `{}` | 传给 Taplo 的设置, 键名 camelCase. 见 [Taplo 配置文档](https://taplo.tamasfe.dev/configuration/file.html). |
| `langToolkit.toml.grammarUpdate.enabled` | `true` | 每周在后台检查 TOML 语法是否有新版. |
| `langToolkit.toml.grammarUpdate.url` | 上游语法地址 | 语法文件的来源. |

YAML 的 schema 关联沿用标准的 `yaml.schemas` 与 `yaml.schemaStore.*` —— 这些键由
`yaml-language-server` 直接读取, 已有配置无需改动.

ANSI 着色**没有任何设置项**, 颜色来自你的主题.

---

## 网络访问

有两处会访问网络. 两者都可关闭, 且都不会发送与你有关的任何信息.

| 内容 | 时机 | 关闭方式 |
| --- | --- | --- |
| 文件中引用的 JSON Schema, 以及 SchemaStore 目录 | 编辑时按需 | `langToolkit.yaml.enabled` / `langToolkit.toml.enabled` |
| 上游的 TOML TextMate 语法 | 每周一次, 后台进行 | `langToolkit.toml.grammarUpdate.enabled` |

下载的语法内容必须能解析为 JSON 且声明了 `source.toml` scope 才会被接受, 并且采用原子写入 ——
一次坏的响应不可能破坏内置语法.

**不含任何遥测.**

---

## 体积

内置两个语言服务器是有代价的:

| 组成 | 体积 |
| --- | --- |
| `out/extension.js` —— 客户端, YAML 服务器, Taplo 胶水 | 约 1.7 MB |
| `out/taplo.wasm` | 约 25 MB (压缩后约 6.6 MB) |

Taplo 上游把 WebAssembly 以 base64 内联在一个 34 MB 的 JavaScript 文件里. 本扩展在构建时把它
拆成独立的 `.wasm`, 下载体积因此少掉约三分之一 —— base64 的 4/3 膨胀, gzip 压不回原始二进制
的密度.

不打开对应类型的文件时, 两个服务器都不会启动.

---

## 已知限制

- **TOML 语法更新需要重载窗口后生效.** `contributes.grammars` 是在扩展加载时读取的, 新下载
  的语法无法在当前窗口即时生效. 这是 VS Code 的机制, 扩展绕不过去.
- **ANSI 着色绑定在 `ansi` 语言 id 上.** 用 `files.associations` 可以扩展到其他文件; 没有
  提供基于正则的开关, 因为那需要让扩展在每次窗口启动时都激活.
- **真彩色输出会创建较多装饰类型.** 上限为 512 个并按最久未使用逐出, 因此色彩密集的日志会
  复用而不是无限累积.
- **YAML 的格式化就是 Prettier.** `yaml.format.*` 是透传给 Prettier 的选项. 如果你的 CI 里
  已经在跑 Prettier, 两边的结果天然一致.

---

## 致谢

本扩展建立在三个上游项目之上, 均为 MIT 许可:

- [yaml-language-server](https://github.com/redhat-developer/yaml-language-server) — Red Hat
- [Taplo](https://github.com/tamasfe/taplo) — Ferenc Tamás
- [vscode-ansi](https://github.com/iliazeus/vscode-ansi) — Ilia Pozdnyakov, 本扩展使用了其
  ANSI 解析器

完整的归属声明见 [NOTICE.md](./NOTICE.md).

## 许可

MIT, 见 [LICENSE.txt](./LICENSE.txt).
