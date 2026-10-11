/**
 * 构建前把两个捆绑的语言服务器整理成可打包的形态。
 *
 * 全部产物都从 `node_modules` 派生, 落在已被忽略的目录里 (`vendor/`, `out/`, `l10n/<来源>/`),
 * 每次构建重新生成 —— 生成物入库会与真源悄悄漂移。
 *
 * 三件事, 都是"不做就跑不起来"而不是优化:
 *
 * 1. **拆出 taplo 的 wasm。** 上游把 25 MB 的 wasm 以 base64 内联在一个 34 MB 的 JS 里。
 *    base64 的 4/3 膨胀 gzip 压不回原始二进制的密度, 实测 9.89 MB 对 6.59 MB, 拆出来省三成。
 * 2. **捆绑 yaml-language-server 的语言包。** 它在 initialize 里无条件加载 l10n bundle, 读不到
 *    就让整个 initialize 失败 —— 而默认路径是相对源码目录算的, bundle 之后必然失效。
 * 3. **修正 jsonc-parser 的入口。** 它的 `main` 指向 UMD 产物, 其 factory 用间接 require 取
 *    `./impl/format`, esbuild 无法静态解析, 打进 bundle 后运行时报 Cannot find module。
 *    同包的 `module` 字段指向等价的 ESM 产物, 改用它即可。
 *
 * **所有断言都是硬失败**: 上游一旦改了打包方式, 这里必须立刻炸掉, 而不是产出一个能构建
 * 但运行时才崩的 bundle。
 *
 * 用法: node scripts/prepare-vendor.mjs
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MODULES = join(ROOT, 'node_modules');
const VENDOR_DIR = join(ROOT, 'vendor');
const OUT_DIR = join(ROOT, 'out');

const fail = (message) => {
  console.error(`prepare-vendor: ${message}`);
  process.exit(1);
};

const readIfPresent = (path, encoding) => {
  try {
    return readFileSync(path, encoding);
  } catch {
    return undefined;
  }
};

mkdirSync(VENDOR_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// ── 1. taplo: 内联 base64 → 独立 wasm ───────────────────────
const TAPLO_SOURCE = join(MODULES, '@taplo/lsp/dist/index.js');
const TAPLO_MARKER = 'const P=SA("';
const WASM_MAGIC = '0061736d';
const WASM_NAME = 'taplo.wasm';

const taploSource = readIfPresent(TAPLO_SOURCE, 'latin1');
if (taploSource === undefined) fail(`读不到 ${TAPLO_SOURCE}; 先执行 npm install`);

const markerAt = taploSource.indexOf(TAPLO_MARKER);
if (markerAt < 0) {
  fail(`未找到 @taplo/lsp 的内联 wasm 声明 (${TAPLO_MARKER}); 上游打包方式可能已变更, 需要重新适配`);
}
const base64Start = markerAt + TAPLO_MARKER.length;
const base64End = taploSource.indexOf('")', base64Start);
if (base64End < 0) fail('@taplo/lsp 的内联 wasm 字符串没有结束标记');
if (taploSource.indexOf(TAPLO_MARKER, base64Start) >= 0) {
  fail(`找到多处 ${TAPLO_MARKER}; 无法确定哪一处是 wasm, 需要重新适配`);
}

const wasm = Buffer.from(taploSource.slice(base64Start, base64End), 'base64');
const magic = wasm.subarray(0, 4).toString('hex');
if (magic !== WASM_MAGIC) {
  fail(`@taplo/lsp 解码结果不是 WebAssembly 模块 (魔数 ${magic}, 期望 ${WASM_MAGIC})`);
}

// 加载函数 `b(I)` 本来就接受 Uint8Array (base64 解码结果正是 Uint8Array), 因此把常量换成
// 读文件不改变任何调用路径。`__dirname` 在 bundle 后是 `out/`, 与 wasm 同目录。
const patchedGlue =
  taploSource.slice(0, markerAt) +
  `const P=require("node:fs").readFileSync(require("node:path").join(__dirname,${JSON.stringify(WASM_NAME)}));` +
  taploSource.slice(base64End + 2);

writeFileSync(join(OUT_DIR, WASM_NAME), wasm);
writeFileSync(join(VENDOR_DIR, 'taplo-lsp.cjs'), patchedGlue, 'latin1');

// 类型与胶水一起生成, 避免两处真源。只声明本扩展真正用到的接口 —— 上游还导出了
// format / lint / run_cli 等 CLI 侧能力, 本扩展不使用, 也就不在这里承诺。
writeFileSync(
  join(VENDOR_DIR, 'taplo-lsp.d.cts'),
  `// 由 scripts/prepare-vendor.mjs 生成, 不要手改。
export interface TaploRpcMessage {
  jsonrpc: '2.0';
  method?: string;
  id?: string | number;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

export interface TaploLspInterface {
  onMessage: (message: TaploRpcMessage) => void;
}

export declare class TaploLsp {
  static initialize(env: unknown, lspInterface: TaploLspInterface): Promise<TaploLsp>;
  send(message: TaploRpcMessage): void;
  dispose(): void;
}
`,
  'utf8',
);

// ── 2. yaml-language-server: 捆绑语言包 ─────────────────────
const YAML_L10N_SOURCE = join(MODULES, 'yaml-language-server/l10n');
const YAML_L10N_TARGET = join(ROOT, 'l10n/yaml-language-server');

let bundles;
try {
  bundles = readdirSync(YAML_L10N_SOURCE).filter((name) => /^bundle\.l10n\..*json$/.test(name));
} catch {
  fail(`读不到 ${YAML_L10N_SOURCE}; yaml-language-server 的目录结构可能已变更`);
}
// `bundle.l10n.json` 是所有 locale 的兜底, 缺了它任何非内置语言都会让 initialize 失败。
if (!bundles.includes('bundle.l10n.json')) {
  fail('yaml-language-server 的 l10n 里没有 bundle.l10n.json; 需要重新适配');
}
// 先清空再复制: 上游删掉的 bundle 若留在目标目录, 会被静默打进包里。
rmSync(YAML_L10N_TARGET, { recursive: true, force: true });
mkdirSync(YAML_L10N_TARGET, { recursive: true });
for (const name of bundles) {
  copyFileSync(join(YAML_L10N_SOURCE, name), join(YAML_L10N_TARGET, name));
}

// ── 3. jsonc-parser: UMD → ESM 入口 ────────────────────────
const JSONC_DIR = join(MODULES, 'jsonc-parser');
const JSONC_MANIFEST = join(JSONC_DIR, 'package.json');
const jsoncRaw = readIfPresent(JSONC_MANIFEST, 'utf8');
if (jsoncRaw === undefined) fail(`读不到 ${JSONC_MANIFEST}; 先执行 npm install`);

const jsonc = JSON.parse(jsoncRaw);
if (typeof jsonc.module !== 'string' || !jsonc.module.includes('esm')) {
  fail(`jsonc-parser 没有可用的 ESM 入口 (module=${String(jsonc.module)}); 需要重新适配`);
}

/** 递归收集目录下的 .js。 */
function collectJs(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectJs(path));
    else if (entry.name.endsWith('.js')) found.push(path);
  }
  return found;
}

