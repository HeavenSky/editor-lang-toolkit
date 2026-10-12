/**
 * 改写 taplo 诊断的来源 —— 纯逻辑, 不 import vscode, 由 vitest 直接覆盖。
 *
 * taplo 把 `Diagnostic.source` 写死成上游扩展的显示名 `Even Better TOML` (证据:
 * `crates/taplo-lsp/src/diagnostics.rs`, 语法, 语义与 schema 三类诊断共用), 悬停卡片里会让人
 * 以为报错来自另一个扩展。改成 `TOML` 与 YAML 侧对齐: yaml-language-server 的语法诊断来源是
 * `YAML`, schema 诊断是 `yaml-schema: <url>`, 都按语言而非扩展命名。
 *
 * 只替换精确等于上游名字的来源, 其余原样保留, 以免日后 taplo 换了命名时误伤。
 */
export const TAPLO_UPSTREAM_SOURCE = 'Even Better TOML';
export const TOML_SOURCE = 'TOML';

/** 就地改写并返回同一数组, 方便直接交给中间件的 `next`。 */
export function rewriteTaploSource<T extends { source?: string }>(diagnostics: T[]): T[] {
  for (const diagnostic of diagnostics) {
    if (diagnostic.source === TAPLO_UPSTREAM_SOURCE) diagnostic.source = TOML_SOURCE;
  }
  return diagnostics;
}
