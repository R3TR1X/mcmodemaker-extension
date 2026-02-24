import * as vscode from 'vscode';
import { ModToolsProvider } from './ModToolsProvider';
import { createOrShowWebview } from './ModCreatorWebview';
import { addCommand } from './generators/CommandGenerator';
import { addEventListener } from './generators/EventListenerGenerator';
import { addConfigFile } from './generators/ConfigGenerator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "mcmodmaker" is now active!');

    // Register Mod Tools Tree Provider
    const modToolsProvider = new ModToolsProvider();
    vscode.window.registerTreeDataProvider('mcmodmaker.modTools', modToolsProvider);

    // Create Mod Command opens the Webview Panel
    let createModDisp = vscode.commands.registerCommand('mcmodmaker.createMod', () => {
        createOrShowWebview(context);
    });

    // Mock commands for the other tools
    let addCmdDisp = vscode.commands.registerCommand('mcmodmaker.addCommand', async () => {
        await addCommand();
    });

    let addEventDisp = vscode.commands.registerCommand('mcmodmaker.addEventListener', async () => {
        await addEventListener();
    });

    let addConfigDisp = vscode.commands.registerCommand('mcmodmaker.addConfigFile', async () => {
        await addConfigFile();
    });

    context.subscriptions.push(createModDisp, addCmdDisp, addEventDisp, addConfigDisp);
}

export function deactivate() { }
