// 功能截图: 在独立的 VS Code 实例里演示各功能并截图, 启动与截图的公共部分见 scripts/lib/shoot-ext.mjs.
// 用法: node scripts/shoot.mjs [输出目录, 默认 artifacts/shots] [--readme] [场景名过滤...]
//   yaml-validation   YAML: 按 JSON Schema 校验, 悬停显示错误与字段说明
//   yaml-completion   YAML: 按 Schema 补全字段
//   toml-validation   TOML: 语法高亮与按 JSON Schema 校验, 悬停显示错误
//   ansi-preview      ANSI: 原文按终端颜色着色, 旁边是去掉转义序列的预览
// 演示用的 Schema 都在工作区本地, 并关闭 SchemaStore 与 TOML 语法更新, 截图过程不访问网络.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, gitInit } from './lib/shoot-ext.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Service',
  type: 'object',
  additionalProperties: false,
  required: ['name', 'image'],
  properties: {
    name: { type: 'string', description: 'Service name, shown in dashboards and logs.' },
    image: { type: 'string', description: 'Container image, including the tag.' },
    replicas: { type: 'integer', minimum: 1, description: 'Number of instances to run.' },
    logLevel: { enum: ['debug', 'info', 'warn', 'error'], description: 'Minimum level written to the log.' },
    ports: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 65535 }, description: 'Ports exposed by the container.' },
    env: { type: 'object', additionalProperties: { type: 'string' }, description: 'Environment variables passed to the container.' },
    healthCheck: {
      type: 'object',
      description: 'How the orchestrator decides the service is alive.',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'HTTP path that must return 2xx.' },
        intervalSeconds: { type: 'integer', minimum: 1, description: 'Seconds between two checks.' },
        timeoutSeconds: { type: 'integer', minimum: 1, description: 'Seconds before a check counts as failed.' },
      },
    },
    restartPolicy: { enum: ['always', 'on-failure', 'never'], description: 'What to do when the process exits.' },
  },
};

const SERVICE_YAML = `# yaml-language-server: $schema=./service.schema.json
name: checkout
image: registry.example.com/checkout:2.4.1
replicas: three
logLevel: verbose

ports:
  - 8080
  - 9090

env:
  REGION: eu-west-1
  CACHE_TTL: "300"

healthCheck:
  path: /healthz
  intervalSeconds: 10
  timeout: 3
`;

// 补全场景: 光标停在最后一行的空白处, 补全列表列出 Schema 里还没写的字段
const COMPLETION_YAML = `# yaml-language-server: $schema=./service.schema.json
name: search
image: registry.example.com/search:1.9.0
replicas: 2

`;

const SERVICE_TOML = `#:schema ./service.schema.json
name = "billing"
image = "registry.example.com/billing:3.0.2"
replicas = 0
logLevel = "info"
ports = [8080, 9090]

[env]
REGION = "us-east-1"
FEATURE_FLAGS = "invoices,refunds"

[healthCheck]
path = "/healthz"
intervalSeconds = 15
retries = 3
`;

