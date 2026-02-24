import * as vscode from 'vscode';
import { generateFabricMod } from './generators/FabricGenerator';

export function createOrShowWebview(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'createMod',
        'Create Minecraft Mod',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'create':
                    const data = message.data;

                    if (data.modLoader !== 'Fabric') {
                        vscode.window.showWarningMessage('Currently, only Fabric scaffolding is fully supported in this build!');
                        return;
                    }

                    // Open Folder Picker for Mod Location
                    const folderUri = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Mod Output Folder'
                    });

                    if (!folderUri || folderUri.length === 0) {
                        return; // User canceled
                    }

                    const targetDir = vscode.Uri.joinPath(folderUri[0], data.projectName);
                    await vscode.workspace.fs.createDirectory(targetDir);

                    await generateFabricMod(targetDir, data);

                    // Prompt to open the generated project
                    const openProject = await vscode.window.showInformationMessage(
                        `Generated ${data.projectName}! Would you like to open it now?`,
                        'Open Project', 'Later'
                    );

                    if (openProject === 'Open Project') {
                        vscode.commands.executeCommand('vscode.openFolder', targetDir, true);
                    }

                    return;
            }
        },
        undefined,
        context.subscriptions
    );
}

function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Minecraft Mod</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            display: flex;
            justify-content: center;
        }
        .container {
            width: 100%;
            max-width: 600px;
        }
        h1 {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 30px;
        }
        .title-highlight {
            background-color: #0b57d0;
            color: white;
            padding: 5px 15px;
            border-radius: 4px;
        }
        .section {
            background-color: rgba(0, 0, 0, 0.2);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            color: #4daafc;
        }
        .section-title svg {
            margin-right: 10px;
            width: 16px;
            height: 16px;
            fill: currentColor;
        }
        .form-group {
            margin-bottom: 15px;
            position: relative;
        }
        .form-row {
            display: flex;
            gap: 20px;
        }
        .form-row .form-group {
            flex: 1;
        }
        label {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
            font-size: 12px;
            font-weight: bold;
        }
        .required::after {
            content: " *";
            color: #f44336;
        }
        .input-wrapper {
            display: flex;
            align-items: center;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 0 10px;
        }
        .input-wrapper.error {
            border-color: #f44336;
        }
        .error-message {
            color: #f44336;
            font-size: 12px;
            margin-top: 5px;
            display: none;
        }
        .input-wrapper svg {
            width: 14px;
            height: 14px;
            fill: var(--vscode-input-placeholderForeground);
            margin-right: 8px;
        }
        input[type="text"], select {
            width: 100%;
            background-color: transparent;
            color: var(--vscode-input-foreground);
            border: none;
            padding: 8px 0;
            outline: none;
            font-family: inherit;
        }
        select {
            cursor: pointer;
        }
        .submit-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            margin-top: 10px;
        }
        .submit-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .info-icon {
            margin-left: 8px;
            cursor: help;
            color: var(--vscode-editorInfo-foreground);
            position: relative;
            display: inline-flex;
        }
        .info-icon svg {
            width: 14px;
            height: 14px;
            fill: currentColor;
        }
        .tooltip {
            visibility: hidden;
            width: 250px;
            background-color: var(--vscode-editorWidget-background);
            color: var(--vscode-editorWidget-foreground);
            text-align: left;
            border-radius: 6px;
            padding: 8px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            margin-left: -125px;
            opacity: 0;
            transition: opacity 0.3s;
            border: 1px solid var(--vscode-widget-border);
            font-weight: normal;
            font-size: 12px;
            line-height: 1.4;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .tooltip::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: var(--vscode-widget-border) transparent transparent transparent;
        }
        .info-icon:hover .tooltip {
            visibility: visible;
            opacity: 1;
        }
        .checkbox-group {
            display: flex;
            align-items: flex-start;
            margin-bottom: 20px;
        }
        .checkbox-group input[type="checkbox"] {
            margin-top: 3px;
            margin-right: 12px;
            cursor: pointer;
            width: 16px;
            height: 16px;
        }
        .checkbox-content {
            flex: 1;
        }
        .checkbox-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 4px;
            color: var(--vscode-editor-foreground);
        }
        .checkbox-description {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.5;
        }
        .checkbox-description a {
            color: #4daafc;
            text-decoration: none;
        }
        .checkbox-description a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1><span class="title-highlight">Create Minecraft Mod</span></h1>

        <!-- Project Details -->
        <div class="section">
            <div class="section-title">
                <svg viewBox="0 0 16 16"><path d="M8 1l7 4-7 4-7-4 7-4zm0 9l7-4v5l-7 4-7-4v-5l7 4z"/></svg>
                Project Details
            </div>
            <div class="form-group">
                <label class="required">Project Name:</label>
                <div class="input-wrapper">
                    <svg viewBox="0 0 16 16"><path d="M14 2H2V14H14V2ZM1 1V15H15V1H1Z"/></svg>
                    <input type="text" id="projectName" placeholder="MyMod">
                </div>
            </div>
            <div class="form-group">
                <label class="required">
                    Package Name:
                    <div class="info-icon">
                        <svg viewBox="0 0 16 16"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm1 10H7V7h2v4zm0-5H7V4h2v2z"/></svg>
                        <span class="tooltip">Choose a unique package name for your new mod. The package name should be unique to you. If you are unsure about this use name.modid.</span>
                    </div>
                </label>
                <div class="input-wrapper" id="packageWrapper">
                    <svg viewBox="0 0 16 16"><path d="M8 1l7 4-7 4-7-4 7-4zm0 9l7-4v5l-7 4-7-4v-5l7 4z"/></svg>
                    <input type="text" id="packageName" placeholder="com.example">
                </div>
                <div class="error-message" id="packageError">Invalid package format. Use "name.modid" (no hyphens, no trailing dot).</div>
            </div>
        </div>

        <!-- Mod Information -->
        <div class="section">
            <div class="section-title">
                <svg viewBox="0 0 16 16"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zm0 1a5.5 5.5 0 110 11 5.5 5.5 0 010-11zm-.5 2v4.5l3.5 1.5.5-1-3-1v-4h-1z"/></svg>
                Mod Information
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="required">Mod Version:</label>
                    <div class="input-wrapper">
                        <svg viewBox="0 0 16 16"><path d="M8 2l6 3v5l-6 3-6-3V5l6-3zm0 1.2L3.2 5.5 8 7.8l4.8-2.3L8 3.2z"/></svg>
                        <input type="text" id="modVersion" value="1.0.0-SNAPSHOT">
                    </div>
                </div>
                <div class="form-group">
                    <label class="required">Author Name:</label>
                    <div class="input-wrapper">
                        <svg viewBox="0 0 16 16"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 1c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/></svg>
                        <input type="text" id="authorName" placeholder="Your Name">
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Website (optional):</label>
                <div class="input-wrapper">
                    <svg viewBox="0 0 16 16"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.1a5.9 5.9 0 014.2 1.7A10.6 10.6 0 008 5.6C6.1 5.6 4.3 4.8 2.8 3.8A5.9 5.9 0 018 2.1zm-4.8 2.2c1.4 1 3 1.7 4.8 1.7s3.4-.7 4.8-1.7a5.9 5.9 0 011.8 3.5h-3.3c-.2-1-.6-1.9-1.2-2.7L9.4 6c.4.7.7 1.5.8 2.3h1.6c-.3 1.4-1 2.6-2 3.6-1-1-1.7-2.2-2-3.6H9.4c.1-.8.4-1.6.8-2.3l-.7-.7c-.6.8-1 1.7-1.2 2.7H5V8.3c.1-1.4.8-2.6 1.8-3.6a10.6 10.6 0 004.8 1.7c-1.8 0-3.4-.8-4.8-1.7zm0 9.4c1.4-1 3-1.7 4.8-1.7s3.4.7 4.8 1.7a5.9 5.9 0 01-9.6 0z"/></svg>
                    <input type="text" id="website" placeholder="https://example.com">
                </div>
            </div>
        </div>

        <!-- Technical Settings -->
        <div class="section">
            <div class="section-title">
                <svg viewBox="0 0 16 16"><path d="M14.5 1h-13A1.5 1.5 0 000 2.5v11A1.5 1.5 0 001.5 15h13a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0014.5 1zM2 3h4v4H2V3zm12 10H2v-2h12v2zm0-4H8V7h6v2zm0-4H8V3h6v2z"/></svg>
                Technical Settings
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Minecraft Version:</label>
                    <div class="input-wrapper">
                        <svg viewBox="0 0 16 16"><path d="M3 1h10a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V3a2 2 0 012-2zm0 1a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1H3zm2 3h2v2H5V5zm4 0h2v2H9V5zm-4 4h6v2H5V9z"/></svg>
                        <select id="mcVersion">
                            <option>Loading...</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Mod Loader:</label>
                    <div class="input-wrapper">
                        <svg viewBox="0 0 16 16"><path d="M15 2l-7 4-7-4v9l7 4 7-4V2z"/></svg>
                        <select id="modLoader">
                            <option>Fabric</option>
                            <option>Forge</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Java Version:</label>
                <div class="input-wrapper">
                    <select id="javaVersion">
                        <option>Java 21</option>
                        <option>Java 17</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Advanced Settings -->
        <div class="section" id="advancedSettings">
            <div class="checkbox-group">
                <input type="checkbox" id="kotlinLang">
                <div class="checkbox-content">
                    <span class="checkbox-label">Kotlin Programming Language</span>
                    <div class="checkbox-description">Kotlin is a alternative programming language that can be used to develop mods. The <a href="#">Fabric Kotlin language adapter</a> is used to enable support for creating Fabric Kotlin mods.</div>
                </div>
            </div>

            <div class="checkbox-group">
                <input type="checkbox" id="mojangMappings" checked>
                <div class="checkbox-content">
                    <span class="checkbox-label">Mojang Mappings</span>
                    <div class="checkbox-description">Use Mojang's official mappings rather than Yarn. Note that Mojang's mappings come with a usable yet more restrictive license than Yarn. Use them at your own risk.</div>
                </div>
            </div>

            <div class="checkbox-group">
                <input type="checkbox" id="dataGen">
                <div class="checkbox-content">
                    <span class="checkbox-label">Data Generation</span>
                    <div class="checkbox-description">This option configures the <a href="#">Fabric Data Generation API</a> in your mod. This allows you to generate resources such as recipes from code at build time.</div>
                </div>
            </div>

            <div class="checkbox-group">
                <input type="checkbox" id="splitSources" checked>
                <div class="checkbox-content">
                    <span class="checkbox-label">Split client and common sources</span>
                    <div class="checkbox-description">A common source of server crashes comes from calling client only code when installed on a server. This option configures your mod to be built from two source sets, client and main. This enforces a clear separation between the client and server code.</div>
                </div>
            </div>
        </div>
        
        <button class="submit-btn" id="createBtn">Create Mod</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const packageInput = document.getElementById('packageName');
        const packageWrapper = document.getElementById('packageWrapper');
        const packageError = document.getElementById('packageError');
        const mcVersionSelect = document.getElementById('mcVersion');

        // Dynamically fetch ALL stable Minecraft Versions from the official Fabric Meta API
        fetch('https://meta.fabricmc.net/v2/versions/game')
            .then(res => res.json())
            .then(data => {
                mcVersionSelect.innerHTML = '';
                // Only select stable releases
                data.filter(v => v.stable).forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.version;
                    opt.innerText = v.version;
                    mcVersionSelect.appendChild(opt);
                });
            })
            .catch(err => {
                console.error("Failed to load Minecraft versions natively", err);
                // Fallback basic values if offline
                mcVersionSelect.innerHTML = '<option>1.21.4</option><option>1.20.1</option><option>1.16.5</option>';
            });

        function validatePackageName(str) {
            // Must contain at least one dot, cannot end or start with a dot
            // Cannot contain hyphens, spaces, or capitals (usually lowercase)
            // Example: name.modid
            const isValidLength = str.length > 0;
            const hasNoHyphensSpaces = !/[- ]/.test(str);
            const hasNoTrailingLeadingDots = !str.startsWith('.') && !str.endsWith('.');
            const hasDot = str.includes('.');
            
            return isValidLength && hasNoHyphensSpaces && hasNoTrailingLeadingDots && hasDot;
        }

        packageInput.addEventListener('input', () => {
            if (packageInput.value.length > 0 && !validatePackageName(packageInput.value)) {
                packageWrapper.classList.add('error');
                packageError.style.display = 'block';
            } else {
                packageWrapper.classList.remove('error');
                packageError.style.display = 'none';
            }
        });

        document.getElementById('createBtn').addEventListener('click', () => {
            if (!validatePackageName(packageInput.value)) {
                packageWrapper.classList.add('error');
                packageError.style.display = 'block';
                return;
            }

            vscode.postMessage({
                command: 'create',
                data: {
                    projectName: document.getElementById('projectName').value,
                    packageName: document.getElementById('packageName').value,
                    modVersion: document.getElementById('modVersion').value,
                    authorName: document.getElementById('authorName').value,
                    website: document.getElementById('website').value,
                    mcVersion: document.getElementById('mcVersion').value,
                    modLoader: document.getElementById('modLoader').value,
                    javaVersion: document.getElementById('javaVersion').value,
                    kotlinLang: document.getElementById('kotlinLang').checked,
                    mojangMappings: document.getElementById('mojangMappings').checked,
                    dataGen: document.getElementById('dataGen').checked,
                    splitSources: document.getElementById('splitSources').checked
                }
            });
        });
    </script>
</body>
</html>`;
}
