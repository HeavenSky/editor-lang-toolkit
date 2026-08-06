/**
 * YAML 语言服务器进程的入口。
 *
 * `yaml-language-server` 的 `server.js` 在被加载时就自己建立连接并注册全部 handler ——
 * 它按 `process.argv` 选择传输方式 (`--node-ipc` 由 vscode-languageclient 注入), 因此这里
 * 只需要把它 import 进来, 不需要任何胶水。
 *
 * 用**动态** import 是刻意的: esbuild 打出的 CJS bundle 里, 动态 import 会编译成惰性的
 * `require`, 只有真正走到这里才会执行整个 server 的顶层代码。扩展宿主加载同一个 bundle 时
 * 不会碰它, 也就不会白白付出 1.3 MB 代码的解析与执行成本。
 */
export async function run(): Promise<void> {
  await import('yaml-language-server/out/server/src/server.js');
}
