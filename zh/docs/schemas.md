# 为 YAML 与 TOML 指定 schema

[English](../../docs/schemas.md) · **简体中文**

读完本页就能给 YAML 和 TOML 文件关联 JSON Schema，并调整校验与格式化；前提只是装好本扩展。第一次使用请先看[快速开始](../README.md#快速开始)。

## 语言服务器何时启动

YAML 与 TOML 语言服务器在第一次打开对应语言的文件时才启动，只打开 ANSI 文件或调试 Python 不会拉起它们。两个服务器都打包在内，各自运行在独立进程里。

- TOML 覆盖 `*.toml`、`Cargo.lock` 与 `uv.lock`。
- 问题面板里的诊断来源显示为 `YAML` 或 `TOML`。
- `langToolkit.yaml.enabled` 与 `langToolkit.toml.enabled` 用来关闭对应服务器；改动后服务器自动重启，语法高亮不受影响。
- **Lang Toolkit: 重启语言服务器**（英文界面：Restart Language Servers）不重载窗口就能重启两个服务器。

## 为 YAML 文件指定 schema

YAML 文件按以下顺序匹配 schema，先匹配到的生效：

1. 第一行的 modeline：`# yaml-language-server: $schema=<URL 或相对路径>`
2. 文档内的 `$schema` 属性
3. `yaml.schemas` 设置
4. [SchemaStore](https://www.schemastore.org/) 目录，按文件名匹配

YAML 服务器是 [yaml-language-server](https://github.com/redhat-developer/yaml-language-server)，直接读取标准的 `yaml.*` 设置，已有的 `yaml.schemas` 或 `yaml.schemaStore.*` 配置原样可用：

```jsonc
{ "yaml.schemas": { "./schemas/service.schema.json": "deploy/*.yaml" } }
```

校验支持 JSON Schema draft 04、07、2019-09 与 2020-12，包括 Kubernetes CRD schema。此外还会报告未使用的锚点，并可约束 flow 风格（`yaml.style.flowMapping`、`yaml.style.flowSequence`）与映射键顺序（`yaml.keyOrdering`）。

## 格式化 YAML

YAML 格式化由 Prettier 完成，`yaml.format.*` 设置会原样作为 Prettier 选项传入。CI 里已经在跑 Prettier 的话，编辑器与 CI 的输出一致。

## 用 .taplo.toml 配置 TOML

TOML 服务器是 [Taplo](https://github.com/tamasfe/taplo) 的 WebAssembly 构建。它沿目录树向上查找 `.taplo.toml`（其次是 `taplo.toml`），与 `taplo` 命令行读的是同一份文件，schema 关联和格式化选项都从这里取。文件格式见 [Taplo 配置文档](https://taplo.tamasfe.dev/configuration/file.html)。

没有配置文件时，把同样的选项写进 `langToolkit.taplo` 设置，键名用 camelCase；`.taplo.toml` 里定义的规则优先。Taplo 默认按 SchemaStore 目录匹配 TOML 文件；下例把目录显式写出来，并设置两个格式化选项：

```jsonc
{
	"langToolkit.taplo": {
		"schema": {
			"enabled": true,
			"catalogs": ["https://www.schemastore.org/api/json/catalog.json"],
		},
		"formatter": { "alignEntries": false, "indentTables": false },
	},
}
```

## 保持 TOML 语法为最新

TOML 语法高亮使用 Taplo 的 TextMate 语法。扩展每周在后台检查一次新版；**下载的新语法要重载窗口后才生效**。运行 **Lang Toolkit: 检查 TOML 语法更新**（英文界面：Check for TOML Grammar Updates）可以立即检查，用 `langToolkit.toml.grammarUpdate.enabled` 关闭自动检查。`langToolkit.toml.grammarUpdate.url` 指定下载地址；下载内容如何校验见[控制网络访问](network.md)。
