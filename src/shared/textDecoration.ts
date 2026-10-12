// ANSI 样式到 CSS `text-decoration` 值的拼接; 不依赖 vscode, 颜色转换由调用方传入.
import { AttributeFlags, type Color, type Style } from './ansi';

/**
 * CSS `text-decoration` 简写里线型关键字必须连写, 样式与颜色各出现一次; 写成 `underline #f00 line-through`
 * 或 `underline double line-through` 会让整条声明失效, 所以按 线型 → 样式 → 颜色 拼接.
 * 简写只有一个颜色, 有下划线时它取下划线颜色, 同时作用于删除线与上划线.
 */
export function buildTextDecoration(style: Style, cssColor: (color: Color) => string | undefined): string | undefined {
  const flags = style.attributeFlags;
  const underline = (flags & (AttributeFlags.Underline | AttributeFlags.DoubleUnderline)) !== 0;
  const lines: string[] = [];
  if (underline) lines.push('underline');
  if (flags & AttributeFlags.CrossedOut) lines.push('line-through');
  if (flags & AttributeFlags.Overlined) lines.push('overline');
  if (lines.length === 0) return undefined;
  if (flags & AttributeFlags.DoubleUnderline) lines.push('double');
  const color = underline ? cssColor(style.underlineColor) : undefined;
  if (color) lines.push(color);
  return lines.join(' ');
}
