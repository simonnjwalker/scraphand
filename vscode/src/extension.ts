import * as vscode from "vscode";
import { parse } from "engine";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("scraphand.showAst", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("No active editor.");
      return;
    }

    const doc = editor.document;
    const text = doc.getText();

    // We pass the filename so parse() does not auto-print to console
    const ast = parse(text, doc.fileName);

    // Show the AST in an output channel (nice for dev)
    const out = vscode.window.createOutputChannel("Scraphand");
    out.clear();
    out.appendLine(JSON.stringify(ast, null, 2));
    out.show(true);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // nothing to do
}
