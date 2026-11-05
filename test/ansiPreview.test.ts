import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

const host = vi.hoisted(() => ({
	onDidChangeTextDocument: vi.fn(),
	registerTextDocumentContentProvider: vi.fn(),
	openTextDocument: vi.fn(),
}));

vi.mock("vscode", () => {
	class EventEmitter<T> {
		private readonly listeners = new Set<(value: T) => void>();
		readonly event = (listener: (value: T) => void) => {
			this.listeners.add(listener);
			return { dispose: () => this.listeners.delete(listener) };
		};
		fire(value: T): void {
			for (const listener of this.listeners) listener(value);
		}
		dispose(): void {
			this.listeners.clear();
		}
	}
	const disposable = () => ({ dispose() {} });
	return {
		EventEmitter,
		ThemeColor: class {
			constructor(readonly id: string) {}
		},
		Uri: {
			parse: (value: string) => {
				const url = new URL(value);
				return {
					path: url.pathname,
					query: url.search.slice(1),
					scheme: value.slice(0, value.indexOf(":")),
					toString: () => value,
				};
			},
		},
		workspace: { ...host, onDidOpenTextDocument: disposable },
		window: {
			visibleTextEditors: [],
			createTextEditorDecorationType: disposable,
			onDidChangeVisibleTextEditors: disposable,
		},
		commands: { registerCommand: disposable },
	};
});

import { Uri } from "vscode";

import { registerAnsi } from "../src/features/ansi";

describe("ANSI 预览更新", () => {
	let subscriptions: vscode.Disposable[];
	let provider: vscode.TextDocumentContentProvider;
	let onChange: (event: { document: vscode.TextDocument }) => void;
	let notifications: ReturnType<typeof vi.fn<(uri: vscode.Uri) => void>>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		host.onDidChangeTextDocument.mockReturnValue({ dispose() {} });
		host.registerTextDocumentContentProvider.mockReturnValue({ dispose() {} });
		subscriptions = [];
		registerAnsi({ subscriptions } as vscode.ExtensionContext);
		provider = host.registerTextDocumentContentProvider.mock.calls[0][1];
		onChange = host.onDidChangeTextDocument.mock.calls[0][0];
		notifications = vi.fn();
		subscriptions.push(provider.onDidChange!(notifications));
	});

	afterEach(() => {
		for (const subscription of subscriptions) subscription.dispose();
		vi.useRealTimers();
	});

	async function watch(name: string): Promise<vscode.TextDocument> {
		const uri = Uri.parse(`file:///${name}`);
		const document = {
			uri,
			languageId: "ansi",
			lineCount: 1,
			lineAt: () => ({ text: "\x1b[31m原始日志" }),
		} as unknown as vscode.TextDocument;
		host.openTextDocument.mockResolvedValue(document);
		await provider.provideTextDocumentContent(
			Uri.parse(`langToolkit.ansi://preview/${name}?${encodeURIComponent(uri.toString())}`),
			{} as vscode.CancellationToken
		);
		return document;
	}

	it("持续追加时定期更新, 停止后保留最后一次变更", async () => {
		const document = await watch("continuous.log");
		for (let index = 0; index < 10; index += 1) {
			onChange({ document });
			vi.advanceTimersByTime(100);
		}
		expect(notifications).toHaveBeenCalledTimes(3);
		vi.advanceTimersByTime(200);
		expect(notifications).toHaveBeenCalledTimes(4);
	});

	it("切换源文件语言后仍同步已有预览, 无关文档不触发更新", async () => {
		const document = await watch("source.log");
		onChange({ document: { ...document, languageId: "plaintext" } });
		onChange({
			document: {
				...document,
				uri: Uri.parse("file:///unwatched.ts"),
				languageId: "typescript",
			},
		});
		vi.advanceTimersByTime(300);
		expect(notifications).toHaveBeenCalledTimes(1);
		expect(notifications.mock.calls[0][0].query).toBe(
			encodeURIComponent(document.uri.toString())
		);
	});

	it("多个预览分别合并更新, 释放时取消待发通知", async () => {
		const first = await watch("first.log");
		const second = await watch("second.log");
		onChange({ document: first });
		vi.advanceTimersByTime(100);
		onChange({ document: second });
		vi.advanceTimersByTime(200);
		expect(notifications).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(100);
		expect(notifications).toHaveBeenCalledTimes(2);
		onChange({ document: first });
		for (const subscription of subscriptions) subscription.dispose();
		subscriptions = [];
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(300);
		expect(notifications).toHaveBeenCalledTimes(2);
	});
});