// 一段模拟的构建与测试输出: 16 色, 256 色, 真彩色, 粗体/下划线/反色, 以及进度条用的清行与光标移动
const E = '\x1b[';
const ANSI_LOG = [
  `${E}1;36m▶ build${E}0m ${E}2mstarted at 14:02:11${E}0m`,
  `${E}32m✔${E}0m compiled ${E}1m42${E}0m modules ${E}2min 1.8s${E}0m`,
  `${E}33m⚠${E}0m ${E}4msrc/cart.ts:18${E}0m  unused variable ${E}1;33m'total'${E}0m`,
  `${E}2K${E}1G${E}36m[████████████░░░░░░░░]${E}0m 60%  bundling`,
  `${E}2K${E}1G${E}36m[████████████████████]${E}0m 100% bundled ${E}2m(312 kB)${E}0m`,
  '',
  `${E}1;35m▶ test${E}0m`,
  ` ${E}42;30m PASS ${E}0m src/cart.test.ts ${E}2m(12 tests)${E}0m`,
  ` ${E}42;30m PASS ${E}0m src/price.test.ts ${E}2m(8 tests)${E}0m`,
  ` ${E}41;97m FAIL ${E}0m src/checkout.test.ts`,
  `   ${E}31m✖ applies the discount once${E}0m`,
  `     expected ${E}32m90${E}0m, received ${E}31m81${E}0m`,
  '',
  `${E}1mTests:${E}0m ${E}1;31m1 failed${E}0m, ${E}1;32m20 passed${E}0m, 21 total`,
  '',
  `${E}38;5;208m256-colour${E}0m  ${E}38;5;45mpalette${E}0m  ${E}38;2;255;105;180mtrue colour${E}0m  ${E}38;2;120;200;255;48;2;30;40;70m rgb background ${E}0m`,
  `${E}1mbold${E}0m ${E}2mfaint${E}0m ${E}3mitalic${E}0m ${E}4munderline${E}0m ${E}21mdouble${E}0m ${E}9mstrike${E}0m ${E}53moverline${E}0m ${E}7minverse${E}0m`,
  '',
].join('\n');

const h = await launch({
  repo: REPO, id: 'elt', port: 9335,
  setup(ws) {
    fs.writeFileSync(path.join(ws, 'service.schema.json'), JSON.stringify(SCHEMA, null, 2) + '\n');
    fs.writeFileSync(path.join(ws, 'service.yaml'), SERVICE_YAML);
    fs.writeFileSync(path.join(ws, 'search.yaml'), COMPLETION_YAML);
    fs.writeFileSync(path.join(ws, 'service.toml'), SERVICE_TOML);
    fs.writeFileSync(path.join(ws, 'build.ans'), ANSI_LOG);
    gitInit(ws);
  },
  settings: {
    'yaml.schemaStore.enable': false,
    'langToolkit.toml.grammarUpdate.enabled': false,
    'langToolkit.taplo': { schema: { enabled: true, catalogs: [] } },
    'editor.hover.delay': 200,
  },
});
const { page } = h;
const editor = page.locator('#workbench\\.parts\\.editor');

try {
  if (h.want('yaml-validation')) {
    await h.openFile('service.yaml');
    await h.sleep(4000);
    // 光标停在 replicas 的取值上, 用键盘打开悬停, 显示类型错误与字段说明
    await h.goto(4, 12);
    await h.command('Show or Focus Hover', 1500);
    await h.shot('yaml-validation', { clip: editor, pad: 0, maxHeight: 440 });
    await h.reset();
  }

  if (h.want('yaml-completion')) {
    await h.openFile('search.yaml');
    await h.sleep(3000);
    await h.goto(6, 1);
    await h.press('Control+Space', 1500);
    // 再按一次展开右侧的字段说明
    await h.press('Control+Space', 1000);
    await h.shot('yaml-completion', { clip: editor, pad: 0, maxHeight: 310 });
    await h.reset();
  }

  if (h.want('toml-validation')) {
    await h.openFile('service.toml');
    await h.sleep(5000);
    // 悬停在 [healthCheck] 上, 显示多出的字段 retries; 弹层出现在上方, 不遮挡开头的 #:schema 与 replicas 的报错
    await h.goto(12, 3);
    await h.command('Show or Focus Hover', 1500);
    await h.shot('toml-validation', { clip: editor, pad: 0, maxHeight: 440 });
    await h.reset();
  }

  if (h.want('ansi-preview')) {
    await h.openFile('build.ans');
    await h.sleep(1500);
    await h.command('Lang Toolkit: Open ANSI Preview to the Side', 2000);
    await h.goto(1, 1);
    await h.shot('ansi-preview', { clip: editor, pad: 0, maxHeight: 420 });
    await h.reset();
  }
} finally {
  await h.close();
}
