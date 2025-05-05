import * as vscode from 'vscode';

export function splitLineByVerticalBars(line: string): Array<string> {
    return line.split('|');
}

// Check if any line has its annotaion part
export function isAnnotative(document: vscode.TextDocument) {
    return [...Array(document.lineCount)]
        .map((_, i) => i)
        .map(i => splitLineByVerticalBars(document.lineAt(i).text))
        .some(elems => elems.length > 3);
}

// Allow the line to be incomplete
export function isPossiblyAnnotativeScopeStartLine(elements: Array<string>): boolean {
    return (elements[0].trim() !== "") || (elements.length > 1 && elements[1].trim() !== "");
}

export function isPossiblyNonannotativeScopeStartLine(elements: Array<string>): boolean {
    return elements.length > 0 && elements[0].trim() !== "";
}

export async function formatDocument() {
    await vscode.commands.executeCommand("editor.action.formatDocument");
}

export function editAllLines(action: (editBuilder: vscode.TextEditorEdit, textLine: vscode.TextLine) => void): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const document = editor.document;
    const lineCount = document.lineCount;
    editor.edit(editBuilder => {
        for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
            const textLine = document.lineAt(lineIndex);
            action(editBuilder, textLine);
        }
    });
}

// Get all text lines in scopes any of whose lines overlaps the selection
export function getAllScopeTextLinesInSelection(editor: vscode.TextEditor, isAnnotative: boolean): Array<vscode.TextLine> {
    const document = editor.document;
    const selection = editor.selection;
    const start = selection.start;
    const end = selection.end;
    const textLines: Array<vscode.TextLine> = [];
    for (let lineNumber = end.line; lineNumber >= 0; lineNumber--) {
        const textLine = document.lineAt(lineNumber);
        const elements = splitLineByVerticalBars(textLine.text);
        textLines.push(textLine);
        if (lineNumber <= start.line && (isAnnotative ? isPossiblyAnnotativeScopeStartLine(elements) : isPossiblyNonannotativeScopeStartLine(elements))) {
            break;
        }
    }
    return textLines.reverse();
}

export function getAllPossiblyScopeStartLinesInSelection(editor: vscode.TextEditor, isAnnotative: boolean): Array<vscode.TextLine> {
    return getAllScopeTextLinesInSelection(editor, isAnnotative)
        .filter(textLine => {
            const elements = splitLineByVerticalBars(textLine.text);
            return isAnnotative ? isPossiblyAnnotativeScopeStartLine(elements) : isPossiblyNonannotativeScopeStartLine(elements);
        });
}

export function showError(message: string): void {
    vscode.window.showErrorMessage(message);
}