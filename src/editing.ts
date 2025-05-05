import * as vscode from 'vscode';
import { getCommandArgSnippet } from './setting';
import { getDialogueArgSnippet } from './setting';
import * as util from './util';

const macroConfigIdMap = new Map<string, string>([
    ["#command", "commandMacroSnippet"],
    ["#xcommand", "xcommandMacroSnippet"],
    ["#token", "tokenMacroSnippet"],
    ["#define", "defineMacroSnippet"],
    ["#label", "labelMacroSnippet"]
]);

type ArgSnippetBasis = {
    lineNumber: number,
    snippets: Array<string>
};

function findPossiblyScopeStartTextLineAbove(editor: vscode.TextEditor, isAnnotative: boolean): vscode.TextLine | undefined {
    const document = editor.document;
    for (let lineNumber = editor.selection.active.line; lineNumber >= 0; lineNumber--) {
        const textLine = document.lineAt(lineNumber);
        const elements = util.splitLineByVerticalBars(textLine.text);
        if (isAnnotative ? util.isPossiblyAnnotativeScopeStartLine(elements) : util.isPossiblyNonannotativeScopeStartLine(elements)) {
            return textLine;
        }
    }
    return undefined;
}

function findNextPossiblyScopeStartLineNumber(document: vscode.TextDocument, startLineNumber: number, isAnnotative: boolean): number {
    for (let lineNumber = startLineNumber + 1; lineNumber < document.lineCount; lineNumber++) {
        const text = document.lineAt(lineNumber).text;
        const elements = util.splitLineByVerticalBars(text);
        if (isAnnotative ? util.isPossiblyAnnotativeScopeStartLine(elements) : util.isPossiblyNonannotativeScopeStartLine(elements)) {
            return lineNumber;
        }
    }
    // If the next scope start line is not found, return the number of virtual line after the end of line
    return document.lineCount;
}

function findLatestXCommandNameAbove(editor: vscode.TextEditor, isAnnotative: boolean): string | undefined {
    const document = editor.document;
    const xCommandStartTextLine = findLatestXCommandStartTextLine();
    if (!xCommandStartTextLine) {
        util.showError("No '#xcommand' scope was found above.");
        return undefined;
    }
    const args = extractArguments(xCommandStartTextLine);
    if (args.length !== 1) {
        util.showError(`Make sure the '#xcommand' scope at line ${xCommandStartTextLine.lineNumber + 1} has a single argument.`);
        return undefined;
    }
    return args[0].trim();

    function findLatestXCommandStartTextLine(): vscode.TextLine | undefined {
        for (let lineNumber = editor.selection.active.line; lineNumber >= 0; lineNumber--) {
            const textLine = document.lineAt(lineNumber);
            const elements = util.splitLineByVerticalBars(textLine.text);
            const declaratorRegion = isAnnotative ? 1 : 0;
            const declarator = declaratorRegion < elements.length ? elements[declaratorRegion].trim() : "";
            if (declarator === "#xcommand") {
                return textLine;
            }
        }
        return undefined;
    }

    function extractArguments(startTextLine: vscode.TextLine): Array<string> {
        const args: Array<string> = [];
        const argRegex = /\{(.*?)\}/g;
        for (let lineNumber = startTextLine.lineNumber; lineNumber < document.lineCount; lineNumber++) {
            const textLine = document.lineAt(lineNumber);
            const elements = util.splitLineByVerticalBars(textLine.text);
            if (startTextLine.lineNumber < lineNumber && (isAnnotative ? util.isPossiblyAnnotativeScopeStartLine(elements) : util.isPossiblyNonannotativeScopeStartLine(elements))) {
                break;
            }
            const contentRegion = isAnnotative ? 2 : 1;
            const content = contentRegion < elements.length ? elements[contentRegion] : "";
            const argMatches = content.matchAll(argRegex);
            for (const match of argMatches) {
                args.push(match[1]);
            }
        }
        return args;
    }
}

