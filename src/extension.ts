// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { getVSCodeDownloadUrl } from '@vscode/test-electron/out/util';
import { join } from 'path';
import { formatWithOptions } from 'util';
import * as vscode from 'vscode';
let count: number = 1;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "sftext-utility" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('sftext-utility.helloworld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from sftext-utility!');
	});

	context.subscriptions.push(disposable);

	let disposable2 = vscode.commands.registerCommand('sftext-utility.goodmorning', async () => {
		const verticalBarRegex = /^.*?\|(.*?)\|.*$/;
		const emptyRegex = /^\s*\|\s*\|.*$/;
		const methodRegex = /^\s*#method\s*\|.*?{(.*?)}.*?\|.*$/;

		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const currentPosition = editor.selection.active;
			const currentLineText = editor.document.lineAt(currentPosition.line).text.trim();
			const currentLineMatches = verticalBarRegex.exec(currentLineText);
			let commandName: string;
			let insertionLineIndex: number = 0;
			let insertionArguments: readonly string[] = new Array(1);
			//Check the format of the selected line
			if (currentLineMatches === null) {
				//Invalid format. Finish the command immediately.
				vscode.window.showInformationMessage("The selected line doesn't requrie extra arguments.")
				return;
			}
			//The target is a production
			else if (currentLineText.startsWith('$')) {
				commandName = currentLineMatches[1].trim();
				insertionLineIndex = currentPosition.line + 1;
				insertionArguments = ["Wait for {${1:n1}} secdonds.", "Wait for {${2:n2}} secdonds."]
			}
			//The target may be a dialog production
			else {
				//Check whether the selected line is a dialog line
				let lineIndex = currentPosition.line;
				while (true) {
					const lineText = editor.document.lineAt(lineIndex).text.trim();
					//A production, macro, empty, or invalid form
					if (lineText.startsWith('$') || lineText.startsWith('#') || emptyRegex.test(lineText) || getCharIndex(lineText, '|', 2) == -1) {
						//Failed.Finish the command immediately
						vscode.window.showInformationMessage("The selected line doesn't requrie extra arguments.")
						return;
					}
					//Dialog line
					else if (!lineText.startsWith('|')) {
						//Succeeded. Go next instruction.
						break;
					}
					//Next line
					else {
						if (lineIndex === 0) {
							//Failed. Finish the command immediately
							vscode.window.showInformationMessage("The selected line doesn't requrie extra arguments.")
							return;
						}
						else {
							lineIndex--;
						}
					}
				}
				//Search the dialog command name to use
				lineIndex = currentPosition.line;
				while (true) {
					//Check wheter the line is a method macro line
					const lineText = editor.document.lineAt(lineIndex).text;
					const matches = methodRegex.exec(lineText);
					if (matches === null) {
						if (lineIndex === 0) {
							vscode.window.showWarningMessage("The dialog command name to use was not found.");
							return;
						}
						else {
							lineIndex--;
						}
					}
					else {
						commandName = matches[1].trim();
						break;
					}
				}
				//Search the line index to be inserted
				insertionLineIndex = currentPosition.line + 1;
				const maxlineIndex = editor.document.lineCount - 1;
				while (insertionLineIndex < maxlineIndex) {
					const lineText = editor.document.lineAt(insertionLineIndex).text.trim();
					//New scope, empty, or invalid form
					if (!lineText.startsWith('|') || emptyRegex.test(lineText) || getCharIndex(lineText, '|', 2) == -1) {
						break;
					}
					else {
						insertionLineIndex++;
					}
				}
				insertionArguments = ["--> {${1:None}}", "--> {${2:None}}"];
			}
			//Move the cursor
			const newPosition = new vscode.Position(insertionLineIndex - 1, editor.document.lineAt(insertionLineIndex - 1).text.length);
			const newSelection = new vscode.Selection(newPosition, newPosition);
			editor.selection = newSelection;
			//Insert the snippet
			const snippetText = insertionArguments
				.map(t => `\n|${t}|`)
				.reduce((a, b) => `${a}${b}`);
			const snippetString = new vscode.SnippetString(snippetText);
			await editor.insertSnippet(snippetString, editor.selection.active);
			//Format the document
			await vscode.commands.executeCommand('editor.action.formatDocument');
		}
	});

	context.subscriptions.push(disposable2);

	context.subscriptions.push(vscode.commands.registerCommand('sftext-utility.insertArgs', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			vscode.window.showInformationMessage(context.extensionPath);
			
		}
	}));

	//Format the document, and move cursor
	context.subscriptions.push(vscode.commands.registerCommand('sftext-utility.formatCursor', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			let position = editor.selection.active;
			let lineText = editor.document.lineAt(position.line).text;
			//Get the number of vertical bars
			const verticalBarCount = [...lineText]
				.filter(c => c == '|')
				.length;
			//Format the document
			await vscode.commands.executeCommand('editor.action.formatDocument');
			//Move the cursor onto the 1st or 2nd vertical bar or the front of the line
			position = editor.selection.active;
			lineText = editor.document.lineAt(position.line).text;
			let selectionAnchor = 0;
			let selectionActive = 0;
			const firstBarIndex = getCharIndex(lineText, '|', 1);
			const secondBarIndex = getCharIndex(lineText, '|', 2);
			//Only scope part was written
			if (verticalBarCount === 0) {
				selectionAnchor = firstBarIndex + 2;
				selectionActive = selectionAnchor;
			}
			//Only scope part and content part were written
			else if (verticalBarCount === 1) {
				selectionAnchor = secondBarIndex + 2;
				selectionActive = selectionAnchor;
			}
			//All the parts were written
			else {
				//Get where selection active is
				//0: left, 1: center, 2: right
				let activeLocation = position.character <= firstBarIndex ? 0 :
					position.character <= secondBarIndex ? 1 :
						2;
				//Any range is selected already or the right part is empty
				if ((editor.selection.anchor.character !== editor.selection.active.character ||
					editor.selection.anchor.line !== editor.selection.active.line) ||
					(editor.selection.anchor.character === secondBarIndex + 2 &&
						editor.selection.active.character === secondBarIndex + 2 &&
						secondBarIndex + 2 === lineText.length)) {
					activeLocation = activeLocation === 2 ? 0 : activeLocation + 1;
				}
				//Change selection
				if (activeLocation === 0) {
					selectionAnchor = 0;
					selectionActive = firstBarIndex - 1;
				}
				else if (activeLocation === 1) {
					selectionAnchor = firstBarIndex + 2;
					selectionActive = secondBarIndex - 1;
				}
				else {
					selectionAnchor = secondBarIndex + 2;
					selectionActive = lineText.length;
				}
			}
			const newAnchorPosition = new vscode.Position(editor.selection.active.line, selectionAnchor);
			const newActivePosition = new vscode.Position(editor.selection.active.line, selectionActive)
			const newSelection = new vscode.Selection(newAnchorPosition, newActivePosition);
			editor.selection = newSelection;
		}
	}));
}

//Get snippet text to insert
function getArgumentSnippet(editor: vscode.TextEditor): string {
	const verticalBarRegex = /^(.*?)\|(.*?)\|.*$/;
	//Get the current line text
	const currentLineText = editor.document.lineAt(editor.selection.active).text;
	//Split the text to three parts
	const matches = verticalBarRegex.exec(currentLineText);
	if (matches === null) {
		return "";
	}
	else {
		const scopePart = matches[1].trim();
		const contentPart = matches[2].trim();
		//Production exept for dialog
		if (scopePart.startsWith("$")) {
			return contentPart;
		}
		//Dialog production
		else if (!scopePart.startsWith("#") && scopePart != "") {
			return contentPart;
		}
		//Not Production
		else {
			return "";
		}
	}
}

//Get the nth char index from the front
function getCharIndex(text: string, c: string, nth: number): number {
	nth--;
	//The indexes of the specified character
	const indexList = [...text]
		.map((c, i) => {
			return {
				value: c,
				index: i
			}
		})
		.filter(p => p.value === c)
		.map(p => p.index);
	if (indexList.length <= nth || nth < 0) {
		return -1;
	}
	else {
		return indexList[nth];
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }