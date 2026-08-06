import * as vscode from 'vscode';

let channel: vscode.LogOutputChannel | undefined;

/**
 * 扩展唯一的输出通道。
 *
 * 用 `LogOutputChannel` 而不是普通 OutputChannel: 它自带时间戳与级别过滤, 且 `trace`/`debug`
 * 默认不显示 —— 后台语法更新这类"成功了也不该打扰人"的日志可以放心写进去。
 */
export function getOutput(): vscode.LogOutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Editor Lang Toolkit', { log: true });
  }
  return channel;
}