function getMacroArgSnippetBasis(startTextLine: vscode.TextLine, isAnnotative: boolean): ArgSnippetBasis | undefined {
    const elements = util.splitLineByVerticalBars(startTextLine.text);
    const macroName = (isAnnotative ? elements[1] : elements[0]).trim();
    // Convert the macro name to the corresponding configuration ID
    const macroConfigurationId = macroConfigIdMap.get(macroName);
    if (!macroConfigurationId) {
        util.showError(`Unknown macro: '${macroName}'`);
        return undefined;
    }
    // Get the snippet from the configuration
    const configuration = vscode.workspace.getConfiguration("SFText Utility");
    const snippet = configuration.get<string>(macroConfigurationId);
    if (!snippet) {
        util.showError("An unexpected error happened when trying to get the macro snippet.");
        return;
    }
    // Create the snippet basis
    const argSnippetBasis: ArgSnippetBasis = {
        lineNumber: startTextLine.lineNumber,
        snippets: [snippet]
    };
    return argSnippetBasis;
}

function getCommandArgSnippetBasis(startTextLine: vscode.TextLine, isAnnotative: boolean): ArgSnippetBasis | undefined {
    const elements = util.splitLineByVerticalBars(startTextLine.text);
    const commandNameRegion = isAnnotative ? 2 : 1;
    const commandName = elements.length > commandNameRegion ? elements[commandNameRegion].trim() : "";
    const snippets = getCommandArgSnippet(commandName);
    if (!snippets) {
        util.showError(`Unknown command: '${commandName}'`);
        return undefined;
    }
    const argSnippetBasis: ArgSnippetBasis = {
        lineNumber: startTextLine.lineNumber + 1,
        snippets: [...snippets]
    };
    return argSnippetBasis;
}

function getDialogueArgSnippetBasis(editor: vscode.TextEditor, startTextLine: vscode.TextLine, isAnnotative: boolean): ArgSnippetBasis | undefined {
    const xCommandName = findLatestXCommandNameAbove(editor, isAnnotative);
    if (!xCommandName) {
        return undefined;
    }
    const snippets = getDialogueArgSnippet(xCommandName);
    if (!snippets) {
        return undefined;
    }
    // Search the line into which the snippet is inserted
    const document = editor.document;
    const startTextLineNumber = startTextLine.lineNumber;
    const nextStartTextLineNumber = findNextPossiblyScopeStartLineNumber(document, startTextLine.lineNumber, isAnnotative);
    const argumentArrow = "-->";
    for (let lineNumber = nextStartTextLineNumber - 1; lineNumber >= startTextLineNumber; lineNumber--) {
        const textLine = document.lineAt(lineNumber);
        const elements = util.splitLineByVerticalBars(textLine.text);
        const contentRegion = isAnnotative ? 2 : 1;
        const content = contentRegion < elements.length ? elements[contentRegion].trim() : "";
        if ((!content.startsWith(argumentArrow) && content !== "") || lineNumber === startTextLineNumber) {
            const dialogueArgSnippetBasis: ArgSnippetBasis = {
                lineNumber: lineNumber + 1,
                snippets: snippets.map(s => `${argumentArrow} ${s.trim()}`)
            };
            return dialogueArgSnippetBasis;
        }
    }
}

function replaceContentPart(elements: Array<string>, content: string, isAnnotative: boolean) {
    const annotation = isAnnotative ? elements[0] : "";
    const annotationVbar = isAnnotative ? "|" : "";
    const declarator = isAnnotative ? (elements.length > 1 ? elements[1] : "") : elements[0];
    const commentRegion = isAnnotative ? 3 : 2;
    const comment = elements.length > commentRegion ? elements.slice(commentRegion, elements.length).join("|") : "";
    return `${annotation}${annotationVbar}${declarator}| ${content.trim()} |${comment}`;
}