// ESM 产物里的相对 import 没有扩展名 —— 那是给打包器用的写法, Node 原生 ESM 解析不了。
// 只切换入口会连累以 Node 方式加载它的其它工具 (vsce 就是一个), 所以先把扩展名补齐,
// 让这份产物对打包器和 Node 都合法, 再切入口。
const ESM_DIR = join(JSONC_DIR, jsonc.module.replace(/^\.\//, '').split('/').slice(0, -1).join('/'));
const RELATIVE_IMPORT = /(\bfrom\s+|\bimport\s+)(['"])(\.\.?\/[^'"]*?)\2/g;
let patchedImports = 0;
for (const file of collectJs(ESM_DIR)) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(RELATIVE_IMPORT, (match, keyword, quote, target) =>
    /\.[cm]?js$/.test(target) ? match : `${keyword}${quote}${target}.js${quote}`,
  );
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    patchedImports += 1;
  }
  // 补完还有裸相对路径, 说明出现了本正则覆盖不到的写法 (例如 `import('./x')`)。
  const leftover = [...after.matchAll(RELATIVE_IMPORT)].filter(([, , , target]) => !/\.[cm]?js$/.test(target));
  if (leftover.length > 0) {
    fail(`${file} 仍有无扩展名的相对 import: ${leftover.map(([, , , t]) => t).join(', ')}`);
  }
}

let jsoncNote = 'already ESM';
if (jsonc.main !== jsonc.module) {
  jsonc.main = jsonc.module;
  writeFileSync(JSONC_MANIFEST, `${JSON.stringify(jsonc, null, 2)}\n`, 'utf8');
  jsoncNote = `main -> ${jsonc.module}`;
}
if (patchedImports > 0) jsoncNote += ` (${patchedImports} files got explicit extensions)`;

const mb = (path) => (statSync(path).size / 1048576).toFixed(2);
const kb = (path) => (statSync(path).size / 1024).toFixed(1);
console.log(
  [
    `prepare-vendor:`,
    `  out/${WASM_NAME}            ${mb(join(OUT_DIR, WASM_NAME))} MB`,
    `  vendor/taplo-lsp.cjs        ${kb(join(VENDOR_DIR, 'taplo-lsp.cjs'))} KB`,
    `  l10n/yaml-language-server/  ${bundles.length} bundles`,
    `  jsonc-parser                ${jsoncNote}`,
  ].join('\n'),
);
