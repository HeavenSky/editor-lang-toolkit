import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AttributeFlags,
  ColorFlags,
  DefaultStyle,
  NamedColor,
  Parser,
  type Span,
} from '../src/shared/ansi';

const ESC = '';

/** 只保留正文 span, 丢掉转义序列与空 span —— 断言时关心的通常是这些。 */
function textSpans(spans: Span[]): Span[] {
  return spans.filter((span) => !(span.attributeFlags & AttributeFlags.EscapeSequence) && span.length > 0);
}

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

describe('Parser: 基本 SGR', () => {
  it('无转义序列时整行是一个默认样式的 span', () => {
    const spans = textSpans(new Parser().appendLine('plain text'));
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ offset: 0, length: 10, ...DefaultStyle });
  });

  it('前景色生效于其后的文本', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[31mred`));
    expect(spans).toHaveLength(1);
    expect(spans[0]?.foregroundColor).toBe(NamedColor.Red);
  });

  it('亮色走 Bright 标志位', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[91mbright red`));
    expect(spans[0]?.foregroundColor).toBe(NamedColor.BrightRed);
  });

  it('SGR 0 重置全部样式', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[1;31mbold red${ESC}[0mplain`));
    expect(spans[0]?.attributeFlags & AttributeFlags.Bold).toBeTruthy();
    expect(spans[1]?.attributeFlags & AttributeFlags.Bold).toBeFalsy();
    expect(spans[1]?.foregroundColor).toBe(DefaultStyle.foregroundColor);
  });

  it('空参数等价于 SGR 0', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[31mred${ESC}[mplain`));
    expect(spans[1]?.foregroundColor).toBe(DefaultStyle.foregroundColor);
  });

  it('属性可叠加, 并能被对应的关闭码单独撤销', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[1m${ESC}[4mboth${ESC}[24monly bold`));
    expect(spans[0]?.attributeFlags & AttributeFlags.Bold).toBeTruthy();
    expect(spans[0]?.attributeFlags & AttributeFlags.Underline).toBeTruthy();
    expect(spans[1]?.attributeFlags & AttributeFlags.Bold).toBeTruthy();
    expect(spans[1]?.attributeFlags & AttributeFlags.Underline).toBeFalsy();
  });
});

describe('Parser: 跨行状态', () => {
  it('样式跨行保持 —— TextMate 语法做不到的正是这一点', () => {
    const parser = new Parser();
    parser.appendLine(`${ESC}[31mfirst`);
    const second = textSpans(parser.appendLine('second line, still red'));
    expect(second[0]?.foregroundColor).toBe(NamedColor.Red);
  });

  it('clear() 把状态复位', () => {
    const parser = new Parser();
    parser.appendLine(`${ESC}[31mred`);
    parser.clear();
    const spans = textSpans(parser.appendLine('plain again'));
    expect(spans[0]?.foregroundColor).toBe(DefaultStyle.foregroundColor);
  });
});

describe('Parser: 扩展色', () => {
  it('256 色的前 16 个映射到命名色', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[38;5;1mred`));
    expect(spans[0]?.foregroundColor).toBe(NamedColor.Red);
    const bright = textSpans(new Parser().appendLine(`${ESC}[38;5;9mbright`));
    expect(bright[0]?.foregroundColor).toBe(NamedColor.BrightRed);
  });

  it('256 色的灰阶段落解析成等值 RGB', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[38;5;232mgray`));
    const color = spans[0]?.foregroundColor as number;
    expect(color & ColorFlags.Named).toBe(0);
    expect((color >> 16) & 0xff).toBe(color & 0xff);
  });

  it('真彩色按 RGB 原样保留', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[38;2;18;52;86mtruecolor`));
    expect(spans[0]?.foregroundColor).toBe(0x123456);
  });

  it('背景色同样支持 256 与真彩色', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[48;2;1;2;3mbg`));
    expect(spans[0]?.backgroundColor).toBe(0x010203);
  });

  it('越界的 RGB 分量被忽略而不是写入错值', () => {
    const spans = textSpans(new Parser().appendLine(`${ESC}[38;2;999;0;0mbad`));
    expect(spans[0]?.foregroundColor).toBe(DefaultStyle.foregroundColor);
  });
});

describe('Parser: 非 SGR 与畸形序列', () => {
  it('光标移动等 CSI 序列被识别为转义序列, 不当作正文', () => {
    // 这正是 vt100 那类"只匹配 m 结尾"的实现会渲染成乱码的地方。
    const spans = new Parser().appendLine(`${ESC}[2Kcleared`);
    const escapes = spans.filter((span) => span.attributeFlags & AttributeFlags.EscapeSequence);
    expect(escapes).toHaveLength(1);
    expect(escapes[0]?.length).toBe(4);
    expect(textSpans(spans)[0]?.length).toBe('cleared'.length);
  });

  it('非 SGR 序列不改变样式', () => {
    const parser = new Parser();
    parser.appendLine(`${ESC}[31m`);
    const spans = textSpans(parser.appendLine(`${ESC}[1Astill red`));
    expect(spans[0]?.foregroundColor).toBe(NamedColor.Red);
  });

  it('行尾孤立的 ESC 不会让解析器越界', () => {
    expect(() => new Parser().appendLine(`text${ESC}`)).not.toThrow();
  });

  it('ESC 后不是 [ 时按普通字符跳过', () => {
    const spans = textSpans(new Parser().appendLine(`a${ESC}Xb`));
    expect(spans.map((span) => span.length).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('空行不产生正文 span', () => {
    expect(textSpans(new Parser().appendLine(''))).toHaveLength(0);
  });
});

describe('Parser: 真实样本', () => {
  it.each(['basic.ans', '8bit-color.ans', '24bit-color.ans'])('%s 能被完整解析且不丢字符', (name) => {
    const parser = new Parser();
    for (const line of fixture(name).split('\n')) {
      const spans = parser.appendLine(line);
      // 每行的 span 必须无缝覆盖整行: 相邻 span 首尾相接, 最后一个到行尾。
      let cursor = 0;
      for (const span of spans) {
        expect(span.offset).toBe(cursor);
        cursor += span.length;
      }
      expect(cursor).toBe(line.length);
    }
  });

  it('24bit 样本里确实出现了真彩色', () => {
    const parser = new Parser();
    const colors = new Set<number>();
    for (const line of fixture('24bit-color.ans').split('\n')) {
      for (const span of textSpans(parser.appendLine(line))) {
        if (!(span.foregroundColor & ColorFlags.Named)) colors.add(span.foregroundColor);
        if (!(span.backgroundColor & ColorFlags.Named)) colors.add(span.backgroundColor);
      }
    }
    expect(colors.size).toBeGreaterThan(16);
  });
});