export async function insertArgs() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const document = editor.document;
    const isAnnotative = util.isAnnotative(document);
    // Identify the scope start line
    const startTextLine = findPossiblyScopeStartTextLineAbove(editor, isAnnotative);
    if (!startTextLine) {
        util.showError("No scope was found.");
        return;
    }
    // Identify the scope type
    const startElements = util.splitLineByVerticalBars(startTextLine.text);
    const declarator = (isAnnotative ? (startElements.length > 1 ? startElements[1] : "") :
        startElements[0]).trim();
    if (declarator === "") {
        util.showError("Unknown scope type.");
        return;
    }
    if (declarator.startsWith("//")) {
        util.showError("Comment scopes can't have arguments.");
        return;
    }
    // Create the argument snippet
    const argSnippetBasis = declarator.startsWith("#") ? getMacroArgSnippetBasis(startTextLine, isAnnotative) :
        declarator.startsWith("$") ? getCommandArgSnippetBasis(startTextLine, isAnnotative) :
            getDialogueArgSnippetBasis(editor, startTextLine, isAnnotative);
    if (!argSnippetBasis) {
        return;
    }
    // Identify deletable lines
    const snippetLineCount = argSnippetBasis.snippets.length;
    const insertionLineNumber = argSnippetBasis.lineNumber;
    const nextScopeStartLineNumber = findNextPossiblyScopeStartLineNumber(document, startTextLine.lineNumber, isAnnotative);
    const deletableLineCount = Math.min(snippetLineCount, nextScopeStartLineNumber - insertionLineNumber);
    const endDeletableLineNumber = insertionLineNumber + deletableLineCount - 1;

    // Compose the snippet
    const argSnippet = [...Array(argSnippetBasis.snippets.length)]
        .map((_, i) => i)
        .map(snippetIndex => {
            const lineNumber = argSnippetBasis.lineNumber + snippetIndex;
            const text = lineNumber < document.lineCount ? document.lineAt(lineNumber).text : "";
            const elements = util.splitLineByVerticalBars(text);
            const annotationVbar = isAnnotative ? "|" : "";
            return lineNumber <= endDeletableLineNumber ? replaceContentPart(elements, argSnippetBasis.snippets[snippetIndex], isAnnotative) :
                `${annotationVbar} | ${argSnippetBasis.snippets[snippetIndex]} | `;
        }).join("\n");
    // Adjustment
    await editor.edit(editBuilder => {
        // Clear content parts below the snippet lines
        for (let lineNumber = insertionLineNumber + snippetLineCount; lineNumber < nextScopeStartLineNumber; lineNumber++) {
            const textLine = document.lineAt(lineNumber);
            const text = textLine.text;
            const elements = util.splitLineByVerticalBars(text);
            const contentRegion = isAnnotative ? 2 : 1;
            const content = contentRegion < elements.length ? elements[contentRegion] : "";
            if (content.trim() !== "") {
                const contentPart = replaceContentPart(elements, "", isAnnotative);
                editBuilder.replace(textLine.range, contentPart);
            }
        }
        // Delete the unnecessary lines
        if (deletableLineCount > 0) {
            const startRange = document.lineAt(insertionLineNumber).range.start;
            const endRange = document.lineAt(endDeletableLineNumber).range.end;
            const deleteRange = new vscode.Range(startRange, endRange);
            editBuilder.delete(deleteRange);
        }
        // Insert new line
        if (deletableLineCount === 0 || insertionLineNumber === document.lineCount) {
            editBuilder.insert(document.lineAt(insertionLineNumber - 1).range.end, "\n");
        }
    });
    // Move the cursor
    const newPosition = new vscode.Position(insertionLineNumber, 0);
    editor.selection = new vscode.Selection(newPosition, newPosition);
    // Insert the snippet
    await editor.insertSnippet(new vscode.SnippetString(argSnippet), new vscode.Position(insertionLineNumber, 0));
    // Format the document
    await util.formatDocument();
}

