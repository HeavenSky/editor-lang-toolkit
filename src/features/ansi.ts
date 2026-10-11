import * as vscode from 'vscode';

import * as ansi from '../shared/ansi';
import { debounce } from '../shared/debounce';
import { LruCache } from '../shared/lru';
import { getOutput } from '../shared/output';

/**
 * ANSI 转义序列的着色与预览。
 *
 * 结构上刻意与两个语言服务器无关: 这里没有 LSP, 只有 `TextEditorDecorationType`。ANSI 的
 * 着色是**有状态**的 (一个 `\x1b[31m` 一直生效到下一个序列, 跨越任意多行), TextMate 语法
 * 是行内局部的正则匹配, 表达不了这种状态传递 —— 所以只能自己解析再打装饰, 没有捷径。
 *
 * 相对上游 (iliazeus/vscode-ansi) 补了两处:
 *
 * 1. **去抖。** 上游每次按键都全量重解析文档, 大日志会卡。
 * 2. **装饰类型的上界。** 上游按样式组合缓存且无界增长; 真彩色让取值空间到 1600 万级,
 *    每个组合都是一个不会自己释放的宿主资源。这里用 LRU 封顶。
 */

/**
 * 装饰类型缓存的上界。超过后按最久未使用逐出并 dispose, 但跳过本轮或任一可见编辑器仍在用的
 * 类型 —— 否则单个文档的样式组合一多, 刚打上的颜色就会被自己逐出而静默消失。因此这是软上界:
 * 可见内容确实需要更多组合时缓存会暂时超出, 不再可见后回落。
 */
const DECORATION_TYPE_LIMIT = 512;

/** 连续输入时的重解析间隔。 */
const REDRAW_DEBOUNCE_MS = 300;

/** 预览文档的 uri scheme。 */
const PREVIEW_SCHEME = 'langToolkit.ansi';

const ANSI_LANGUAGE_ID = 'ansi';

const themeColors: Record<ansi.NamedColor, vscode.ThemeColor | undefined> = {
  [ansi.NamedColor.DefaultBackground]: undefined,
  [ansi.NamedColor.DefaultForeground]: undefined,

  [ansi.NamedColor.Black]: new vscode.ThemeColor('terminal.ansiBlack'),
  [ansi.NamedColor.BrightBlack]: new vscode.ThemeColor('terminal.ansiBrightBlack'),
  [ansi.NamedColor.White]: new vscode.ThemeColor('terminal.ansiWhite'),
  [ansi.NamedColor.BrightWhite]: new vscode.ThemeColor('terminal.ansiBrightWhite'),
  [ansi.NamedColor.Red]: new vscode.ThemeColor('terminal.ansiRed'),
  [ansi.NamedColor.BrightRed]: new vscode.ThemeColor('terminal.ansiBrightRed'),
  [ansi.NamedColor.Green]: new vscode.ThemeColor('terminal.ansiGreen'),
  [ansi.NamedColor.BrightGreen]: new vscode.ThemeColor('terminal.ansiBrightGreen'),
  [ansi.NamedColor.Yellow]: new vscode.ThemeColor('terminal.ansiYellow'),
  [ansi.NamedColor.BrightYellow]: new vscode.ThemeColor('terminal.ansiBrightYellow'),
  [ansi.NamedColor.Blue]: new vscode.ThemeColor('terminal.ansiBlue'),
  [ansi.NamedColor.BrightBlue]: new vscode.ThemeColor('terminal.ansiBrightBlue'),
  [ansi.NamedColor.Magenta]: new vscode.ThemeColor('terminal.ansiMagenta'),
  [ansi.NamedColor.BrightMagenta]: new vscode.ThemeColor('terminal.ansiBrightMagenta'),
  [ansi.NamedColor.Cyan]: new vscode.ThemeColor('terminal.ansiCyan'),
  [ansi.NamedColor.BrightCyan]: new vscode.ThemeColor('terminal.ansiBrightCyan'),
};

/**
 * 反色时默认前景/背景必须解析成具体颜色。
 *
 * 平时把默认色留成 undefined, 让编辑器自己的前景背景生效; 但 `\x1b[7m` 要把两者对调,
 * 此时 undefined 换过去就成了"不设置", 反色会无声地失效。
 */
const explicitThemeColors: Record<ansi.NamedColor, vscode.ThemeColor | undefined> = {
  ...themeColors,
  [ansi.NamedColor.DefaultBackground]: new vscode.ThemeColor('editor.background'),
  [ansi.NamedColor.DefaultForeground]: new vscode.ThemeColor('editor.foreground'),
};

function convertColor(color: ansi.Color, explicitDefaults: boolean): vscode.ThemeColor | string | undefined {
  if (color & ansi.ColorFlags.Named) {
    return (explicitDefaults ? explicitThemeColors : themeColors)[color as ansi.NamedColor];
  }
  return `#${color.toString(16).padStart(6, '0')}`;
}

