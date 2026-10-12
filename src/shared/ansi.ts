/**
 * ANSI/VT100 转义序列解析器 —— 纯逻辑, 不 import vscode, 由 vitest 直接覆盖。
 *
 * 移植自 iliazeus/vscode-ansi 的 `src/ansi.ts` (MIT, Copyright (c) 2020 Ilia Pozdnyakov),
 * 归属见 `NOTICE.md`。相对上游的改动: 识别 SGR 的冒号子参数 (目前只解释 `4:n` 下划线样式,
 * 其余冒号分组整体忽略但仍按转义序列吞掉), 并提供与终端一致的 `createTerminalParser`。
 *
 * 两个设计要点值得留意, 它们决定了装饰层能怎么写:
 *
 * - **样式是值, 不是对象图。** 属性用位标志, 颜色用整数编码 (命名色带 `ColorFlags.Named`,
 *   真彩色就是裸 RGB)。因此 `Style` 可以直接序列化成 decoration 的缓存 key。
 * - **状态跨行保持。** `appendLine` 之间 `_finalStyle` 不重置 —— 这正是 TextMate 语法
 *   表达不了 ANSI 的原因: 一个 `\x1b[31m` 会一直生效到下一个序列, 跨越任意多行。
 *
 * 解析器识别**所有** CSI 序列 (`ESC [ ... <letter>`), 但只有 `m` (SGR) 会改变样式;
 * 其余 (光标移动, 清行, 清屏) 一律标记为 `AttributeFlags.EscapeSequence` 后跳过, 免得
 * 进度条与 spinner 的控制字符被当成正文渲染成乱码。
 */

export type Color = NamedColor | RgbColor;

export enum ColorFlags {
  Named = 1 << 24,
  Bright = 1 << 25,
}

export enum NamedColor {
  DefaultBackground = ColorFlags.Named | 0xf0,
  DefaultForeground = ColorFlags.Named | 0xf1,

  Black = ColorFlags.Named | 0,
  Red = ColorFlags.Named | 1,
  Green = ColorFlags.Named | 2,
  Yellow = ColorFlags.Named | 3,
  Blue = ColorFlags.Named | 4,
  Magenta = ColorFlags.Named | 5,
  Cyan = ColorFlags.Named | 6,
  White = ColorFlags.Named | 7,

  BrightBlack = ColorFlags.Named | ColorFlags.Bright | NamedColor.Black,
  BrightRed = ColorFlags.Named | ColorFlags.Bright | NamedColor.Red,
  BrightGreen = ColorFlags.Named | ColorFlags.Bright | NamedColor.Green,
  BrightYellow = ColorFlags.Named | ColorFlags.Bright | NamedColor.Yellow,
  BrightBlue = ColorFlags.Named | ColorFlags.Bright | NamedColor.Blue,
  BrightMagenta = ColorFlags.Named | ColorFlags.Bright | NamedColor.Magenta,
  BrightCyan = ColorFlags.Named | ColorFlags.Bright | NamedColor.Cyan,
  BrightWhite = ColorFlags.Named | ColorFlags.Bright | NamedColor.White,
}

export type RgbColor = number;

export enum AttributeFlags {
  None = 0,

  Bold = 1 << 0,
  Faint = 1 << 1,
  Italic = 1 << 2,
  Underline = 1 << 3,
  SlowBlink = 1 << 4,
  RapidBlink = 1 << 5,
  Inverse = 1 << 6,
  Conceal = 1 << 7,
  CrossedOut = 1 << 8,
  Fraktur = 1 << 9,
  DoubleUnderline = 1 << 10,
  Proportional = 1 << 11,
  Framed = 1 << 12,
  Encircled = 1 << 13,
  Overlined = 1 << 14,
  Superscript = 1 << 15,
  Subscript = 1 << 16,

  EscapeSequence = 1 << 31,
}

export interface Style {
  backgroundColor: Color;
  foregroundColor: Color;
  /** SGR 58 设定的下划线颜色; `DefaultForeground` 表示跟随文字颜色。 */
  underlineColor: Color;
  attributeFlags: AttributeFlags;
  fontIndex: number;
}

