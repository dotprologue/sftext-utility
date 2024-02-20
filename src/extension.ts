// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExecOptions } from 'child_process';

type SnippetMaterial = {
	name: string,
	category: string,
	isAsync: boolean,
	descriptions: string[],
	snippets: string[],
	dialogueSnippets: string[]
}

type SnippetMaterialSet = {
	snippetMaterials: SnippetMaterial[];
}

type PathSet = {
	path: string;
};

const macroConfigurationIdMap = new Map<string, string>([
	["command", "commandMacroSnippet"],
	["xcommand", "xcommandMacroSnippet"],
	["token", "tokenMacroSnippet"],
	["define", "defineMacroSnippet"],
	["label", "labelMacroSnippet"]
]);
const commandArgumentsSnippetMap = new Map<string, string[]>();
const dialogueArgumentsSnippetMap = new Map<string, string[]>();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('sftext-utility.loadJson', async () => {
		//Get data path
		const extensionPath = context.extensionUri.fsPath;
		const pathJsonPath = path.join(extensionPath, "data", "path.json")
		const snippetsJsonPath = path.join(extensionPath, "data", "snippets.json");
		const variableSnippetsJsonPath = path.join(extensionPath, "snippets", "snippets.variable-snippets.json");
		//Get data
		const pathJsonText = fs.readFileSync(pathJsonPath, "utf-8");
		const pathSet = JSON.parse(pathJsonText) as PathSet;

		if (fs.existsSync(pathSet.path)) {
			const selectedJsonText = fs.readFileSync(pathSet.path, "utf-8");
			//Try parse
			try {
				const snippetMaterialSet = JSON.parse(selectedJsonText) as SnippetMaterialSet;
				const nameSnippetsJsonText = buildNameSnippetsJson(snippetMaterialSet.snippetMaterials);
				//Save name snippets
				fs.writeFileSync(variableSnippetsJsonPath, nameSnippetsJsonText);
				//Cache json
				fs.writeFileSync(snippetsJsonPath, selectedJsonText, "utf-8");
				//Reload window
				await vscode.commands.executeCommand("workbench.action.reloadWindow");
			}
			catch (e) {
				const answer = await vscode.window.showErrorMessage(`Failed to parse the selected JSON file at '${pathSet.path}' Select new one.`, "Select", "No");
				if (answer === "Select") {
					await vscode.commands.executeCommand("sftext-utility.selectJson");
				}
			}
		}
		else {
			const answer = await vscode.window.showInformationMessage(`The selected JSON file does not exist at '${pathSet.path}'. Select new one.`, "Select", "No");
			if (answer === "Select") {
				await vscode.commands.executeCommand("sftext-utility.selectJson");
			}
		}
	}));

	//Build a snippet JSON file for command names
	function buildNameSnippetsJson(snippetMaterials: SnippetMaterial[]): string {
		let jsonText = "{\n";
		jsonText += snippetMaterials.map(material => {
			const categoryText = material.category.trim() == "" ? "No Category" : `'${material.category.trim()}' Category`;
			let titleText = material.isAsync ? "Async " : "";
			titleText += `Command in ${categoryText} (${material.name})`;
			const descriptionText = material.descriptions.length > 0 ? material.descriptions.reduce((a, b) => `${a} ${b}`) : "No description.";
			return `\t"${titleText}": {\n\t\t"prefix": "${material.name}",\n\t\t"body": "${material.name}",\n\t\t"description": "${descriptionText}"\n\t},\n`
		}).join("");
		jsonText = jsonText.substring(0, jsonText.length - 2);
		jsonText += "\n}"
		return jsonText;
	}

	//Set a Json file for building snippets
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.selectJson", async () => {
		//Make the user select a Json file
		const fileUri = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: {
				"JSON Files": ["json"]
			}
		});
		//If a JSON file is selected
		if (fileUri && fileUri[0]) {
			//Get data
			const jsonFilePath = fileUri[0].fsPath;
			const pathSet: PathSet = { path: jsonFilePath };
			//Get data paths
			const extensionPath = context.extensionUri.fsPath;
			const pathJsonFilePath = path.join(extensionPath, "data", "path.json");
			//Write data texts
			fs.writeFileSync(pathJsonFilePath, JSON.stringify(pathSet), "utf-8");
			//Suggest Loading the file
			const answer = await vscode.window.showWarningMessage("Load the selected JSON file to enable it", "Load", "No");
			if (answer === "Load") {
				await vscode.commands.executeCommand("sftext-utility.loadJson");
			}
		}
	}));

	//Clear Json text and path
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.clearJson", async () => {
		const answerClear = await vscode.window.showWarningMessage("Clear all the JSON data?", "Sure", "Canel");
		if (answerClear === "Sure") {
			//Get paths
			const extensionPath = context.extensionUri.fsPath;
			const defaultPathJsonPath = path.join(extensionPath, "data", "default-path.json");
			const pathJsonPath = path.join(extensionPath, "data", "path.json");
			const defaultSnippetsJsonPath = path.join(extensionPath, "data", "default-snippets.json");
			const snippetsJsonPath = path.join(extensionPath, "data", "snippets.json");
			const variableSnippetsPath = path.join(extensionPath, "snippets", "snippets.variable-snippets.json");
			fs.writeFileSync(pathJsonPath, fs.readFileSync(defaultPathJsonPath, "utf-8"), "utf-8");
			fs.writeFileSync(snippetsJsonPath, fs.readFileSync(defaultSnippetsJsonPath, "utf-8"), "utf-8");
			fs.writeFileSync(variableSnippetsPath, "", "utf-8");
			//Reload window
			await vscode.commands.executeCommand("workbench.action.reloadWindow");
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.insertArguments", async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			//Check the languageId
			if (editor.document.languageId !== "sftext") {
				vscode.window.showWarningMessage("This command is available for only 'sftext'.")
				return;
			}
			//Format the documents
			await vscode.commands.executeCommand("editor.action.formatDocument");
			//Get snippets to be inserted and the target line index
			const argumentsSnippetInfo = getArgumentsSnippetInfo(editor);
			if (argumentsSnippetInfo) {
				const targetLine = argumentsSnippetInfo.targetLine;
				const snippets = argumentsSnippetInfo.snippets;
				let snippetText: string;
				//Macro scope
				if (argumentsSnippetInfo.scopeType === "Macro") {
					const targetTextLine = editor.document.lineAt(targetLine);
					//Move the cursor
					await editor.edit(editBuilder => {
						editBuilder.delete(targetTextLine.range);
					});
					//Build the snippet and delete the line
					const firstBarIndex = getCharIndex(targetTextLine.text, '|', 1);
					const secondBarIndex = getCharIndex(targetTextLine.text, '|', 2);
					const left = targetTextLine.text.substring(0, firstBarIndex);
					const right = targetTextLine.text.substring(secondBarIndex + 1, targetTextLine.text.length);
					//Move the cursor
					const newPosition = new vscode.Position(targetLine, 0);
					editor.selection = new vscode.Selection(newPosition, newPosition);
					snippetText = `${left}|${snippets[0]}|${right}`;
				}
				//Command or dialogue scope
				else {
					//Insert the snippet
					snippetText = snippets
						.map(t => `\n|${t}|`)
						.reduce((a, b) => `${a}${b}`);
					//Move the cursor
					const newPosition = new vscode.Position(targetLine - 1, editor.document.lineAt(targetLine - 1).text.length);
					editor.selection = new vscode.Selection(newPosition, newPosition);
				}

				await editor.insertSnippet(new vscode.SnippetString(snippetText), editor.selection.active);
				//Format the document
				await vscode.commands.executeCommand("editor.action.formatDocument");
			}
			else {

			}
		}
	}));

	function getArgumentsSnippetInfo(editor: vscode.TextEditor): { snippets: string[], targetLine: number, scopeType: "Command" | "Dialogue" | "Macro" } | undefined {
		if (editor) {
			let minLineIndex = 0;
			let maxLineIndex = editor.document.lineCount - 1;
			let lineIndex = editor.selection.active.line;
			let lineText = "";
			let newScopeLineIndex = -1;
			//Identify the new scope line
			while (true) {
				lineText = editor.document.lineAt(lineIndex).text.trim();
				if (isNewScopeLine(lineText)) {
					newScopeLineIndex = lineIndex;
					break;
				}
				//Not in any scopes
				else if (lineIndex <= minLineIndex) {
					vscode.window.showErrorMessage("This line is not in any scopes.")
					return undefined;
				}
				else {
					lineIndex--;
				}
			}
			//In the macro scope
			if (lineText.startsWith('#')) {
				const macroName = lineText.substring(1, getCharIndex(lineText, '|', 1)).trim();
				const macroConfigurationId = macroConfigurationIdMap.get(macroName);
				if (macroConfigurationId) {
					//Get the snippet from the configuration
					const configuration = vscode.workspace.getConfiguration("SFText Utility");
					const snippet = configuration.get(macroConfigurationId) as string;
					return { snippets: [snippet], targetLine: lineIndex, scopeType: "Macro" };
				}
				else {
					vscode.window.showErrorMessage(`The '${macroName}' macro does not exist.`)
					return undefined;
				}
			}
			//In the command scope
			if (lineText.startsWith('$')) {
				const commandName = lineText.substring(getCharIndex(lineText, '|', 1) + 1, getCharIndex(lineText, '|', 2)).trim();
				const snippets = commandArgumentsSnippetMap.get(commandName);
				if (snippets) {
					return { snippets: snippets, targetLine: lineIndex + 1, scopeType: "Command" };
				}
				else {
					vscode.window.showErrorMessage(`The '${commandName}' command does not exist.`);
					return undefined;
				}
			}
			//In the dialogue scope
			//Identify the dialogue command name
			const commandMacroRegex = /^\s*#xcommand\s*\|.*?{(.*?)}.*?\|.*$/;
			let dialogueSnippets: string[];
			while (true) {
				lineText = editor.document.lineAt(lineIndex).text.trim();
				if (lineText.startsWith("#xcommand")) {
					const commandMacroMatch = commandMacroRegex.exec(lineText);
					if (commandMacroMatch) {
						const dialogueCommandName = commandMacroMatch[1].trim();
						const snippets = dialogueArgumentsSnippetMap.get(dialogueCommandName)
						if (snippets) {
							dialogueSnippets = snippets;
							break;
						}
						else {
							vscode.window.showErrorMessage(`The snippet for the '${dialogueCommandName}' ex-dialogue command does not exist.`);
							return undefined;
						}
					}
					else {
						lineIndex--;
					}
				}
				//#command does not exist
				else if (lineIndex <= minLineIndex) {
					vscode.window.showErrorMessage("No ex-dialogue commands are specified. Specify what ex-dialogue command to use with #xcommand macro scope.")
					return undefined;
				}
				else {
					lineIndex--;
				}
			}
			//If the cursor is not at the end of file
			if (maxLineIndex <= editor.selection.active.line) {
				lineIndex = editor.selection.active.line;
			}
			//Identify the next new scope line
			else {
				lineIndex = editor.selection.active.line + 1;
				while (true) {
					lineText = editor.document.lineAt(lineIndex).text.trim();
					if (isNewScopeLine(lineText)) {
						lineIndex--;
						break;
					}
					else if (maxLineIndex <= lineIndex) {
						break;
					}
					else {
						lineIndex++;
					}
				}
			}
			//Identify where the snippets will be inserted
			minLineIndex = newScopeLineIndex;
			while (true) {
				lineText = editor.document.lineAt(lineIndex).text.trim();
				if (isDialogueLineLine(lineText)) {
					break;
				}
				else if (lineIndex <= minLineIndex) {
					break;
				}
				else {
					lineIndex--;
				}
			}
			return { snippets: dialogueSnippets.map(s => `--> ${s}`), targetLine: lineIndex + 1, scopeType: "Dialogue" };
		}
	}

	function isNewScopeLine(line: string): boolean {
		line = line.trim();
		const firstBarIndex = getCharIndex(line, '|', 1);
		const secondBarIndex = getCharIndex(line, '|', 2);
		if (firstBarIndex === -1) {
			return false;
		}
		else if (secondBarIndex === -1) {
			return false;
		}
		const left = line.substring(0, firstBarIndex).trim();
		return !left.startsWith("//") && left !== "";
	}

	function isDialogueLineLine(line: string): boolean {
		line = line.trim();
		const firstBarIndex = getCharIndex(line, '|', 1);
		const secondBarIndex = getCharIndex(line, '|', 2);
		if (firstBarIndex === -1) {
			return false;
		}
		else if (secondBarIndex === -1) {
			return false;
		}
		const left = line.substring(0, firstBarIndex).trim();
		const center = line.substring(firstBarIndex + 1, secondBarIndex).trim();
		return left === "" && center !== "" && !center.startsWith("-->");
	}

	//Format the document, and move cursor
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.moveCursor", async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			//Check the languageId
			if (editor.document.languageId !== "sftext") {
				vscode.window.showWarningMessage("This command is available for only 'sftext'.")
				return;
			}
			let position = editor.selection.active;
			let lineText = editor.document.lineAt(position.line).text;
			//Get the number of vertical bars
			const verticalBarCount = [...lineText]
				.filter(c => c === '|')
				.length;
			//Format the document
			await vscode.commands.executeCommand("editor.action.formatDocument");
			//Move the cursor onto the 1st or 2nd vertical bar or the front of the line
			position = editor.selection.active;
			lineText = editor.document.lineAt(position.line).text;
			let selectionActive = 0;
			const firstBarIndex = getCharIndex(lineText, '|', 1);
			const secondBarIndex = getCharIndex(lineText, '|', 2);
			//Only scope part was written
			if (verticalBarCount === 0) {
				selectionActive = firstBarIndex + 2;
			}
			//Only scope part and content part were written
			else if (verticalBarCount === 1) {
				selectionActive = secondBarIndex + 2;
			}
			//All the parts were written
			else {
				const leftPosition = lineText.substring(0, firstBarIndex).trim().length;
				const centerPosition = firstBarIndex + 2 + lineText.substring(firstBarIndex + 1, secondBarIndex).trim().length;
				const rightPosition = secondBarIndex + 2 + lineText.substring(secondBarIndex + 1, lineText.length).trim().length;
				if (position.character <= firstBarIndex) {
					selectionActive = position.character === leftPosition ? centerPosition : leftPosition;
				}
				else if (position.character <= secondBarIndex) {
					selectionActive = position.character === centerPosition ? rightPosition : centerPosition;
				}
				else {
					selectionActive = position.character === rightPosition ? leftPosition : rightPosition;
				}
			}
			//Set the new selection
			const newActivePosition = new vscode.Position(editor.selection.active.line, selectionActive)
			const newSelection = new vscode.Selection(newActivePosition, newActivePosition);
			editor.selection = newSelection;
			editor.revealRange(new vscode.Range(newActivePosition, newActivePosition));
		}
	}));

	//Insert a new line below after formatting
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.insertLineBelow", async () => {
		//Format the document
		await vscode.commands.executeCommand("editor.action.formatDocument");
		//Insert a new line below
		await vscode.commands.executeCommand("editor.action.insertLineAfter");
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			if (editor.selection.active.character > 0) {
				//Delete all indents
				await vscode.commands.executeCommand("deleteAllLeft");
			}
		}
	}));

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

	//Get data path
	const extensionPath = context.extensionUri.fsPath;
	const pathJsonPath = path.join(extensionPath, "data", "path.json")
	const snippetsJsonPath = path.join(extensionPath, "data", "snippets.json")
	//Get data texts
	const pathJsonText = fs.readFileSync(pathJsonPath, "utf-8");
	const snippetsJsonText = fs.readFileSync(snippetsJsonPath, "utf-8");
	//Cache arguments snippets

	const snippetMaterialSet = JSON.parse(snippetsJsonText) as SnippetMaterialSet;
	snippetMaterialSet.snippetMaterials.forEach(material => {
		if (material.snippets.length > 0) {
			commandArgumentsSnippetMap.set(material.name, material.snippets);
		}
		if (material.dialogueSnippets.length > 0) {
			dialogueArgumentsSnippetMap.set(material.name, material.dialogueSnippets);
		}
	});
	//Compare the selected Json and the cached Json
	const pathSet = JSON.parse(pathJsonText) as PathSet;
	if (fs.existsSync(pathSet.path)) {
		const selectedJsonText = fs.readFileSync(pathSet.path, "utf-8");
		//Compare new and cached
		if (snippetsJsonText !== selectedJsonText) {
			vscode.window.showInformationMessage("The selected JSON file was modified. Reload the file to enable it.", "Reload", "No")
				.then(result => {
					if (result === "Reload") {
						vscode.commands.executeCommand("sftext-utility.loadJson");
					}
				})
		}
	}
	else {
		const message = pathSet.path === "" ? "No JSON file is selected. Select a JSON file to enable snippets." : `The selected JSON file was not found at ${pathSet.path}. Select new one.`;
		vscode.window.showInformationMessage(message, "Select", "No")
			.then(result => {
				if (result === "Select") {
					vscode.commands.executeCommand("sftext-utility.selectJson");
				}
			})
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }