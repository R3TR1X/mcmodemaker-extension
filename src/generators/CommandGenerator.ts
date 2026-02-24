import * as vscode from 'vscode';
import * as path from 'path';

export async function addCommand() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('You must have a workspace opened to add a command.');
        return;
    }

    const rootDir = workspaceFolders[0].uri;

    try {
        // 1. Try to read fabric.mod.json
        const modJsonUri = vscode.Uri.joinPath(rootDir, 'src', 'main', 'resources', 'fabric.mod.json');
        let modJsonData: any;
        try {
            const modJsonBytes = await vscode.workspace.fs.readFile(modJsonUri);
            modJsonData = JSON.parse(Buffer.from(modJsonBytes).toString('utf8'));
        } catch {
            vscode.window.showErrorMessage('Could not find src/main/resources/fabric.mod.json - are you sure this is a Fabric project?');
            return;
        }

        let isKotlin = false;
        let mainClassPath = '';

        // Find the main entrypoint
        const mainEntry = modJsonData.entrypoints?.main?.[0];
        if (!mainEntry) {
            vscode.window.showErrorMessage('Could not determine the main entrypoint from fabric.mod.json');
            return;
        }

        if (typeof mainEntry === 'string') {
            mainClassPath = mainEntry;
        } else if (mainEntry.adapter === 'kotlin') {
            isKotlin = true;
            mainClassPath = mainEntry.value;
        } else {
            mainClassPath = mainEntry.value;
        }

        // e.g. "com.example.mymod.MyMod"
        const lastDotIndex = mainClassPath.lastIndexOf('.');
        const packageName = lastDotIndex !== -1 ? mainClassPath.substring(0, lastDotIndex) : mainClassPath;
        const packagePath = packageName.replace(/\./g, '/');

        // 2. Ask user for command name
        const commandName = await vscode.window.showInputBox({
            prompt: "What is the command name? (e.g., 'heal' or 'spawn')",
            placeHolder: "heal",
            validateInput: text => {
                return text && text.trim().length > 0 && !text.includes(" ") ? null : "Command name must be a single word without spaces.";
            }
        });

        if (!commandName) return;

        // 3. Ask user for class name
        const defaultClassName = commandName.charAt(0).toUpperCase() + commandName.slice(1) + 'Command';
        const className = await vscode.window.showInputBox({
            prompt: "What should the Class name be?",
            value: defaultClassName,
            validateInput: text => {
                return text && text.trim().length > 0 ? null : "Class name cannot be empty.";
            }
        });

        if (!className) return;

        // 4. Create paths
        const langExt = isKotlin ? 'kt' : 'java';
        const langFolder = isKotlin ? 'kotlin' : 'java';

        const commandsDirUri = vscode.Uri.joinPath(rootDir, 'src', 'main', langFolder, packagePath, 'commands');

        try {
            await vscode.workspace.fs.createDirectory(commandsDirUri);
        } catch (e) {
            // Directory might already exist, ignore
        }

        const fileUri = vscode.Uri.joinPath(commandsDirUri, `${className}.${langExt}`);

        // 5. Check if file already exists
        try {
            await vscode.workspace.fs.stat(fileUri);
            vscode.window.showErrorMessage(`File ${className}.${langExt} already exists!`);
            return;
        } catch {
            // File does not exist, safe to write
        }

        // 6. Generate content
        let content = '';

        if (isKotlin) {
            content = `package ${packageName}.commands

import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback
import net.minecraft.server.command.CommandManager
import net.minecraft.text.Text

object ${className} {
    fun register() {
        CommandRegistrationCallback.EVENT.register { dispatcher, registryAccess, environment ->
            dispatcher.register(CommandManager.literal("${commandName}")
                .executes { context ->
                    context.source.sendMessage(Text.literal("Executed ${commandName} command!"))
                    1
                }
            )
        }
    }
}
`;
        } else {
            content = `package ${packageName}.commands;

import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.server.command.CommandManager;
import net.minecraft.text.Text;

public class ${className} {
    public static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            dispatcher.register(CommandManager.literal("${commandName}")
                .executes(context -> {
                    context.getSource().sendMessage(Text.literal("Executed ${commandName} command!"));
                    return 1; // Success
                }));
        });
    }
}
`;
        }

        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));

        // 7. Open the newly created file
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`Created ${className}! Remember to call ${className}.register() in your ModInitializer.`);

    } catch (error: any) {
        vscode.window.showErrorMessage("Error adding command: " + error.message);
        console.error(error);
    }
}
