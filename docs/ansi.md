# View ANSI-coloured files

**English** · [简体中文](../zh/docs/ansi.md)

This page shows how to open captured terminal output in colour and read it without escape codes; it needs no settings.

## Colour a file

Files with the `ansi` language are coloured as soon as they are open. `.ans` and `.ansi` files get it automatically; map other files with `files.associations`:

```jsonc
{ "files.associations": { "*.log": "ansi" } }
```

This replaces the built-in `log` highlighting for those files, including its timestamp colours. That grammar shows escape codes as noise anyway, so the switch is worth it when the files really contain them. To colour a single file once, run **Change Language Mode** and pick **ANSI Text**.

## Read it without escape codes

**Lang Toolkit: Open ANSI Preview to the Side** opens a copy of the file with the escape codes removed and the colours kept; the button in the editor title bar does the same, and Alt-click opens it in the current editor instead. The preview is a regular read-only editor rather than a webview, so search, selection, copy and side-by-side scrolling work as usual. It follows edits to the source file.

## Supported colours and styles

Colours map to your theme's `terminal.ansi*` palette, so they match the integrated terminal and change with your theme.

- Colours: the 16 basic colours (8 normal and 8 bright), 256 colours (`38;5;n`) and 24-bit true colour (`38;2;r;g;b`), for text, background and underline (`58;5;n`, `58;2;r;g;b`, and the colon forms).
- Styles: bold, faint, italic, underline, double underline (`21` and `4:2`), strikethrough, overline, inverse and conceal.
- Other control sequences, such as cursor moves and line clears, are dimmed instead of shown as stray characters. Progress bars, spinners and `docker build` output consist mostly of these.

Colouring refreshes 300 ms after you stop typing. Very colourful files are covered in [Troubleshooting](troubleshooting.md#known-limitations).
