import * as vscode from "vscode";
import * as path from "node:path";
import { CommandIndex } from "./indexer";
import { scanCommands } from "./parser";

function isOffsetInsideCommentOrLiteral(text: string, offset: number): boolean {
  // Use a lightweight approach: re-scan and see whether there is a command token that spans this offset.
  // If we find no token spanning offset, we won't offer arg completion.
  // (This is good enough as MVP.)
  const toks = scanCommands(text);
  return !toks.some(t => offset >= t.startOffset && offset <= t.endOffset);
}


export interface CommandContext {
  command: string;
  // everything after ":" up to "}" (may be partial if user is typing)
  argText: string;
  // range of the arg text (the portion after ":"), for replacement
  argRange: vscode.Range;
  // full block range including braces
  blockRange: vscode.Range;
}





function completion(
  label: string,
  kind: vscode.CompletionItemKind,
  insertText: string | vscode.SnippetString,
  detail?: string,
  documentation?: string
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(label, kind);
  item.insertText = insertText;
  if (detail) item.detail = detail;
  if (documentation) item.documentation = new vscode.MarkdownString(documentation);
  return item;
}

// Suggest .sh1 paths for {import:...}
async function provideImportArgCompletions(doc: vscode.TextDocument): Promise<vscode.CompletionItem[]> {
  const items: vscode.CompletionItem[] = [];

  // Suggest relative paths to .sh1 files in the workspace
  const uris = await vscode.workspace.findFiles("**/*.sh1", "**/node_modules/**", 200);

  const fromDir = path.dirname(doc.uri.fsPath);

  for (const u of uris) {
    const rel = path.relative(fromDir, u.fsPath).replace(/\\/g, "/");
    items.push(
      completion(
        rel,
        vscode.CompletionItemKind.File,
        rel,
        "Scraphand file",
        `Import \`${rel}\``
      )
    );
  }

  return items;
}

// Suggest keys/operators for {config:...}
function provideConfigArgCompletions(): vscode.CompletionItem[] {
  const items: vscode.CompletionItem[] = [];

  // Common keys (customize as your schema evolves)
  const keys = [
    "importing.rootdir",
    "importing.paths",
    "plugins",
    "outputs",
    "bibliography.style",
  ];

  // Operators and patterns
  const opSnippets = [
    { label: "=", snippet: new vscode.SnippetString("${1:key}=${2:value}") },
    { label: "+=", snippet: new vscode.SnippetString("${1:listKey}+=${2:value}") },
    { label: "-=", snippet: new vscode.SnippetString("${1:listKey}-=${2:value}") },
    { label: "!=", snippet: new vscode.SnippetString("${1:key}!=${2:value}") },
    { label: "!= (reset)", snippet: new vscode.SnippetString("${1:key}!=") },
  ];

  

  for (const k of keys) {

    items.push(
    completion(
        `${k}=...`,
        vscode.CompletionItemKind.Property,
        new vscode.SnippetString(`${k}=\${1:value}`),
        "Config set"
    )
    );

    items.push(
    completion(
        `${k}+=...`,
        vscode.CompletionItemKind.Property,
        new vscode.SnippetString(`${k}+=\${1:value}`),
        "Config append"
    )
    );

    items.push(
    completion(
        `${k}-=...`,
        vscode.CompletionItemKind.Property,
        new vscode.SnippetString(`${k}-=\${1:value}`),
        "Config remove"
    )
    );

    items.push(
    completion(
        `${k}!= (reset)`,
        vscode.CompletionItemKind.Property,
        new vscode.SnippetString(`${k}!=`),
        "Config reset"
    )
    );
        

    }
return items;

}


// Suggest metadata keys for {define:...}
function provideDefineArgCompletions(): vscode.CompletionItem[] {
  const items: vscode.CompletionItem[] = [];

  // Full snippet (useful when starting a define)
  items.push(
    completion(
      'name,doc="...",args="..."',
      vscode.CompletionItemKind.Snippet,
      new vscode.SnippetString('${1:name},doc="${2:Documentation...}",args="${3:argsHint}"'),
      "Define metadata",
      'Recommended: `{define:name,doc="...",args="..."}`\n'

    )
  );

  // If they’re already after a comma, suggest keys
  items.push(
    completion(
      'doc="..."',
      vscode.CompletionItemKind.Property,
      new vscode.SnippetString('doc="${1:Documentation...}"'),
      "Define doc"
    )
  );
  items.push(
    completion(
      'args="..."',
      vscode.CompletionItemKind.Property,
      new vscode.SnippetString('args="${1:argsHint}"'),
      "Define args hint"
    )
  );

  return items;
}

function provideLibraryArgCompletions(cmdName: string, index: CommandIndex): vscode.CompletionItem[] {
  const info = index.getCommand(cmdName);
  if (!info || info.origin !== "library") return [];

  // If library definition included argsHint, offer it as a snippet for the arg content
  if (info.argsHint && info.argsHint.trim().length) {
    return [
      completion(
        info.argsHint,
        vscode.CompletionItemKind.Snippet,
        new vscode.SnippetString(`\${1:${info.argsHint}}`),
        "Command arguments",
        info.documentation
      ),
    ];
  }

  return [];
}

export function registerArgumentIntellisense(
  context: vscode.ExtensionContext,
  index: CommandIndex
) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "scraphand" },
      {



        async provideCompletionItems(doc, pos) {
          const text = doc.getText();
          const offset = doc.offsetAt(pos);

          // Only offer completions if the cursor is inside a real command token
          const tok = scanCommands(text).find(
            t => offset >= t.startOffset && offset <= t.endOffset
          );
          if (!tok) return [];

          // Must be after ":" to offer argument IntelliSense
          const tokenText = text.slice(tok.startOffset, tok.endOffset); // "{cmd:arg}"
          const colonRel = tokenText.indexOf(":");
          if (colonRel === -1) return [];

          const argStartOffset = tok.startOffset + colonRel + 1;
          if (offset < argStartOffset) return [];

          // Keep index in sync
          await index.rebuildForDocument(doc);

          switch (tok.name) {
            case "import":
              return await provideImportArgCompletions(doc);

            case "config":
              return provideConfigArgCompletions();

            case "define":
              return provideDefineArgCompletions();

            default:
              return provideLibraryArgCompletions(tok.name, index);
          }
        }



        
        ,
      },
      ":", ",", "=", "+", "-", "!", "["
    )
  );
}
