// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as setting from './setting';
import * as editing from './editing';
import * as annotation from './annotation';
import { ExecOptions } from 'child_process';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Setting commands -------------------------------
	context.subscriptions.push(vscode.commands.registerCommand('sftext-utility.loadJson', async () => {
		await setting.loadJSON(context.extensionUri.fsPath);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.selectJson", async () => {
		await setting.selectJSON(context.extensionUri.fsPath);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.clearJson", async () => {
		await setting.clearJSON(context.extensionUri.fsPath);
	}));
	// ---------------------------------------------------

	// Editing commands -------------------------------
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.insertArguments", async () => {
		await editing.insertArgs();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.moveCursor", async () => {
		await editing.moveCursor();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.insertScopeBelow", async () => {
		await editing.insertScopeBelow();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.insertScopeAbove", async () => {
		await editing.insertScopeAbove();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.toggleLineComment", async () => {
		await editing.toggleLineComment();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.toggleScopeComment", async () => {
		await editing.toggleScopeComment();
	}));
	// ------------------------------------------------

	// Annotation commands -----------------------------
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.addScopeAnnotations", async () => {
		await annotation.addScopeAnnotations();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.reallocateScopeIds", async () => {
		await annotation.reallocateScopeIds();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.removeAllScopeAnnotations", async () => {
		await annotation.removeAllScopeAnnotations();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.switchScopeLocality", async () => {
		await annotation.switchScopeLocality();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.chainScopeUpward", async () => {
		await annotation.chainScopeUpward();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("sftext-utility.chainScopeDownward", async () => {
		await annotation.chainScopeDownward();
	}));
	// -------------------------------------------------------

	setting.buildSettings(context.extensionUri.fsPath);
}

// This method is called when your extension is deactivated
export function deactivate() { }