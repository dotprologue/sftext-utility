import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const commandArgumentsSnippetMap = new Map<string, string[]>();
const dialogueArgumentsSnippetMap = new Map<string, string[]>();

type SnippetMaterial = {
    name: string,
    category: string,
    isAsync: boolean,
    descriptions: string[],
    snippets: string[],
    dialogueSnippets: string[]
};

type SnippetMaterialSet = {
    snippetMaterials: SnippetMaterial[];
};

type PathSet = {
    path: string;
};

export function getCommandArgSnippet(key: string): ReadonlyArray<string> | undefined {
    return commandArgumentsSnippetMap.get(key);
}

export function getDialogueArgSnippet(key: string): ReadonlyArray<string> | undefined {
    return dialogueArgumentsSnippetMap.get(key);
}

export function buildSettings(extensionPath: string) {
    // Get data path
    const pathJsonPath = path.join(extensionPath, "data", "path.json");
    const snippetsJsonPath = path.join(extensionPath, "data", "snippets.json");
    // Get data texts
    const pathJsonText = fs.readFileSync(pathJsonPath, "utf-8");
    const snippetsJsonText = fs.readFileSync(snippetsJsonPath, "utf-8");
    // Cache arguments snippets

    const snippetMaterialSet = JSON.parse(snippetsJsonText) as SnippetMaterialSet;
    snippetMaterialSet.snippetMaterials.forEach(material => {
        if (material.snippets.length > 0) {
            commandArgumentsSnippetMap.set(material.name, material.snippets);
        }
        if (material.dialogueSnippets.length > 0) {
            dialogueArgumentsSnippetMap.set(material.name, material.dialogueSnippets);
        }
    });
    // Compare the selected Json and the cached Json
    const pathSet = JSON.parse(pathJsonText) as PathSet;
    if (fs.existsSync(pathSet.path)) {
        const selectedJsonText = fs.readFileSync(pathSet.path, "utf-8");
        // Compare new and cached
        if (snippetsJsonText !== selectedJsonText) {
            vscode.window.showInformationMessage("The selected JSON file was modified. Reload the file to enable it.", "Reload", "No")
                .then(result => {
                    if (result === "Reload") {
                        vscode.commands.executeCommand("sftext-utility.loadJson");
                    }
                });
        }
    }
    else {
        const message = pathSet.path === "" ? "No JSON file is selected. Select a JSON file to enable snippets." : `The selected JSON file was not found at ${pathSet.path}. Select new one.`;
        vscode.window.showInformationMessage(message, "Select", "No")
            .then(result => {
                if (result === "Select") {
                    vscode.commands.executeCommand("sftext-utility.selectJson");
                }
            });
    }

}

//Build a snippet JSON file for command names
function buildNameSnippetsJson(snippetMaterials: SnippetMaterial[]): string {
    let jsonText = "{\n";
    jsonText += snippetMaterials.map(material => {
        const categoryText = material.category.trim() === "" ? "No Category" : `'${material.category.trim()}' Category`;
        let titleText = material.isAsync ? "Async " : "";
        titleText += `Command in ${categoryText} (${material.name})`;
        const descriptionText = material.descriptions.length > 0 ? material.descriptions.reduce((a, b) => `${a} ${b}`) : "No description.";
        return `\t"${titleText}": {\n\t\t"prefix": "${material.name}",\n\t\t"body": "${material.name}",\n\t\t"description": "${descriptionText}"\n\t},\n`;
    }).join("");
    jsonText = jsonText.substring(0, jsonText.length - 2);
    jsonText += "\n}";
    return jsonText;
}

export async function loadJSON(extensionPath: string) {
    //Get data path
    const pathJsonPath = path.join(extensionPath, "data", "path.json");
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
}

export async function selectJSON(extensionPath: string) {
    // Make the user select a Json file
    const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
            "jsonFiles": ["json"]
        }
    });
    // If a JSON file is selected
    if (fileUri && fileUri[0]) {
        // et data
        const jsonFilePath = fileUri[0].fsPath;
        const pathSet: PathSet = { path: jsonFilePath };
        // Get data paths
        const pathJsonFilePath = path.join(extensionPath, "data", "path.json");
        // Write data texts
        fs.writeFileSync(pathJsonFilePath, JSON.stringify(pathSet), "utf-8");
        // Suggest Loading the file
        const answer = await vscode.window.showWarningMessage("Load the selected JSON file to enable it", "Load", "No");
        if (answer === "Load") {
            await vscode.commands.executeCommand("sftext-utility.loadJson");
        }
    }
}

export async function clearJSON(extensionPath: string) {
    const answerClear = await vscode.window.showWarningMessage("Clear all the JSON data?", "Sure", "Canel");
    if (answerClear === "Sure") {
        // Get paths
        const defaultPathJsonPath = path.join(extensionPath, "data", "default-path.json");
        const pathJsonPath = path.join(extensionPath, "data", "path.json");
        const defaultSnippetsJsonPath = path.join(extensionPath, "data", "default-snippets.json");
        const snippetsJsonPath = path.join(extensionPath, "data", "snippets.json");
        const variableSnippetsPath = path.join(extensionPath, "snippets", "snippets.variable-snippets.json");
        fs.writeFileSync(pathJsonPath, fs.readFileSync(defaultPathJsonPath, "utf-8"), "utf-8");
        fs.writeFileSync(snippetsJsonPath, fs.readFileSync(defaultSnippetsJsonPath, "utf-8"), "utf-8");
        fs.writeFileSync(variableSnippetsPath, "", "utf-8");
        // Reload window
        await vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
}