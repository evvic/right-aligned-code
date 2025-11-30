// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

/**
 * Calculates the nth Fibonacci number.
 * @param {number} n The index in the Fibonacci sequence (0-indexed).
 * @returns {number} The Fibonacci number.
 */
function fibonacci(n: number): number {
    if (n <= 1) {
        return n;
    }
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
        let temp = a + b;
        a = b;
        b = temp;
    }
    return b;
}

/**
 * Given an indentation depth, returns the number of spaces for Right-Aligned Code.
 * Maps depth 1 to F_3 (2 spaces), depth 2 to F_4 (3 spaces), etc.
 * @param {number} depth The current logical indentation depth (e.g., 0 for no indent, 1 for first level).
 * @returns {number} The number of spaces for the given depth.
 */
function getFibonacciSpacesForDepth(depth: number): number {
    // If depth is 0, no spaces.
    if (depth === 0) {
        return 0;
    }
    // Multiplier for each Fibonacci indentation level
    const multiplier = 2;
    // Custom mapping: depth 1 → F_2 (1), depth 2 → F_3 (2), depth 3 → F_4 (3), depth 4 → F_5 (5), ...
    // But skip the repeated 1 in Fibonacci (i.e., start at F_2)
    // So, depth 1 → F_2, depth 2 → F_3, depth 3 → F_4, depth 4 → F_5, ...
    // This gives: 2, 4, 6, 10, ...
    const fibIndex = depth + 1;
    return fibonacci(fibIndex) * multiplier;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    console.log('Extension "right-aligned-code" is now active!');

    // Register a command to right-align the document (uses the existing activation name)
    let disposableTab = vscode.commands.registerCommand('right-aligned-code.indent', () => {
        alignDocument(); // Align all lines to the right
    });

    // Register a command to remove one leading space per line (simple outdent/undo)
    let disposableShiftTab = vscode.commands.registerCommand('right-aligned-code.outdent', () => {
        unalignDocument(); // Remove one leading space from each line if present
    });

    context.subscriptions.push(disposableTab, disposableShiftTab);

    // Keep track of edits we make so we can ignore recursive change events
    let isApplyingEdits = false;

    // Listen for document changes so we can update padding live as the user types.
    const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
        // Ignore if the change was originated from our own edit
        if (isApplyingEdits) {
            return;
        }

        // Find a visible editor for the changed document
        const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
        if (!editor) {
            return;
        }

        try {
            // Compute max line length for the document
            const doc = event.document;
            let maxLength = 0;
            for (let i = 0; i < doc.lineCount; i++) {
                const len = doc.lineAt(i).text.length;
                if (len > maxLength) maxLength = len;
            }

            // If all lines already match maxLength, nothing to do
            let needEdit = false;
            for (let i = 0; i < doc.lineCount; i++) {
                const len = doc.lineAt(i).text.length;
                if (len < maxLength) { needEdit = true; break; }
            }
            if (!needEdit) return;

            // Apply edits to pad shorter lines to the max length
            isApplyingEdits = true;
            await editor.edit(editBuilder => {
                for (let i = 0; i < doc.lineCount; i++) {
                    const line = doc.lineAt(i);
                    const pad = maxLength - line.text.length;
                    if (pad > 0) {
                        editBuilder.insert(new vscode.Position(i, 0), ' '.repeat(pad));
                    }
                }
            });
        } catch (err) {
            // Swallow errors; avoid crashing the host
            console.error('Error applying right-align edits:', err);
        } finally {
            isApplyingEdits = false;
        }
    });

    context.subscriptions.push(changeListener);
}

/**
 * Applies Fibonacci indentation or de-indentation to the selected lines.
 * @param {boolean} isTab True for indenting (Tab), false for de-indenting (Shift+Tab).
 */
/**
 * Aligns the active document to the right by inserting left padding so every line's
 * right edge (final character column) matches the longest line in the document.
 */
async function alignDocument() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const lineCount = document.lineCount;

    // Compute the maximum length among all lines (including existing leading spaces)
    let maxLength = 0;
    for (let i = 0; i < lineCount; i++) {
        const text = document.lineAt(i).text;
        if (text.length > maxLength) {
            maxLength = text.length;
        }
    }

    // Insert left padding on each line so right edges line up at maxLength
    await editor.edit(editBuilder => {
        for (let i = 0; i < lineCount; i++) {
            const line = document.lineAt(i);
            const currentText = line.text;
            const pad = maxLength - currentText.length;
            if (pad > 0) {
                editBuilder.insert(new vscode.Position(i, 0), ' '.repeat(pad));
            }
        }
    });

    // Reveal top of document after aligning
    const top = new vscode.Range(0, 0, 0, 0);
    editor.revealRange(top, vscode.TextEditorRevealType.AtTop);
}

/**
 * Removes one leading space from every line that starts with a space.
 * This is a simple 'undo' operation for the left padding added by alignDocument.
 */
async function unalignDocument() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const lineCount = document.lineCount;

    await editor.edit(editBuilder => {
        for (let i = 0; i < lineCount; i++) {
            const line = document.lineAt(i);
            if (line.text.length > 0 && line.text[0] === ' ') {
                // Delete the first character
                const delRange = new vscode.Range(i, 0, i, 1);
                editBuilder.delete(delRange);
            }
        }
    });

    // Reveal top of document after unaligning
    const top = new vscode.Range(0, 0, 0, 0);
    editor.revealRange(top, vscode.TextEditorRevealType.AtTop);
}

// This method is called when your extension is deactivated
export function deactivate() {}
