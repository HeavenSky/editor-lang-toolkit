/**
 * 图标: 上半是 TOML 的 table 头 `[ ]`, 下半是终端提示符加几行着色文本。
 *
 * 三种语言各取一个只看轮廓就能认出来的特征, 而不是画个泛泛的"文档" —— 这个插件只做这三种,
 * 图标应该说清楚是哪三种:
 *
 * - `[ ]` 与其中的一段色块 → TOML 的 `[table]`
 * - 缩排的多行 → YAML/TOML 的键值结构
 * - `>` 提示符与多色行 → 终端输出与 ANSI 着色
 *
 * 前景刻意不用单一前景色: 这个插件的核心就是着色, 用一行里多段不同颜色来表达"语法高亮"
 * 本身 —— 真实的高亮就是一行里键一个色, 值另一个色。
 *
 * 底座 (画布尺寸, 圆角, 背景渐变, 描边) 来自 `lib/icon-brand.mjs`, 这里只描述前景。
 * 不要手写 `media/icon.svg` —— 几何只在这里描述一次, SVG 与 PNG 都由 `gen-icon.mjs` 生成。
 */
import { ACCENT_FROM, ACCENT_TO, SIZE, baseShapes } from './lib/icon-brand.mjs';

/** 语法着色的调色板, 取自主流暗色主题里各类 token 的惯用色。 */
const PUNCTUATION = '#C792EA';
const KEY = '#6FD6FF';
const STRING = '#4EDD6E';
const NUMBER = '#FFC145';
const ACCENT = '#FF6B60';

/** 提示符用品牌渐变, 与三种语言的 token 色区分开。 */
const PROMPT = { kind: 'linear', from: ACCENT_FROM, to: ACCENT_TO, direction: 'diagonal' };

const segment = (x1, y, x2, stroke) => ({
  kind: 'polyline',
  points: [
    [x1, y],
    [x2, y],
  ],
  stroke,
  strokeWidth: 13,
});

/** 方括号的一侧: 竖笔画加上下两条短臂; `arm` 为正朝右, 为负朝左。 */
const bracket = (x, yTop, yBottom, arm) => ({
  kind: 'polyline',
  points: [
    [x + arm, yTop],
    [x, yTop],
    [x, yBottom],
    [x + arm, yBottom],
  ],
  stroke: PUNCTUATION,
  strokeWidth: 12,
});

export const spec = {
  size: SIZE,
  label: 'Editor Lang Toolkit',
  shapes: [
    ...baseShapes(),

    // TOML 的 table 头: [ 表名 ]
    bracket(67, 64, 100, 16),
    segment(99, 82, 147, NUMBER),
    bracket(179, 64, 100, -16),

    // 终端提示符
    {
      kind: 'polyline',
      points: [
        [63, 134],
        [91, 162],
        [63, 190],
      ],
      stroke: PROMPT,
      strokeWidth: 15,
    },

    // 着色后的输出: 每行由两段不同颜色组成, 与真实的语法高亮同构
    segment(111, 146, 145, KEY),
    segment(157, 146, 193, STRING),
    segment(111, 178, 137, ACCENT),
    segment(149, 178, 175, NUMBER),
  ],
};
