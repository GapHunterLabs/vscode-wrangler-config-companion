import * as vscode from 'vscode';
import { parseWranglerToml, findViolations } from './wranglerConfig';
import { recordHit } from './reviewPrompt';

let diagnostics: vscode.DiagnosticCollection;

function refresh(context: vscode.ExtensionContext, document: vscode.TextDocument): void {
  if (!document.uri.path.endsWith('wrangler.toml')) {
    diagnostics.delete(document.uri);
    return;
  }

  const doc = parseWranglerToml(document.getText());
  const violations = findViolations(doc);

  const result = violations.map((violation) => {
    const range = new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER);
    const diagnostic = new vscode.Diagnostic(range, violation.message, vscode.DiagnosticSeverity.Warning);
    diagnostic.source = 'Wrangler Config Companion';
    diagnostic.code = violation.kind;
    recordHit(context, `${document.uri.toString()}:${violation.kind}`);
    return diagnostic;
  });
  diagnostics.set(document.uri, result);
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('wranglerConfigCompanion');
  context.subscriptions.push(diagnostics);

  vscode.workspace.textDocuments.forEach((document) => refresh(context, document));

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => refresh(context, document)),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(context, event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
}
