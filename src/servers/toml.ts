/**
 * TOML 语言服务器进程的入口。
 *
 * taplo 的 WebAssembly 构建不是一个 stdio 服务器, 而是一个消息式对象: 用 `send()` 投递
 * 请求, 用 `onMessage` 回调收响应。这里把它接到 Node IPC 上 —— 父进程 (vscode-languageclient
 * 的 ipc 传输) 用 `process.send` / `process.on('message')` 收发, 与 stdio 完全隔离,
 * 因此 taplo 往 stderr 写的 tracing 日志不会污染协议流。
 *
 * WASM 的加载是惰性的: 动态 import 让 esbuild 把这段编译成惰性 require, 扩展宿主加载同一个
 * bundle 时不会实例化那 25 MB 的模块。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { accessSync, globSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import type { TaploRpcMessage } from '../../vendor/taplo-lsp.cjs';

/** taplo 会沿目录树向上找这两个文件名; 顺序即优先级。 */
const CONFIG_FILE_NAMES = ['.taplo.toml', 'taplo.toml'];

function findConfigFile(from: string): string | undefined {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = join(from, name);
    try {
      accessSync(candidate);
      return candidate;
    } catch {
      // 换下一个候选名。
    }
  }
  return undefined;
}

/**
 * `file://` URL 转本地路径。
 *
 * 不用 `url.fileURLToPath`: taplo 传进来的可能是已经过一次编码的 URL, 而 Windows 下需要去掉
 * 前导斜杠 —— 与 taplo 自己的 VS Code 客户端保持一致的处理方式。
 */
function urlToFilePath(url: string): string {
  const path = decodeURIComponent(url).slice('file://'.length);
  return process.platform === 'win32' && path.startsWith('/') ? path.slice(1) : path;
}

export async function run(): Promise<void> {
  const { TaploLsp } = await import('../../vendor/taplo-lsp.cjs');

  const environment = {
    cwd: () => process.cwd(),
    envVar: (name: string) => process.env[name],
    envVars: () => Object.entries(process.env),
    findConfigFile,
    glob: (pattern: string) => globSync(pattern),
    isAbsolute,
    now: () => new Date(),
    readFile: (path: string) => readFile(path),
    writeFile: (path: string, content: Uint8Array) => writeFile(path, content),
    stderr: process.stderr,
    stdErrAtty: () => process.stderr.isTTY === true,
    stdin: process.stdin,
    stdout: process.stdout,
    urlToFilePath,
    fetch: {
      fetch: globalThis.fetch,
      Headers: globalThis.Headers,
      Request: globalThis.Request,
      Response: globalThis.Response,
    },
  };

  const lsp = await TaploLsp.initialize(environment, {
    onMessage: (message: TaploRpcMessage) => {
      process.send?.(message);
    },
  });

  process.on('message', (message: TaploRpcMessage) => {
    if (message.method === 'exit') {
      lsp.dispose();
      process.exit(0);
    }
    lsp.send(message);
  });

  // wasm-bindgen 把 Rust 的 panic 转成被拒绝的 Promise; 不重新抛出就会被静默吞掉,
  // 服务器看起来"还活着"但已经不再响应。
  process.on('unhandledRejection', (reason) => {
    throw reason;
  });
}
