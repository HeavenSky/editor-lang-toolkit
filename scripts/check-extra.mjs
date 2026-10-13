/**
 * 本插件专属的发布前门禁。
 *
 * 把两条产品承诺钉死, 而不是靠 review 记得:
 *
 * 1. **自包含。** 不依赖用户机器上的任何外部二进制 —— 一旦有人往源码里加了 spawn 某个命令
 *    的代码, 或者往清单里加了配置服务器路径的设置, 这里立刻失败。语言插件跟工具插件不同,
 *    用户装上就该能用。Python 调试不在此列: 它面向已在用 uv 的项目, 复用用户自己的 uv,
 *    adapter 由宿主按调试配置启动, 扩展不 spawn; `uvPath` 是调试配置字段, 不是扩展设置。
 * 2. **构建产物齐全。** 两个语言服务器都是从依赖派生出来的, 派生步骤漏跑不会让构建失败,
 *    只会打出一个运行时才崩的包。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 递归收集 src 下的 .ts 文件。 */
function collectSources(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...collectSources(path));
    else if (name.endsWith('.ts')) found.push(path);
  }
  return found;
}

/** 会把扩展变成"需要先装点什么"的 API 与清单键。 */
const FORBIDDEN_APIS = [
  ['spawn(', '启动外部进程'],
  ['execFile(', '启动外部进程'],
  ['execSync(', '启动外部进程'],
  ["from 'which'", '在 PATH 里找外部二进制'],
];

const FORBIDDEN_SETTING_HINTS = ['serverPath', 'binaryPath', 'executablePath'];

export default function checks(root) {
  return {
    '不依赖外部二进制 (源码)': () => {
      const problems = [];
      for (const file of collectSources(join(root, 'src'))) {
        const source = readFileSync(file, 'utf8');
        for (const [needle, why] of FORBIDDEN_APIS) {
          if (source.includes(needle)) {
            problems.push(`${file.slice(root.length + 1)} 出现 ${needle} (${why}); 本插件必须自包含`);
          }
        }
      }
      return problems;
    },

    '不依赖外部二进制 (清单)': () => {
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      const keys = Object.keys(pkg.contributes?.configuration?.properties ?? {});
      return keys
        .filter((key) => FORBIDDEN_SETTING_HINTS.some((hint) => key.toLowerCase().includes(hint.toLowerCase())))
        .map((key) => `配置项 ${key} 指向外部二进制; 本插件必须自包含`);
    },

    '捆绑的语言服务器产物齐全': () => {
      const problems = [];
      const required = [
        ['out/taplo.wasm', 'npm run prepare:vendor 未执行或失败'],
        ['vendor/taplo-lsp.cjs', 'npm run prepare:vendor 未执行或失败'],
        ['l10n/yaml-language-server/bundle.l10n.json', 'yaml-language-server 的语言包未捆绑'],
        ['syntaxes/toml.tmLanguage.json', 'TOML 语法文件缺失'],
      ];
      for (const [path, hint] of required) {
        if (!existsSync(join(root, path))) problems.push(`缺少 ${path} (${hint})`);
      }
      return problems;
    },

    'TOML 语法的 scope 与清单一致': () => {
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      const declared = pkg.contributes?.grammars?.find((entry) => entry.language === 'toml')?.scopeName;
      const grammarPath = join(root, 'syntaxes/toml.tmLanguage.json');
      if (!existsSync(grammarPath)) return [];
      const actual = JSON.parse(readFileSync(grammarPath, 'utf8')).scopeName;
      // 后台更新会覆盖这个文件, 校验逻辑也依赖这个 scope 相等, 因此两边必须对齐。
      return declared === actual
        ? []
        : [`清单声明 scopeName=${String(declared)}, 语法文件里是 ${String(actual)}`];
    },

    '每个服务的语言都有 onLanguage 激活事件': () => {
      // 编辑器会提示这些事件"可以删除", 但删掉后只打开 .toml 或 .ans 文件时扩展不会激活, 诊断与着色都不出现。
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      const events = new Set(pkg.activationEvents ?? []);
      return ['yaml', 'toml', 'ansi']
        .filter((id) => !events.has(`onLanguage:${id}`))
        .map((id) => `activationEvents 缺少 onLanguage:${id}`);
    },
  };
}
