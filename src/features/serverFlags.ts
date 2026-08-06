/**
 * 语言服务器进程的分流开关。
 *
 * 单独成一个模块是必需的, 不是洁癖: `extension.ts` 在**顶层**就要读这两个常量来决定走扩展
 * 分支还是服务器分支, 而服务器进程里没有 `vscode` 模块 —— 如果常量放在 `servers.ts` 里,
 * 顶层的静态 import 会连带把 `vscode` 拉进来, 服务器一启动就崩。所以这个模块必须保持零依赖。
 */
export const YAML_SERVER_FLAG = '--yaml-server';
export const TOML_SERVER_FLAG = '--toml-server';
