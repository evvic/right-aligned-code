import * as vscode from 'vscode';

// Minimal right-align extension: on every text change, insert left padding on
// shorter lines so all lines reach the current longest line length.

export function activate(context: vscode.ExtensionContext) {
    const channel = vscode.window.createOutputChannel('Right-Aligned Code');
    channel.appendLine('Right-Aligned Code: activated');

    let isApplyingEdits = false;
    const DEBOUNCE_MS = 0; // small debounce to batch very fast keystrokes
    // Debounce timers per document URI to avoid running an edit on every
    // single keystroke. Keep it simple and fast — no document-version
    // checks to avoid extra complexity.
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
        // Named alignment runner — kept simple (no version checks).
        const runAlignment = async () => {
            // Remove the scheduled entry now that the timer fired
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
                // Use the active editor's document (fresh snapshot) so we
                // compute edits and offsets against the most recent content.
                const edoc = editor.document;
                let maxContentLen = 0;
                const contents: number[] = [];
                for (let i = 0; i < edoc.lineCount; i++) {
                    const text = edoc.lineAt(i).text;
                    const leading = text.match(/^\s*/)?.[0]?.length || 0;
                    const contentLen = text.length - leading;
                    contents.push(contentLen);
                    if (contentLen > maxContentLen) maxContentLen = contentLen;
                }

                // Determine edits and per-line deltas.
                const edits: { line: number; replaceRange: vscode.Range; newText: string }[] = [];
                const lineDelta = new Map<number, number>();
                const desiredLeadingByLine = new Map<number, number>();
                for (let i = 0; i < edoc.lineCount; i++) {
                    const text = edoc.lineAt(i).text;
                    const leading = text.match(/^\s*/)?.[0]?.length || 0;
                    const contentLen = contents[i] ?? 0;
                    const desiredLeading = Math.max(0, maxContentLen - contentLen);
                    desiredLeadingByLine.set(i, desiredLeading);
                    if (leading !== desiredLeading) {
                        const newPrefix = ' '.repeat(desiredLeading);
                        const replaceRange = new vscode.Range(i, 0, i, leading);
                        edits.push({ line: i, replaceRange, newText: newPrefix });
                        lineDelta.set(i, desiredLeading - leading);
                    }
                }

                if (edits.length === 0) {
                    lastMax.set(uri, maxContentLen);
                    channel.appendLine(`No padding edits required for ${uri} (max ${maxContentLen})`);
                    return;
                }

                // Capture current selections and compute content offsets so
                // we can anchor the caret to the same character in the line
                // content regardless of leading whitespace changes.
                const oldSelections = editor.selections.map(s => s);
                const offsets: { startOffset: number; endOffset: number }[] = [];
                for (const s of oldSelections) {
                    const startLine = s.start.line;
                    const endLine = s.end.line;
                    const startLeading = edoc.lineAt(startLine).text.match(/^\s*/)?.[0]?.length || 0;
                    const endLeading = edoc.lineAt(endLine).text.match(/^\s*/)?.[0]?.length || 0;
                    const startOffset = Math.max(0, s.start.character - startLeading);
                    const endOffset = Math.max(0, s.end.character - endLeading);
                    offsets.push({ startOffset, endOffset });
                }

                // Apply edits immediately.
                isApplyingEdits = true;
                // Merge our alignment edit with the user's last edit so that
                // undo (Ctrl+Z) will revert both together. We disable the
                // extra undo stops before/after this edit.
                await editor.edit(editBuilder => {
                    for (const e of edits) {
                        editBuilder.replace(e.replaceRange, e.newText);
                    }
                }, { undoStopBefore: false, undoStopAfter: false });

                // Restore selections anchored to content offsets using the
                // desired leading values.
                const newSelections: vscode.Selection[] = [];
                for (let idx = 0; idx < oldSelections.length; idx++) {
                    const s = oldSelections[idx];
                    const startLine = s.start.line;
                    const endLine = s.end.line;
                    const startDesired = desiredLeadingByLine.get(startLine) || 0;
                    const endDesired = desiredLeadingByLine.get(endLine) || 0;
                    const startOffset = offsets[idx].startOffset;
                    const endOffset = offsets[idx].endOffset;
                    const newStartCol = Math.max(0, startDesired + startOffset);
                    const newEndCol = Math.max(0, endDesired + endOffset);
                    const newStartLineLen = editor.document.lineAt(startLine).text.length;
                    const newEndLineLen = editor.document.lineAt(endLine).text.length;
                    const clampedStart = Math.min(newStartCol, newStartLineLen);
                    const clampedEnd = Math.min(newEndCol, newEndLineLen);
                    newSelections.push(new vscode.Selection(new vscode.Position(startLine, clampedStart), new vscode.Position(endLine, clampedEnd)));
                }

                try {
                    editor.selections = newSelections;
                } catch (err) {
                    channel.appendLine('Failed to restore selections: ' + String(err));
                }

                lastMax.set(uri, maxContentLen);
                channel.appendLine(`Applied ${edits.length} padding edits with cursor preservation to align to ${maxContentLen} for ${uri}`);
            } catch (err) {
                channel.appendLine('Error during padding: ' + String(err));
            } finally {
                isApplyingEdits = false;
            }
        }

        const timeout = setTimeout(() => runAlignment(), DEBOUNCE_MS);
        timers.set(uri, timeout);
    });

    context.subscriptions.push(listener, channel);
}

export function deactivate() {}
