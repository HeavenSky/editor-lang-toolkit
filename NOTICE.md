# Third-Party Notices

Editor Lang Toolkit bundles the following third-party software. Each retains its own
copyright and license; the texts below are reproduced from the respective packages.

---

## yaml-language-server

- Version: 1.24.0
- License: MIT
- Copyright (c) 2017 Red Hat Inc. and others.
- Source: https://github.com/redhat-developer/yaml-language-server

Bundled into `out/extension.js` and run as a separate process. Its localization bundles are
redistributed unmodified under `l10n/yaml-language-server/`.

---

## @taplo/lsp (Taplo)

- Version: 0.8.0
- License: MIT
- Copyright (c) 2020 Ferenc Tamás
- Source: https://github.com/tamasfe/taplo

The WebAssembly module is redistributed as `out/taplo.wasm`. The accompanying JavaScript glue
is redistributed with a single mechanical change: the inlined base64 module is replaced with a
read of that file. No other code is altered.

---

## TOML TextMate grammar

- License: MIT
- Copyright (c) 2020 Ferenc Tamás
- Source: https://github.com/tamasfe/taplo (`editors/vscode/toml.tmLanguage.json`)

Redistributed as `syntaxes/toml.tmLanguage.json`, together with the matching language
configuration. Per the upstream project's acknowledgements, the grammar originates from work by
[@GalAster](https://github.com/GalAster) and [@be5invis](https://github.com/be5invis), used with
their permission.

This file may be replaced at runtime by a newer copy fetched from the same upstream path — see
`langToolkit.toml.grammarUpdate.enabled`.

---

## vscode-ansi

- License: MIT
- Copyright (c) 2020 Ilia Pozdnyakov
- Source: https://github.com/iliazeus/vscode-ansi

`src/shared/ansi.ts` is a port of that project's `src/ansi.ts`, unchanged apart from an added
header comment. The decoration and preview layers built on top of it (`src/features/ansi.ts`) are
original work of this project, though the virtual-document preview approach is taken from the same
source. The ANSI test fixtures under `test/fixtures/` are copied from its `test/` directory; they
are not part of the published package.

---

## vscode-languageclient

- Version: 10.1.0
- License: MIT
- Copyright (c) Microsoft Corporation
- Source: https://github.com/microsoft/vscode-languageserver-node

Bundled into `out/extension.js`.

---

## MIT License

All of the above are distributed under the MIT License:

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
