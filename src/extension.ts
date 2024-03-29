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
    this.environments = JSON.parse(
      readFileSync(`${this.extensionRoot}/data/environments.json`, {
        encoding: "utf8",
      })
    );
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

function docString(obj: DocumentEntry): string {
  return (
    (obj.detail ? obj.detail?.toString() + "\n--\n" : "") +
    (obj.documentation ? obj.documentation?.toString() : "")
  );
}

function strFnMap<T>(obj: Object, fn: (param: CommandEntry) => T) {
  return new Map(Object.entries(obj).map(([k, v]) => [k, fn(v)]));
}

class Completer extends Extension implements CompletionItemProvider {
  constructor(extensionRoot: string) {
    super(extensionRoot);
  }

  provideCompletionItems(
    doc: TextDocument,
    pos: Position,
    _tok: CancellationToken,
    ctx: CompletionContext
  ): CompletionItem[] | null {
    if (ctx.triggerCharacter == "{") {
      if (
        doc.getText(doc.getWordRangeAtPosition(pos.translate(0, -2))) != "begin"
      )
        return null;
      const docStrings = strFnMap(this.environments, docString);
      const suggestions = Object.keys(this.environments).map(
        (k) => new CompletionItem(k, vscode.CompletionItemKind.Constant)
      );
      suggestions.forEach(
        (s) => (s.detail = docStrings.get(s.label as string))
      );
      return suggestions;
    }
    if (ctx.triggerCharacter != "\\")
      return null;
    const snippets = strFnMap(this.commands, snippetString);
    const docStrings = strFnMap(this.allObjs, docString);
    const suggestions = Object.keys(this.allObjs).map(
      (k) => new CompletionItem(k, vscode.CompletionItemKind.Function)
    );
    suggestions.forEach((s) => {
      s.insertText = snippets.get(s.label as string);
      if (s.label == "begin")
        s.command = {
          command: "editor.action.triggerSuggest",
          title: "Re-trigger suggestions",
        };
      s.detail = docStrings.get(s.label as string);
    });
    return suggestions;
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
    vscode.languages.registerHoverProvider(
      { scheme: "file", language: "claytext" },
      new Hoverer(context.extensionPath)
    )
  );
}