function buildDecorationType(style: ansi.Style): vscode.TextEditorDecorationType {
  const inverse = (style.attributeFlags & ansi.AttributeFlags.Inverse) !== 0;
  const background = inverse ? style.foregroundColor : style.backgroundColor;
  const foreground = inverse ? style.backgroundColor : style.foregroundColor;

  const decorations: string[] = [];
  if (style.attributeFlags & ansi.AttributeFlags.Underline) decorations.push('underline');
  if (style.attributeFlags & ansi.AttributeFlags.DoubleUnderline) decorations.push('underline double');
  if (style.attributeFlags & ansi.AttributeFlags.CrossedOut) decorations.push('line-through');
  if (style.attributeFlags & ansi.AttributeFlags.Overlined) decorations.push('overline');

  return vscode.window.createTextEditorDecorationType({
    backgroundColor: convertColor(background, inverse),
    color: convertColor(foreground, inverse),
    fontWeight: style.attributeFlags & ansi.AttributeFlags.Bold ? 'bold' : undefined,
    fontStyle: style.attributeFlags & ansi.AttributeFlags.Italic ? 'italic' : undefined,
    textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
    // Conceal 是"隐藏", 但真把文字设成透明会让人以为文件损坏; 压到很低的透明度既表达了
    // 语义, 又留下"这里有东西"的线索。Faint 用同样的手法, 只是没那么极端。
    opacity:
      style.attributeFlags & ansi.AttributeFlags.Conceal
        ? '10%'
        : style.attributeFlags & ansi.AttributeFlags.Faint
          ? '50%'
          : undefined,
  });
}

class AnsiDecorator implements vscode.Disposable {
  /** 转义序列本身的装饰: 淡出但不隐藏, 免得看不出光标停在哪。 */
  private readonly _escapeType = vscode.window.createTextEditorDecorationType({ opacity: '40%' });

  private readonly _types = new LruCache<string, vscode.TextEditorDecorationType>(
    DECORATION_TYPE_LIMIT,
    (type) => {
      type.dispose();
      this._disposed.add(type);
    },
    (type) => !this._isInUse(type),
  );

  /** 记住每个编辑器实际用过的装饰类型, 清除时才知道要清哪些。 */
  private readonly _applied = new WeakMap<vscode.TextEditor, Set<vscode.TextEditorDecorationType>>();

  /** 正在进行的这一轮 apply 已用到的类型; 它们还没写进 `_applied`, 需要单独防止被逐出。 */
  private _inProgress: Set<vscode.TextEditorDecorationType> | undefined;

  /** 已 dispose 的类型; 不可见编辑器的 `_applied` 里可能还留着, 清理时跳过。 */
  private readonly _disposed = new WeakSet<vscode.TextEditorDecorationType>();

  private _isInUse(type: vscode.TextEditorDecorationType): boolean {
    if (this._inProgress?.has(type)) return true;
    return vscode.window.visibleTextEditors.some((editor) => this._applied.get(editor)?.has(type) === true);
  }

  public dispose(): void {
    this._escapeType.dispose();
    this._types.clear();
  }

  private _typeFor(key: string, style: ansi.Style): vscode.TextEditorDecorationType {
    const cached = this._types.get(key);
    if (cached) return cached;
    const created = buildDecorationType(style);
    this._types.set(key, created);
    return created;
  }

  /**
   * 解析文档并把装饰打上去。
   *
   * `stripEscapes` 用于预览: 预览文本里转义序列已经被删掉, 所以每个 span 的列号要减去本行
   * 累计的转义长度 —— 同一个解析器同时服务两种视图, 差别只在这一个偏移量上。
   */
  public apply(editor: vscode.TextEditor, source: vscode.TextDocument, stripEscapes: boolean): void {
    const parser = ansi.createTerminalParser();
    const ranges = new Map<string, vscode.Range[]>();
    const styles = new Map<string, ansi.Style>();
    const escapes: vscode.Range[] = [];

    for (let lineNumber = 0; lineNumber < source.lineCount; lineNumber += 1) {
      let strippedSoFar = 0;

      for (const span of parser.appendLine(source.lineAt(lineNumber).text)) {
        const { offset, length, ...style } = span;

        if (style.attributeFlags & ansi.AttributeFlags.EscapeSequence) {
          if (stripEscapes) {
            strippedSoFar += length;
          } else {
            escapes.push(new vscode.Range(lineNumber, offset, lineNumber, offset + length));
          }
          continue;
        }

        if (length === 0) continue;

        const start = offset - strippedSoFar;
        const key = JSON.stringify(style);
        if (!styles.has(key)) styles.set(key, style);
        const bucket = ranges.get(key) ?? [];
        if (bucket.length === 0) ranges.set(key, bucket);
        bucket.push(new vscode.Range(lineNumber, start, lineNumber, start + length));
      }
    }

    // 先清掉上一轮用过但这一轮没有的装饰, 否则删掉一个转义序列后旧颜色会留在屏幕上。
    const previous = this._applied.get(editor);
    const current = new Set<vscode.TextEditorDecorationType>();

    this._inProgress = current;
    try {
      for (const [key, value] of ranges) {
        const type = this._typeFor(key, styles.get(key) as ansi.Style);
        current.add(type);
        editor.setDecorations(type, value);
      }
    } finally {
      this._inProgress = undefined;
    }
    editor.setDecorations(this._escapeType, escapes);
    current.add(this._escapeType);

    if (previous) {
      for (const stale of previous) {
        if (!current.has(stale) && !this._disposed.has(stale)) editor.setDecorations(stale, []);
      }
    }
    this._applied.set(editor, current);
  }

