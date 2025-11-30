import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const channel = vscode.window.createOutputChannel('Right-Aligned Code');
    
    // State to manage the update loop and prevent infinite recursion
    let isApplyingEdits = false;
    let needsRerun = false; 
    
    // A small debounce (10-15ms) prevents the extension host from choking 
    // on extremely fast burst typing (like key repeats).
    const DEBOUNCE_MS = 15; 
    const timers = new Map<string, NodeJS.Timeout>();

    const listener = vscode.workspace.onDidChangeTextDocument((event) => {
        // If we are currently editing the document, we ignore the event 
        // effectively (it's our own edit), BUT if the user typed *during* // our edit, we need to know so we can run again immediately.
        if (isApplyingEdits) {
            // We can't easily distinguish our edit from a user edit here 
            // without complex change comparison, so we assume if an event 
            // comes in while we are busy, we might need to verify alignment again.
            needsRerun = true;
            return;
        }

        if (!event.contentChanges.length) return;

        const doc = event.document;
        const uri = doc.uri.toString();

        if (timers.has(uri)) {
            clearTimeout(timers.get(uri));
        }

        const runAlignment = async () => {
            timers.delete(uri);
            if (doc.isClosed) return;

            // Find the editor for this document
            let editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
            if (!editor && vscode.window.activeTextEditor?.document === doc) {
                editor = vscode.window.activeTextEditor;
            }
            if (!editor) return;

            try {
                isApplyingEdits = true;
                
                // --- 1. Calculate Max Length ---
                // We do this inside the loop to capture the very latest state
                const edoc = editor.document;
                const lineCount = edoc.lineCount;
                let maxContentLen = 0;
                const lineContents: { text: string, leading: number, contentLen: number }[] = [];

                for (let i = 0; i < lineCount; i++) {
                    const text = edoc.lineAt(i).text;
                    // Get length of leading whitespace
                    const leading = text.match(/^\s*/)?.[0].length || 0;
                    const contentLen = text.length - leading;
                    lineContents.push({ text, leading, contentLen });
                    if (contentLen > maxContentLen) maxContentLen = contentLen;
                }

                // --- 2. Calculate Edits ---
                const edits: { range: vscode.Range, newText: string }[] = [];
                
                for (let i = 0; i < lineCount; i++) {
                    const { leading, contentLen } = lineContents[i];
                    const desiredLeading = Math.max(0, maxContentLen - contentLen);

                    if (leading !== desiredLeading) {
                        // Create a specific Range for the whitespace only
                        const range = new vscode.Range(i, 0, i, leading);
                        const newText = ' '.repeat(desiredLeading);
                        edits.push({ range, newText });
                    }
                }

                if (edits.length === 0) {
                    isApplyingEdits = false;
                    return;
                }

                // --- 3. Apply Edits ---
                // We use undoStopBefore/After: false to group this with the user's typing
                // in the undo stack.
                await editor.edit(editBuilder => {
                    for (const e of edits) {
                        editBuilder.replace(e.range, e.newText);
                    }
                }, { undoStopBefore: false, undoStopAfter: false });

                // CRITICAL FIX: We do NOT manually restore selections here.
                // VS Code's editBuilder automatically shifts the cursor if we 
                // inserted/deleted text before it.

            } catch (err) {
                channel.appendLine('Error aligning: ' + err);
            } finally {
                isApplyingEdits = false;
                
                // If the user typed *while* we were awaiting editor.edit,
                // we missed that calculation. Run it again immediately.
                if (needsRerun) {
                    needsRerun = false;
                    // Schedule immediately
                    timers.set(uri, setTimeout(runAlignment, 0));
                }
            }
        };

        timers.set(uri, setTimeout(runAlignment, DEBOUNCE_MS));
    });

    context.subscriptions.push(listener, channel);
}

export function deactivate() {}