export const DefaultStyle: Style = {
  backgroundColor: NamedColor.DefaultBackground,
  foregroundColor: NamedColor.DefaultForeground,
  underlineColor: NamedColor.DefaultForeground,
  attributeFlags: 0,
  fontIndex: 0,
};

export interface Span extends Style {
  offset: number;
  length: number;
}

export interface ParserOptions {
  doubleUnderline?: boolean;
}

export class Parser {
  public constructor(public options: ParserOptions = { doubleUnderline: false }) {}

  private _finalStyle: Style = { ...DefaultStyle };

  public clear(): void {
    this._finalStyle = { ...DefaultStyle };
  }

  public appendLine(text: string): Span[] {
    return this._parseLine(text, this._finalStyle);
  }

  private _parseLine(text: string, style: Style): Span[] {
    const spans: Span[] = [];

    let textOffset = 0;
    let index = 0;

    while (index < text.length) {
      if (text.codePointAt(index) !== 0x1b) {
        let escOffset = text.indexOf("\x1b", index);
        if (escOffset === -1) escOffset = text.length;

        spans.push({ ...style, offset: textOffset, length: escOffset - textOffset });

        textOffset = escOffset;
        index = escOffset;
        continue;
      }

      if (index === text.length - 1) {
        break;
      }

      if (text[index + 1] !== "[") {
        index += 1;
        continue;
      }

      const match = text.slice(index + 2).match(/^([0-9;:]*)([a-zA-Z])/);
      if (!match) {
        index += 1;
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const argString = match[1]!, commandLetter = match[2]!;

      spans.push({
        ...style,
        offset: index,
        length: 2 + argString.length + 1,
        attributeFlags: style.attributeFlags | AttributeFlags.EscapeSequence,
      });

      if (commandLetter === "m") {
        const groups = argString.split(";").filter((arg) => arg !== "");
        if (groups.length === 0) groups.push("0");

        // 冒号分组 (ITU T.416 子参数, 如 `4:2`) 自成一个单元; 其余分号参数按原样连续交给
        // `_applyCodes`, 保持 `38;5;n` 这类跨参数序列的语义不变。
        let pending: number[] = [];
        for (const group of groups) {
          if (!group.includes(":")) {
            pending.push(parseInt(group, 10));
            continue;
          }
          this._applyCodes(pending, style);
          pending = [];
          this._applySubParams(group.split(":"), style);
        }
        this._applyCodes(pending, style);
      }

      textOffset = index + 2 + argString.length + 1;
      index = textOffset;
    }

    spans.push({ ...style, offset: textOffset, length: index - textOffset });

    return spans;
  }

  /**
   * 冒号子参数。解释 `4:n` (0 关闭, 1 单线, 2 双线, 3-5 曲线/点线/虚线按单线近似) 与下划线颜色
   * `58:5:n`, `58:2::r:g:b` (颜色空间 id 可省略, 即 `58:2:r:g:b`); 其它冒号分组 (例如 `38:2::r:g:b`) 忽略。
   */
  private _applySubParams(parts: string[], style: Style): void {
    if (parts[0] === "58") {
      // ITU T.416 的真彩色带一个颜色空间 id: `2:<id>:r:g:b`; 常见实现也接受省略 id 的 `2:r:g:b`。
      const rgb = parts[1] === "2" && parts.length >= 6 ? parts.slice(3, 6) : parts.slice(2, 5);
      const nums = [parts[1] ?? "", ...(parts[1] === "5" ? [parts[2] ?? ""] : rgb)].map((v) => parseInt(v, 10));
      const { color } = this._readExtendedColor([58, ...nums], 0);
      if (color !== undefined) style.underlineColor = color;
      return;
    }
    if (parts[0] !== "4") return;
    const kind = parts[1] === undefined || parts[1] === "" ? 1 : parseInt(parts[1], 10);

    if (kind === 0) {
      style.attributeFlags &= ~(AttributeFlags.Underline | AttributeFlags.DoubleUnderline);
    } else if (kind === 2 && this.options.doubleUnderline) {
      style.attributeFlags |= AttributeFlags.DoubleUnderline;
      style.attributeFlags &= ~AttributeFlags.Underline;
    } else if (kind >= 1 && kind <= 5) {
      style.attributeFlags |= AttributeFlags.Underline;
      style.attributeFlags &= ~AttributeFlags.DoubleUnderline;
    }
  }

  private _applyCodes(args: number[], style: Style): void {
    for (let argIndex = 0; argIndex < args.length; argIndex += 1) {
      const code = args[argIndex];

      switch (code) {
        case 0:
          Object.assign(style, DefaultStyle);
          break;

        case 1:
          style.attributeFlags |= AttributeFlags.Bold;
          style.attributeFlags &= ~AttributeFlags.Faint;
          break;

        case 2:
          style.attributeFlags |= AttributeFlags.Faint;
          style.attributeFlags &= ~AttributeFlags.Bold;
          break;

        case 3:
          style.attributeFlags |= AttributeFlags.Italic;
          style.attributeFlags &= ~AttributeFlags.Fraktur;
          break;

        case 4:
          style.attributeFlags |= AttributeFlags.Underline;
          style.attributeFlags &= ~AttributeFlags.DoubleUnderline;
          break;

        case 5:
          style.attributeFlags |= AttributeFlags.SlowBlink;
          style.attributeFlags &= ~AttributeFlags.RapidBlink;
          break;

        case 6:
          style.attributeFlags |= AttributeFlags.RapidBlink;
          style.attributeFlags &= ~AttributeFlags.SlowBlink;
          break;

        case 7:
          style.attributeFlags |= AttributeFlags.Inverse;
          break;

        case 8:
          style.attributeFlags |= AttributeFlags.Conceal;
          break;

        case 9:
          style.attributeFlags |= AttributeFlags.CrossedOut;
          break;

        case 10:
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 19:
          style.fontIndex = code - 10;
          break;

        case 20:
          style.attributeFlags |= AttributeFlags.Fraktur;
          style.attributeFlags &= ~AttributeFlags.Italic;
          break;

        case 21:
          if (this.options.doubleUnderline) {
            style.attributeFlags |= AttributeFlags.DoubleUnderline;
            style.attributeFlags &= ~AttributeFlags.Underline;
            break;
          }

          style.attributeFlags &= ~AttributeFlags.Bold;
          break;

        case 22:
          style.attributeFlags &= ~AttributeFlags.Bold;
          style.attributeFlags &= ~AttributeFlags.Faint;
          break;

        case 23:
          style.attributeFlags &= ~AttributeFlags.Italic;
          style.attributeFlags &= ~AttributeFlags.Fraktur;
          break;

        case 24:
          style.attributeFlags &= ~AttributeFlags.Underline;
          style.attributeFlags &= ~AttributeFlags.DoubleUnderline;
          break;

        case 25:
          style.attributeFlags &= ~AttributeFlags.SlowBlink;
          style.attributeFlags &= ~AttributeFlags.RapidBlink;
          break;

        case 26:
          style.attributeFlags |= AttributeFlags.Proportional;
          break;

        case 27:
          style.attributeFlags &= ~AttributeFlags.Inverse;
          break;

        case 28:
          style.attributeFlags &= ~AttributeFlags.Conceal;
          break;

        case 29:
          style.attributeFlags &= ~AttributeFlags.CrossedOut;
          break;

        case 30:
        case 31:
        case 32:
        case 33:
        case 34:
        case 35:
        case 36:
        case 37:
          style.foregroundColor = ColorFlags.Named | (code - 30);
          break;

        case 38: {
          const { color, consumed } = this._readExtendedColor(args, argIndex);
          argIndex += consumed;
          if (color !== undefined) style.foregroundColor = color;
          break;
        }

        case 39:
          style.foregroundColor = DefaultStyle.foregroundColor;
          break;

        case 40:
        case 41:
        case 42:
        case 43:
        case 44:
        case 45:
        case 46:
        case 47:
          style.backgroundColor = ColorFlags.Named | (code - 40);
          break;

        case 48: {
          const { color, consumed } = this._readExtendedColor(args, argIndex);
          argIndex += consumed;
          if (color !== undefined) style.backgroundColor = color;
          break;
        }

        case 49:
          style.backgroundColor = DefaultStyle.backgroundColor;
          break;

        case 50:
          style.attributeFlags &= ~AttributeFlags.Proportional;
          break;

        case 51:
          style.attributeFlags |= AttributeFlags.Framed;
          style.attributeFlags &= ~AttributeFlags.Encircled;
          break;

        case 52:
          style.attributeFlags |= AttributeFlags.Encircled;
          style.attributeFlags &= ~AttributeFlags.Framed;
          break;

        case 53:
          style.attributeFlags |= AttributeFlags.Overlined;
          break;

        case 54:
          style.attributeFlags &= ~AttributeFlags.Framed;
          style.attributeFlags &= ~AttributeFlags.Encircled;
          break;

        case 55:
          style.attributeFlags &= ~AttributeFlags.Overlined;
          break;

        case 58: {
          // 必须和 38/48 一样吞掉颜色参数, 否则 `58;2;r;g;b` 里的 2 与 0 会被当成淡色与重置。
          const { color, consumed } = this._readExtendedColor(args, argIndex);
          argIndex += consumed;
          if (color !== undefined) style.underlineColor = color;
          break;
        }

        case 59:
          style.underlineColor = DefaultStyle.underlineColor;
          break;

        case 73:
          style.attributeFlags |= AttributeFlags.Superscript;
          style.attributeFlags &= ~AttributeFlags.Subscript;
          break;

        case 74:
          style.attributeFlags |= AttributeFlags.Subscript;
          style.attributeFlags &= ~AttributeFlags.Superscript;
          break;

        case 90:
        case 91:
        case 92:
        case 93:
        case 94:
        case 95:
        case 96:
        case 97:
          style.foregroundColor = ColorFlags.Named | ColorFlags.Bright | (code - 90);
          break;

        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
          style.backgroundColor = ColorFlags.Named | ColorFlags.Bright | (code - 100);
          break;
      }
    }
  }

  /**
   * 读 `38` / `48` / `58` 之后的扩展色参数 (`5;n` 或 `2;r;g;b`), 返回颜色与要跳过的参数个数。
   * 参数越界时不给颜色, 但仍按类型跳过, 与终端的处理一致。
   */
  private _readExtendedColor(args: number[], argIndex: number): { color: Color | undefined; consumed: number } {
    const colorType = args[argIndex + 1];

    if (colorType === 5) {
      const index = args[argIndex + 2];
      return { color: 0 <= index && index <= 255 ? this._convert8BitColor(index) : undefined, consumed: 2 };
    }

    if (colorType === 2) {
      const r = args[argIndex + 2];
      const g = args[argIndex + 3];
      const b = args[argIndex + 4];
      const valid = 0 <= r && r <= 255 && 0 <= g && g <= 255 && 0 <= b && b <= 255;
      return { color: valid ? (r << 16) | (g << 8) | b : undefined, consumed: 4 };
    }

    return { color: undefined, consumed: 0 };
  }

  private _convert8BitColor(color: number): Color {
    if (0 <= color && color <= 7) {
      return ColorFlags.Named | color;
    }

    if (8 <= color && color <= 15) {
      return ColorFlags.Named | ColorFlags.Bright | (color - 8);
    }

    if (232 <= color && color <= 255) {
      const intensity = ((255 * (color - 232)) / 23) | 0;
      return (intensity << 16) | (intensity << 8) | intensity;
    }

    let color6 = color - 16;

    const b6 = color6 % 6;
    color6 = (color6 / 6) | 0;

    const g6 = color6 % 6;
    color6 = (color6 / 6) | 0;

    const r6 = color6;

    const r = ((255 * r6) / 5) | 0;
    const g = ((255 * g6) / 5) | 0;
    const b = ((255 * b6) / 5) | 0;

    return (r << 16) | (g << 8) | b;
  }
}

/**
 * 与 xterm / VS Code 集成终端一致的解析器: SGR 21 是双下划线, 而不是"关闭粗体"。
 * 编辑器着色与预览都用它, 免得同一份日志在终端和编辑器里看起来不一样。
 */
export function createTerminalParser(): Parser {
  return new Parser({ doubleUnderline: true });
}
