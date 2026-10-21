# 控制网络访问

[English](../../docs/network.md) · **简体中文**

本页列出扩展可能发起的全部网络请求及各自的关闭方法，适用于离线机器或网络受限的环境。**扩展不发送遥测，也不上传你本人或你文件的任何信息。**

## 会访问网络的请求

| 请求                                       | 时机                                 | 避免方法                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 文件引用的 JSON Schema 与 SchemaStore 目录 | 编辑用到它们的 YAML 或 TOML 文件时   | 改用本地 schema 路径。关闭目录：YAML 设 `yaml.schemaStore.enable: false`，TOML 设 `"langToolkit.taplo": { "schema": { "catalogs": [] } }`；或用 `langToolkit.yaml.enabled` / `langToolkit.toml.enabled` 关闭服务器 |
| 上游的 TOML TextMate 语法                  | 后台检查，每周至多一次               | 把 `langToolkit.toml.grammarUpdate.enabled` 设为 `false`                                                                                                                                                           |
| uv 从 PyPI 拉取的 `debugpy`                | 第一次调试 Python 时，之后由 uv 缓存 | 不启动 Python 调试，或在联网时运行一次 `uv run --with debugpy python -c "import debugpy"`，让 uv 缓存下来                                                                                                          |

## 语法下载如何校验

下载的语法必须能解析为 JSON、声明 `source.toml` scope 并含有语法规则，否则丢弃。内容先写入临时文件再重命名到位，下载失败或不完整都不会弄坏 TOML 高亮。检查失败后要等一周才重试，不会每次启动都请求。

把 `langToolkit.toml.grammarUpdate.url` 指向镜像时同样经过这些校验。扩展目录只读时（部分企业管控或远程环境），更新会失败，继续使用内置语法。
