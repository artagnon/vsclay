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
  SnippetString,
} from "vscode";
import * as vscode from "vscode";
import { readFileSync } from "fs";

abstract class Extension {
  protected extensionRoot: string;
  protected symbols: Object;
  protected commands: Object;
  protected allObjs: Object;
  constructor(extensionRoot: string) {
    this.extensionRoot = extensionRoot;
    this.symbols = JSON.parse(
      readFileSync(`${this.extensionRoot}/data/symbols.json`, {
        encoding: "utf8",
      })
    );
    this.commands = JSON.parse(
      readFileSync(`${this.extensionRoot}/data/commands.json`, {
        encoding: "utf8",
      })
    );
    this.allObjs = { ...this.symbols, ...this.commands };
  }
}

interface SymbolEntry {
  command: string;
  detail?: string;
  documentation?: string;
}

interface CommandEntry extends SymbolEntry {
  snippet: string;
}

function isCommandEntry(obj: any): obj is CommandEntry {
  return typeof obj.command == "string" && typeof obj.snippet == "string";
}

function snippetString(obj: CommandEntry): SnippetString {
  return new SnippetString(obj.snippet);
}

function containsDoc(obj: any): obj is SymbolEntry {
  return typeof obj.detail == "string" || typeof obj.documentation == "string";
}

function docString(obj: SymbolEntry) {
  return (
    (obj.detail ? obj.detail?.toString() + "\n--\n" : "") +
    (obj.documentation ? obj.documentation?.toString() : "")
  );
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
    const snippets = new Map(
      Object.entries(this.commands)
        .filter(([_, v]) => isCommandEntry(v))
        .map(([k, v]) => [k, snippetString(v)])
    );
    const symbolSuggestions = Object.keys(this.symbols).map(
      (k) => new CompletionItem(k, vscode.CompletionItemKind.Variable)
    );
    const snippetSuggestions = Object.keys(this.commands).map(
      (k) => new CompletionItem(k, vscode.CompletionItemKind.Function)
    );
    snippetSuggestions.forEach((i) => (i.insertText = snippets.get(i.label)));
    return symbolSuggestions.concat(snippetSuggestions);
  }
}

class Hoverer extends Extension implements HoverProvider {
  constructor(extensionRoot: string) {
    super(extensionRoot);
  }
  provideHover(
    document: TextDocument,
    position: Position,
    _: CancellationToken
  ): Hover | null {
    const tok = document.getText(document.getWordRangeAtPosition(position));
    const matchingEntries = Object.entries(this.allObjs).filter(
      ([k, _]) => k == tok
    );
    if (matchingEntries.length == 0) return null;
    const match = matchingEntries[0][1];
    return containsDoc(match) ? new Hover(docString(match)) : null;
  }
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: "file", language: "claytext" },
      new Completer(context.extensionPath),
      "\\"
    )
  );
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { scheme: "file", language: "claytext" },
      new Hoverer(context.extensionPath)
    )
  );
}