export async function moveCursor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const document = editor.document;
    // Identify the current cursor position and the line type
    const cursorCharacterIndex = editor.selection.active.character;
    const lineNumber = editor.selection.active.line;
    const lineText = document.lineAt(lineNumber).text;
    const elements = util.splitLineByVerticalBars(lineText);
    const hasAnnotationPart = elements.length > 3;
    const elementLengths = elements
        .map(elem => elem.length);
    const splitPoints = [...Array(elementLengths.length)]
        .map((_, i) => i)
        .map(i => elementLengths.slice(0, i + 1).reduce((prev, curr) => prev + curr, 0) + i);
    const cursorRegion = Math.min(splitPoints
        .filter(point => point < cursorCharacterIndex).length, (hasAnnotationPart ? 3 : 2));
    const emptyOffset = elements[cursorRegion].trim() === "" && cursorRegion !== 0 ? 1 : 0;
    const tailCursorCharacterIndex = lineText.substring(0,
        elementLengths
            .slice(0, cursorRegion + 1)
            .reduce((prev, curr) => prev + curr, 0) + cursorRegion).trimEnd().length + emptyOffset;
    const goNextRegion = cursorCharacterIndex === tailCursorCharacterIndex;
    // Foramt the document
    await util.formatDocument();
    // Move the cursor
    const lineTextAfter = document.lineAt(lineNumber).text;
    const elementsAfter = util.splitLineByVerticalBars(lineTextAfter);
    const hasAnnotationPartAfter = elementsAfter.length > 3;
    const elementLengthsAfter = elementsAfter
        .map(elem => elem.length);
    const minRegion = hasAnnotationPartAfter ? 1 : 0;
    const mod = hasAnnotationPartAfter ? 4 : 3;
    const newRegion = Math.max((cursorRegion + (goNextRegion ? 1 : 0)) % mod, minRegion);
    const emptyOffsetAfter = elementsAfter[newRegion].trim() === "" && newRegion !== 0 ? 1 : 0;
    const newCursorCharacterIndex = lineTextAfter.substring(0,
        elementLengthsAfter
            .slice(0, newRegion + 1)
            .reduce((prev, curr) => prev + curr, 0) + newRegion).trimEnd().length + emptyOffsetAfter;
    const newCursorPosition = new vscode.Position(lineNumber, newCursorCharacterIndex);
    const newCursorSelection = new vscode.Selection(newCursorPosition, newCursorPosition);
    editor.selection = newCursorSelection;
    editor.revealRange(new vscode.Range(newCursorPosition, newCursorPosition));
}

export async function insertScopeBelow() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const document = editor.document;
    const startLineNumber = editor.selection.end.line;
    const lineCount = document.lineCount;
    const isAnnotative = util.isAnnotative(document);
    for (let lineNumber = startLineNumber; lineNumber < lineCount; lineNumber++) {
        const isEndLine = lineNumber === lineCount - 1;
        const nextLineText = isEndLine ? "" : document.lineAt(lineNumber + 1).text;
        const elements = util.splitLineByVerticalBars(nextLineText);
        const isNextScopeStartLine = isAnnotative ? util.isPossiblyAnnotativeScopeStartLine(elements) :
            util.isPossiblyNonannotativeScopeStartLine(elements);
        if (isNextScopeStartLine || isEndLine) {
            editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(lineNumber, document.lineAt(lineNumber).text.length), `\n${isAnnotative ? "|" : ""}`);
            });
            await util.formatDocument();
            const newLineText = document.lineAt(lineNumber).text;
            const positionCharacter = isAnnotative ? util.splitLineByVerticalBars(newLineText)[0].length + 2 : 0;
            const newPosition = new vscode.Position(lineNumber + 1, positionCharacter);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            editor.revealRange(new vscode.Range(newPosition, newPosition));
            break;
        }
    }
}

