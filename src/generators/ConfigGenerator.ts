import * as vscode from 'vscode';

export async function addConfigFile() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('You must have a workspace opened to add a Config file.');
        return;
    }

    const rootDir = workspaceFolders[0].uri;

    try {
        // 1. Check Fabric Environment & Find Package
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

        const lastDotIndex = mainClassPath.lastIndexOf('.');
        const packageName = lastDotIndex !== -1 ? mainClassPath.substring(0, lastDotIndex) : mainClassPath;
        const packagePath = packageName.replace(/\./g, '/');
        const modid = modJsonData.id;

        // 2. Ask user for settings/config class name
        const className = await vscode.window.showInputBox({
            prompt: "What should the Config class name be? (e.g., ModConfig, Settings)",
            value: "ModConfig",
            validateInput: text => text && text.trim().length > 0 ? null : "Class name cannot be empty."
        });

        if (!className) return;

        // 3. File structure
        const langExt = isKotlin ? 'kt' : 'java';
        const langFolder = isKotlin ? 'kotlin' : 'java';
        const configDirUri = vscode.Uri.joinPath(rootDir, 'src', 'main', langFolder, packagePath, 'config');

        try { await vscode.workspace.fs.createDirectory(configDirUri); } catch (e) { }

        const fileUri = vscode.Uri.joinPath(configDirUri, `${className}.${langExt}`);

        try {
            await vscode.workspace.fs.stat(fileUri);
            vscode.window.showErrorMessage(`File ${className}.${langExt} already exists!`);
            return;
        } catch { }

        // 4. Content generation (Simple GSON-based config scaffold)
        let content = '';

        if (isKotlin) {
            content = `package ${packageName}.config

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import net.fabricmc.loader.api.FabricLoader
import java.io.File
import java.io.FileReader
import java.io.FileWriter

object ${className} {
    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()
    private val configFile: File = FabricLoader.getInstance().configDir.resolve("${modid}.json").toFile()

    // Define your config options here with defaults
    var exampleBoolean: Boolean = true
    var exampleInt: Int = 42
    var exampleString: String = "Hello World"

    fun load() {
        if (!configFile.exists()) {
            save()
            return
        }

        try {
            FileReader(configFile).use { reader ->
                val configData = gson.fromJson(reader, ConfigData::class.java)
                if (configData != null) {
                    exampleBoolean = configData.exampleBoolean
                    exampleInt = configData.exampleInt
                    exampleString = configData.exampleString
                }
            }
        } catch (e: Exception) {
            println("Failed to load config: \${e.message}")
        }
    }

    fun save() {
        val configData = ConfigData(exampleBoolean, exampleInt, exampleString)
        try {
            FileWriter(configFile).use { writer ->
                gson.toJson(configData, writer)
            }
        } catch (e: Exception) {
            println("Failed to save config: \${e.message}")
        }
    }

    // Data class to mirror the config format
    private data class ConfigData(
        val exampleBoolean: Boolean,
        val exampleInt: Int,
        val exampleString: String
    )
}
`;
        } else {
            content = `package ${packageName}.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

public class ${className} {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final File CONFIG_FILE = FabricLoader.getInstance().getConfigDir().resolve("${modid}.json").toFile();

    // Define your config options here with defaults
    public static boolean exampleBoolean = true;
    public static int exampleInt = 42;
    public static String exampleString = "Hello World";

    public static void load() {
        if (!CONFIG_FILE.exists()) {
            save();
            return;
        }

        try (FileReader reader = new FileReader(CONFIG_FILE)) {
            ConfigData data = GSON.fromJson(reader, ConfigData.class);
            if (data != null) {
                exampleBoolean = data.exampleBoolean;
                exampleInt = data.exampleInt;
                exampleString = data.exampleString;
            }
        } catch (IOException e) {
            System.err.println("Failed to load config: " + e.getMessage());
        }
    }

    public static void save() {
        ConfigData data = new ConfigData();
        data.exampleBoolean = exampleBoolean;
        data.exampleInt = exampleInt;
        data.exampleString = exampleString;

        try (FileWriter writer = new FileWriter(CONFIG_FILE)) {
            GSON.toJson(data, writer);
        } catch (IOException e) {
            System.err.println("Failed to save config: " + e.getMessage());
        }
    }

    // Data class to mirror the config format
    private static class ConfigData {
        public boolean exampleBoolean;
        public int exampleInt;
        public String exampleString;
    }
}
`;
        }

        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));

        // 5. Open file
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`Created ${className}! Don't forget to call ${className}.load() when your mod initializes.`);

    } catch (error: any) {
        vscode.window.showErrorMessage("Error adding Config File: " + error.message);
        console.error(error);
    }
}
