/**
 * 图标: 上半是 TOML 的 table 头 `[ ]`, 下半是 YAML 的缩进树。
 *
 * 两种格式各取一个只看轮廓就能认出来的特征, 而不是画个泛泛的"文档" —— 这个插件只做这两种
 * 语言, 图标应该说清楚是哪两种。
 *
 * 底座 (画布尺寸, 圆角, 背景渐变, 描边) 来自 `lib/icon-brand.mjs`, 这里只描述前景。
 * 不要手写 `media/icon.svg` —— 几何只在这里描述一次, SVG 与 PNG 都由 `gen-icon.mjs` 生成。
 */
import { ACCENT_FROM, ACCENT_TO, FOREGROUND, SIZE, baseShapes } from './lib/icon-brand.mjs';

const ACCENT = { kind: 'linear', from: ACCENT_FROM, to: ACCENT_TO, direction: 'vertical' };

/** 缩进树的一行: 一个项目符号加一条值线; 逐层缩进, 值线逐层变短。 */
const branch = (x, y, width) => [
  { kind: 'circle', cx: x, cy: y, r: 7, fill: ACCENT },
  {
    kind: 'polyline',
    points: [
      [x + 20, y],
      [x + 20 + width, y],
    ],
    stroke: FOREGROUND,
    strokeWidth: 12,
  },
];

export const spec = {
  size: SIZE,
  label: 'Editor Lang Toolkit',
  shapes: [
    ...baseShapes(),

    // TOML 的 table 头: [ 表名 ]
    {
      kind: 'polyline',
      points: [
        [88, 56],
        [70, 56],
        [70, 100],
        [88, 100],
      ],
      stroke: FOREGROUND,
      strokeWidth: 12,
    },
    {
      kind: 'polyline',
      points: [
        [168, 56],
        [186, 56],
        [186, 100],
        [168, 100],
      ],
      stroke: FOREGROUND,
      strokeWidth: 12,
    },
    {
      kind: 'polyline',
      points: [
        [106, 78],
        [150, 78],
      ],
      stroke: ACCENT,
      strokeWidth: 12,
    },

    // YAML 的缩进树
    ...branch(76, 140, 104),
    ...branch(98, 172, 70),
    ...branch(120, 204, 36),
  ],
};
