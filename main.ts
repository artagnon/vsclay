import {
  Position,
  CompletionItemProvider,
  CompletionItem,
  CancellationToken,
  TextDocument,
  CompletionContext,
  ExtensionContext,
} from 'vscode';
import * as vscode from 'vscode';
import { readFileSync } from 'fs';

class Completer implements CompletionItemProvider {
  private extensionRoot: string;

  constructor(extensionRoot: string) {
    this.extensionRoot = extensionRoot;
  }
  provideCompletionItems(
    _doc: TextDocument,
    _pos: Position,
    _tok: CancellationToken,
    _ctx: CompletionContext
  ): CompletionItem[] {
    const symbols = JSON.parse(readFileSync(`${this.extensionRoot}/data/symbols.json`, { encoding: 'utf8' }));
    const commands = JSON.parse(readFileSync(`${this.extensionRoot}/data/commands.json`, { encoding: 'utf8' }));
    const keys = Object.keys(symbols).concat(Object.keys(commands));
    return keys.map((k) => new CompletionItem(k));
  }
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', language: 'claytext' },
      new Completer(context.extensionPath),
      '\\'
    )
  );
}
