import * as vscode from 'vscode';
import * as util from './util';

const globalAnnotationRegex = /^(\s*)\[(\d*)\](\s*)$/;
const localAnnotationRegex = /^(\s*)\((\d*)\)(\s*)$/;
const chainingAnnotationRegex = /^\s*<(↑|↓)>\s*$/;

const macroAnnotationConfigId = "macroAnnotation";
const commandAnnotationConfigId = "commandAnnotation";
const dialougeAnnotationConfigId = "dialogueAnnotation";
const commentAnnotationConfigId = "commentAnnotation";

enum AnnotationType {
    global = "global",
    local = "local",
    upwardChain = "upwardChain",
    downwardChain = "downwardChain"
}

function isValidAnnotation(annotation: string): boolean {
    return globalAnnotationRegex.test(annotation) ||
        localAnnotationRegex.test(annotation) ||
        chainingAnnotationRegex.test(annotation);
}

function getAnnotationFromConfig(declarator: string, configuration: vscode.WorkspaceConfiguration): string | undefined {
    declarator = declarator.trim();
    const configId = declarator.startsWith("#") ? macroAnnotationConfigId :
        declarator.startsWith("$") ? commandAnnotationConfigId :
            declarator.startsWith("//") ? commentAnnotationConfigId :
                declarator !== "" ? dialougeAnnotationConfigId :
                    "";
    const annotationType = configuration.get<AnnotationType>(configId);
    const annotation = annotationType === AnnotationType.global ? "[]" :
        annotationType === AnnotationType.local ? "()" :
            annotationType === AnnotationType.upwardChain ? "<↑>" :
                annotationType === AnnotationType.downwardChain ? "<↓>" :
                    undefined;
    return annotation;
}

export async function addScopeAnnotations() {
    const configuration = vscode.workspace.getConfiguration("SFText Utility");

    util.editAllLines((editorBuilder, textLine) => {
        const text = textLine.text;
        const lineNumber = textLine.lineNumber;
        const elements = util.splitLineByVerticalBars(text);
        if (elements.length < 4) {
            const range = new vscode.Range(
                new vscode.Position(lineNumber, 0),
                new vscode.Position(lineNumber, 0)
            );
            const declarator = elements[0];
            const annotation = getAnnotationFromConfig(declarator, configuration);
            const addedAnnotation = elements[0].trim() !== "" && annotation ? annotation : "";
            editorBuilder.replace(range, `${addedAnnotation}|`);
        }
        else if (elements[1].trim() !== "" && !isValidAnnotation(elements[0])) {
            const range = new vscode.Range(
                new vscode.Position(lineNumber, 0),
                new vscode.Position(lineNumber, elements[0].length)
            );
            const declarator = elements.length > 1 ? elements[1] : "";
            const annotation = getAnnotationFromConfig(declarator, configuration);
            if (!annotation) {
                return;
            }
            editorBuilder.replace(range, annotation);
        }
    });
    await util.formatDocument();
}

export async function reallocateScopeIds() {
    let scopeId = 1;
    util.editAllLines((editorBuilder, textLine) => {
        const text = textLine.text;
        const lineNumber = textLine.lineNumber;
        const elements = util.splitLineByVerticalBars(text);
        if (elements.length > 3) {
            const isGlobal = globalAnnotationRegex.test(elements[0]);
            const isLocal = localAnnotationRegex.test(elements[0]);
            if (isGlobal || isLocal) {
                const identifiedAnnotation = isGlobal ? `[${scopeId}]` : `(${scopeId})`;
                const range = new vscode.Range(
                    new vscode.Position(lineNumber, 0),
                    new vscode.Position(lineNumber, elements[0].length)
                );
                editorBuilder.replace(range, identifiedAnnotation);
                scopeId++;
            }
        }
    });
    await util.formatDocument();
}

export async function removeAllScopeAnnotations() {
    util.editAllLines((editorBuilder, textLine) => {
        const text = textLine.text;
        const lineNumber = textLine.lineNumber;
        const elements = util.splitLineByVerticalBars(text);
        if (elements.length > 3) {
            const range = new vscode.Range(
                new vscode.Position(lineNumber, 0),
                new vscode.Position(lineNumber, elements[0].length + 1)
            );
            editorBuilder.replace(range, "");
        }
    });
    await util.formatDocument();
}

function editScopeAnnotationsAbove(selector: (annotation: string) => string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const isAnnotative = util.isAnnotative(editor.document);
    if (!isAnnotative) {
        return;
    }
    editor.edit(editBuilder => {
        for (const textLine of util.getAllPossiblyScopeStartLinesInSelection(editor, true)) {
            const text = textLine.text;
            const lineNumber = textLine.lineNumber;
            const elements = util.splitLineByVerticalBars(text);
            const oldAnnotation = elements[0];
            const newAnnotation = selector(oldAnnotation);
            const range = new vscode.Range(
                new vscode.Position(lineNumber, 0),
                new vscode.Position(lineNumber, oldAnnotation.length)
            );
            editBuilder.replace(range, newAnnotation);
        }
    });
}

function getHalfSpaceAlignedText(originalText: string, newText: string): string {
    return `${newText}${" ".repeat(Math.max(0, originalText.length - newText.length))}`;
}

export async function switchScopeLocality() {
    let toGlobal: boolean | undefined = undefined;
    editScopeAnnotationsAbove(annotation => {
        if (toGlobal === undefined) {
            toGlobal = !globalAnnotationRegex.test(annotation);
        }
        const openBracket = toGlobal ? "[" : "(";
        const closeBracket = toGlobal ? "]" : ")";
        const replaceText = `$1${openBracket}$2${closeBracket}$3`;
        const newAnnotation = globalAnnotationRegex.test(annotation) ? annotation.replace(globalAnnotationRegex, replaceText) :
            localAnnotationRegex.test(annotation) ? annotation.replace(localAnnotationRegex, replaceText) :
                `${openBracket}${closeBracket}`;
        return getHalfSpaceAlignedText(annotation, newAnnotation);
    });
    await util.formatDocument();
}

export async function chainScopeUpward() {
    const upwardAnnotation = "<↑>";
    editScopeAnnotationsAbove(annotation => getHalfSpaceAlignedText(annotation, upwardAnnotation));
    await util.formatDocument();
}

export async function chainScopeDownward() {
    const downwardAnnotation = "<↓>";
    editScopeAnnotationsAbove(annotation => getHalfSpaceAlignedText(annotation, downwardAnnotation));
    await util.formatDocument();
}