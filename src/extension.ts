/**
 * 扩展入口, 同时也是两个语言服务器进程的入口。
 *
 * 同一个 bundle 会被 fork 出来当服务器用 (原因见 `features/servers.ts`), 因此这里必须先按
 * `process.argv` 分流, 且**不能在模块顶层 import `vscode`** —— 服务器进程里没有那个模块。
 * 所以顶层只留一个 `import type` (编译后被擦除), 真正用到宿主 API 的代码全部走动态 import,
 * 由 esbuild 编译成惰性 require。
 */
import type * as vscode from 'vscode';

import { TOML_SERVER_FLAG, YAML_SERVER_FLAG } from './features/serverFlags';

const serverFlag = process.argv.find(
  (argument) => argument === YAML_SERVER_FLAG || argument === TOML_SERVER_FLAG,
);

if (serverFlag) {
  const started =
    serverFlag === YAML_SERVER_FLAG
      ? import('./servers/yaml').then((module) => module.run())
      : import('./servers/toml').then((module) => module.run());

  started.catch((error: unknown) => {
    // 服务器进程没有输出通道可用, 只能写 stderr; 父进程会把它转到扩展的输出面板。
    process.stderr.write(`failed to start the language server: ${String(error)}\n`);
    process.exit(1);
  });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const { activateExtension } = await import('./features/activation');
  await activateExtension(context);
}

export async function deactivate(): Promise<void> {
  const { stopServers } = await import('./features/servers');
  await stopServers();
}
