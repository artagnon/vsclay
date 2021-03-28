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
  protected environments: Object;
  constructor(extensionRoot: string) {
    this.extensionRoot = extensionRoot;
    this.symbols = JSON.parse(readFileSync(`${this.extensionRoot}/data/symbols.json`, { encoding: "utf8" }));
    this.commands = JSON.parse(readFileSync(`${this.extensionRoot}/data/commands.json`, { encoding: "utf8" }));
    this.allObjs = { ...this.symbols, ...this.commands };
    this.environments = JSON.parse(readFileSync(`${this.extensionRoot}/data/environments.json`, { encoding: "utf8" }));
  }
}

interface DocumentEntry {
  detail?: string;
  documentation?: string;
}

interface CommandEntry extends DocumentEntry {
  snippet: string;
}

function snippetString(obj: CommandEntry): SnippetString {
  return new SnippetString(obj.snippet);
}

function containsDoc(obj: any): obj is DocumentEntry {
  return typeof obj.detail == "string" || typeof obj.documentation == "string";
}

function docString(obj: DocumentEntry) {
  return (obj.detail ? obj.detail?.toString() + "\n--\n" : "") + (obj.documentation ? obj.documentation?.toString() : "");
}

class Completer extends Extension implements CompletionItemProvider {
  constructor(extensionRoot: string) {
    super(extensionRoot);
  }

  provideCompletionItems(doc: TextDocument, pos: Position, _tok: CancellationToken, ctx: CompletionContext): CompletionItem[] | null {
    const currentLine = doc.lineAt(pos.line).text;
    if (ctx.triggerCharacter == "{" || currentLine[pos.character - 1] == "{") {
      if (doc.getText(doc.getWordRangeAtPosition(pos.translate(0, -2))) != "begin") return null;
      const docStrings = new Map(Object.entries(this.environments).map(([k, v]) => [k, docString(v)]));
      const suggestions = Object.keys(this.environments).map((k) => new CompletionItem(k, vscode.CompletionItemKind.Constant));
      suggestions.forEach((s) => (s.detail = docStrings.get(s.label)));
      return suggestions;
    }
    const snippets = new Map(Object.entries(this.commands).map(([k, v]) => [k, snippetString(v)]));
    const docStrings = new Map(Object.entries(this.allObjs).map(([k, v]) => [k, docString(v)]));
    const suggestions = Object.keys(this.allObjs).map((k) => new CompletionItem(k, vscode.CompletionItemKind.Function));
    suggestions.forEach((s) => {
      s.insertText = snippets.get(s.label);
      if (s.label == "begin") s.command = { command: "editor.action.triggerSuggest", title: "Re-trigger suggestions" };
      s.detail = docStrings.get(s.label);
    });
    return suggestions;
  }
}

class Hoverer extends Extension implements HoverProvider {
  constructor(extensionRoot: string) {
    super(extensionRoot);
  }
  provideHover(document: TextDocument, position: Position, _: CancellationToken): Hover | null {
    const tok = document.getText(document.getWordRangeAtPosition(position));
    const matchingEntries = Object.entries(this.allObjs)
      .filter(([k, _]) => k == tok)
      .map(([_, v]) => v);
    if (matchingEntries.length == 0) return null;
    const match = matchingEntries[0];
    return containsDoc(match) ? new Hover(docString(match)) : null;
  }
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: "file", language: "claytext" },
      new Completer(context.extensionPath),
      "\\",
      "{"
    )
  );
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: "file", language: "claytext" }, new Hoverer(context.extensionPath))
  );
}
