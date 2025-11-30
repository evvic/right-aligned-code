import * as vscode from 'vscode';

// Minimal right-align extension: on every text change, insert left padding on
// shorter lines so all lines reach the current longest line length.

export function activate(context: vscode.ExtensionContext) {
    const channel = vscode.window.createOutputChannel('Right-Aligned Code');
    channel.appendLine('Right-Aligned Code: activated');

    let isApplyingEdits = false;
    const DEBOUNCE_MS = 50; // lower debounce (was 200ms) — tuneable
    // Debounce timers per document URI and last observed max length to avoid
    // running expensive edits on every keystroke (which can make the
    // extension host unresponsive / block save participants).
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const lastMax = new Map<string, number>();

    const listener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (isApplyingEdits) return;
        if (!event.contentChanges || event.contentChanges.length === 0) return;

        const doc = event.document;
        const uri = doc.uri.toString();

        // Schedule a debounced alignment to run shortly after typing stops
        if (timers.has(uri)) {
            clearTimeout(timers.get(uri));
        }
        const timer = setTimeout(async () => {
            timers.delete(uri);

            // Skip closed documents
            if (doc.isClosed) return;

            // Prefer an editor that is showing the document
            let editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
            if (!editor && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === doc) {
                editor = vscode.window.activeTextEditor;
            }
            if (!editor) return;

            try {
                // Compute longest line length
                let maxLen = 0;
                for (let i = 0; i < doc.lineCount; i++) {
                    const len = doc.lineAt(i).text.length;
                    if (len > maxLen) maxLen = len;
                }

                const prev = lastMax.get(uri) || 0;
                // Only perform edits when max length changes (reduces unnecessary edits)
                if (maxLen === prev) {
                    channel.appendLine(`No change in max length (${maxLen}) for ${uri}`);
                    return;
                }

                // Apply left padding by inserting spaces at column 0 for shorter lines
                isApplyingEdits = true;
                await editor.edit(editBuilder => {
                    for (let i = 0; i < doc.lineCount; i++) {
                        const line = doc.lineAt(i);
                        const pad = maxLen - line.text.length;
                        if (pad > 0) {
                            editBuilder.insert(new vscode.Position(i, 0), ' '.repeat(pad));
                        }
                    }
                });

                lastMax.set(uri, maxLen);
                channel.appendLine(`Applied left padding to reach length ${maxLen} for ${uri}`);
            } catch (err) {
                channel.appendLine('Error during padding: ' + String(err));
            } finally {
                isApplyingEdits = false;
            }
    }, DEBOUNCE_MS);
        timers.set(uri, timer);
    });

    context.subscriptions.push(listener, channel);
}

export function deactivate() {}