  public clear(editor: vscode.TextEditor): void {
    const previous = this._applied.get(editor);
    if (!previous) return;
    for (const type of previous) {
      if (!this._disposed.has(type)) editor.setDecorations(type, []);
    }
    this._applied.delete(editor);
  }
}

/**
 * 预览: 剥掉转义序列后的纯文本, 以虚拟文档呈现。
 *
 * 用 `TextDocumentContentProvider` 而不是 webview —— 预览因此是一个**真正的编辑器**, 搜索,
 * 选择, 复制, 与原文并排滚动全部是编辑器自带的, 不用自己实现, 也不用维护一套 HTML/CSS。
 */
class AnsiPreviewProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  private readonly _watched = new Set<string>();

  public static toPreviewUri(source: vscode.Uri): vscode.Uri {
    const name = source.path.split('/').pop() ?? 'preview';
    return vscode.Uri.parse(
      `${PREVIEW_SCHEME}://preview/${encodeURIComponent(`Preview: ${name}`)}?${encodeURIComponent(source.toString())}`,
      true,
    );
  }

  public static toSourceUri(preview: vscode.Uri): vscode.Uri {
    return vscode.Uri.parse(decodeURIComponent(preview.query), true);
  }

  public notifySourceChanged(source: vscode.Uri): void {
    if (this._watched.has(source.toString())) {
      this._onDidChange.fire(AnsiPreviewProvider.toPreviewUri(source));
    }
  }

  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const source = AnsiPreviewProvider.toSourceUri(uri);
    this._watched.add(source.toString());

    const document = await vscode.workspace.openTextDocument(source);
    const parser = ansi.createTerminalParser();
    const lines: string[] = [];

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
      const text = document.lineAt(lineNumber).text;
      const kept = parser
        .appendLine(text)
        .filter((span) => !(span.attributeFlags & ansi.AttributeFlags.EscapeSequence))
        .map((span) => text.substr(span.offset, span.length));
      lines.push(kept.join(''));
    }

    return lines.join('\n');
  }

  public dispose(): void {
    this._onDidChange.dispose();
  }
}

function isAnsiEditor(editor: vscode.TextEditor): boolean {
  return editor.document.languageId === ANSI_LANGUAGE_ID || editor.document.uri.scheme === PREVIEW_SCHEME;
}

export function registerAnsi(context: vscode.ExtensionContext): void {
  const decorator = new AnsiDecorator();
  const preview = new AnsiPreviewProvider();
  context.subscriptions.push(decorator, preview);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, preview),
  );

  const redraw = (editor: vscode.TextEditor): void => {
    if (!isAnsiEditor(editor)) {
      decorator.clear(editor);
      return;
    }
    try {
      if (editor.document.uri.scheme === PREVIEW_SCHEME) {
        // 预览的装饰要按**源文档**解析: 预览文本里转义序列已经没了, 再解析一遍只会得到纯文本。
        void vscode.workspace.openTextDocument(AnsiPreviewProvider.toSourceUri(editor.document.uri)).then(
          (source) => decorator.apply(editor, source, true),
          (error: unknown) => getOutput().warn(`ANSI preview failed: ${String(error)}`),
        );
      } else {
        decorator.apply(editor, editor.document, false);
      }
    } catch (error) {
      getOutput().warn(`ANSI decoration failed: ${String(error)}`);
    }
  };

  const redrawAll = (): void => vscode.window.visibleTextEditors.forEach(redraw);
  const redrawSoon = debounce(redrawAll, REDRAW_DEBOUNCE_MS);
  context.subscriptions.push({ dispose: () => redrawSoon.cancel() });

  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(redrawAll),
    vscode.workspace.onDidChangeTextDocument((event) => {
      preview.notifySourceChanged(event.document.uri);
      redrawSoon();
    }),
    vscode.workspace.onDidOpenTextDocument(redrawAll),
  );

  const showPreview = async (column: vscode.ViewColumn): Promise<void> => {
    const source = vscode.window.activeTextEditor?.document.uri;
    if (!source) return;
    await vscode.window.showTextDocument(AnsiPreviewProvider.toPreviewUri(source), { viewColumn: column });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('langToolkit.ansi.showPreview', () =>
      showPreview(vscode.ViewColumn.Active),
    ),
    vscode.commands.registerCommand('langToolkit.ansi.showPreviewToSide', () =>
      showPreview(vscode.ViewColumn.Beside),
    ),
  );

  redrawAll();
}