export async function insertScopeAbove() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const document = editor.document;
    const startLineNumber = editor.selection.end.line;
    const isAnnotative = util.isAnnotative(document);
    for (let lineNumber = startLineNumber; lineNumber >= 0; lineNumber--) {
        const isStartLine = lineNumber === 0;
        const lineText = document.lineAt(lineNumber).text;
        const elements = util.splitLineByVerticalBars(lineText);
        const isNextScopeStartLine = isAnnotative ? util.isPossiblyAnnotativeScopeStartLine(elements) :
            util.isPossiblyNonannotativeScopeStartLine(elements);
        if (isNextScopeStartLine || isStartLine) {
            editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(lineNumber, 0), `${isAnnotative ? "|" : ""}\n`);
            });
            await util.formatDocument();
            const newLineText = document.lineAt(lineNumber).text;
            const positionCharacter = isAnnotative ? util.splitLineByVerticalBars(newLineText)[0].length + 2 : 0;
            const newPosition = new vscode.Position(lineNumber, positionCharacter);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            editor.revealRange(new vscode.Range(newPosition, newPosition));
            break;
        }
    }
}

function commentOut(source: string): string {
    const onlySpacesRegex = /^(\x20)(\s*)\x20{2}(\s*)$/;
    const leadingRegex = /^(\x20)(\s*)\x20{3}(\s*)(\S.*)$/;
    const trailingRegex = /^(\s*)(\S.*)\x20{3}(\s*)$/;
    return onlySpacesRegex.test(source) ? source.replace(onlySpacesRegex, "$1//$2$3") :
        leadingRegex.test(source) ? source.replace(leadingRegex, "$1$2$3// $4") :
            trailingRegex.test(source) ? source.replace(trailingRegex, "$1// $2$3") :
                `// ${source}`;
}

function uncomment(source: string): string {
    const commentRegex = /^(\s*)\/\/\x20?(.*)$/;
    if (!commentRegex.test(source)) {
        return source;
    }
    const uncommentedText = source.replace(commentRegex, "$1$2");
    const spaceExists = source.trimStart().startsWith("// ");
    const additionalSpaces = spaceExists ? " ".repeat(3) : " ".repeat(2);
    return `${uncommentedText}${additionalSpaces}`;
}

function toggleComment(editor: vscode.TextEditor, textLines: Array<vscode.TextLine>) {
    editor.edit(editBuilder => {
        const splitLines = textLines
            .map(textLine => util.splitLineByVerticalBars(textLine.text));
        const isAnnotative = util.isAnnotative(editor.document);
        const isEveryLineCommentedOut = splitLines
            .every(elements => {
                return isAnnotative ? (elements.length > 1 && elements[1].trim().startsWith("//")) :
                    elements[0].startsWith("//");
            });
        for (let i = 0; i < textLines.length; i++) {
            const elements = splitLines[i];
            const lineNumber = textLines[i].lineNumber;
            const elem0 = elements[0];
            const elem1 = elements.length > 1 ? elements[1] : "";
            if (isAnnotative) {
                const range = new vscode.Range(
                    new vscode.Position(lineNumber, elem0.length + 1),
                    new vscode.Position(lineNumber, elem0.length + 1 + elem1.length)
                );
                const newElement = isEveryLineCommentedOut ? uncomment(elem1) : commentOut(elem1);
                editBuilder.replace(range, `${elements.length === 1 ? "|" : ""}${newElement}`);
            } else {
                const range = new vscode.Range(
                    new vscode.Position(lineNumber, 0),
                    new vscode.Position(lineNumber, elem0.length)
                );
                const newElement = isEveryLineCommentedOut ? uncomment(elem0) : commentOut(elem0);
                editBuilder.replace(range, newElement);
            };
        }
    });
}

export async function toggleLineComment() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const document = editor.document;
    const startLineNumber = editor.selection.start.line;
    const endLineNumber = editor.selection.end.line;
    const targetLineCount = endLineNumber - startLineNumber + 1;
    const targetTextLines = [...Array(targetLineCount)]
        .map((_, i) => i + startLineNumber)
        .map(i => document.lineAt(i));
    toggleComment(editor, targetTextLines);
    await util.formatDocument();
}

export async function toggleScopeComment() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const isAnnotative = util.isAnnotative(editor.document);
    const targetTextLines = util.getAllPossiblyScopeStartLinesInSelection(editor, isAnnotative);
    toggleComment(editor, targetTextLines);
    await util.formatDocument();
}