import {
  Position,
  CompletionItemProvider,
  HoverProvider,
  CompletionItem,
  Hover,
  CancellationToken,
  TextDocument,
  CompletionContext,
  ExtensionContext,
} from 'vscode';
import * as vscode from 'vscode';
import { readFileSync } from 'fs';

abstract class Extension {
  protected extensionRoot: string;
  protected symbols: Object;
  protected commands: Object;
  protected allObjs: Object;
  constructor(extensionRoot: string) {
    this.extensionRoot = extensionRoot;
    this.symbols = JSON.parse(readFileSync(`${this.extensionRoot}/data/symbols.json`, { encoding: 'utf8' }));
    this.commands = JSON.parse(readFileSync(`${this.extensionRoot}/data/commands.json`, { encoding: 'utf8' }));
    this.allObjs = { ...this.symbols, ...this.commands };
  }
}

class Completer extends Extension implements CompletionItemProvider {
  constructor(extensionRoot: string) {
    super(extensionRoot);
  }
  provideCompletionItems(
    _doc: TextDocument,
    _pos: Position,
    _tok: CancellationToken,
    _ctx: CompletionContext
  ): CompletionItem[] {
    const keys = Object.keys(this.symbols).concat(Object.keys(this.commands));
    return keys.map((k) => new CompletionItem(k));
  }
}

class Hoverer extends Extension implements HoverProvider {
  constructor(extensionRoot: string) {
    super(extensionRoot);
  }
  provideHover(document: TextDocument, position: Position, _: CancellationToken): Hover | null {
    const tok = document.getText(document.getWordRangeAtPosition(position));
    const matchingEntries = Object.entries(this.allObjs).filter(([k, _]) => k == tok);
    if (matchingEntries.length == 0) return null;
    const match: Map<string, string> = new Map(Object.entries(matchingEntries[0][1]));
    const detail = match.get('detail');
    const documentation = match.get('documentation');
    if (!detail && !documentation) return null;
    const doc = (detail ? detail?.toString() + '\n--\n' : '') + (documentation ? documentation?.toString() : '');
    return new Hover(doc);
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
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: 'file', language: 'claytext' }, new Hoverer(context.extensionPath))
  );
}
