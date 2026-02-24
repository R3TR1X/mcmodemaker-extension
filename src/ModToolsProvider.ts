import * as vscode from 'vscode';

export class ModToolsProvider implements vscode.TreeDataProvider<ModToolItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<ModToolItem | undefined | void> = new vscode.EventEmitter<ModToolItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ModToolItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ModToolItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ModToolItem): Thenable<ModToolItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            return Promise.resolve([
                new ModToolItem('Add Command', vscode.TreeItemCollapsibleState.None, {
                    command: 'mcmodmaker.addCommand',
                    title: 'Add Command'
                }, new vscode.ThemeIcon('symbol-class')),
                new ModToolItem('Add Event Listener', vscode.TreeItemCollapsibleState.None, {
                    command: 'mcmodmaker.addEventListener',
                    title: 'Add Event Listener'
                }, new vscode.ThemeIcon('zap')),
                new ModToolItem('Add Config File', vscode.TreeItemCollapsibleState.None, {
                    command: 'mcmodmaker.addConfigFile',
                    title: 'Add Config File'
                }, new vscode.ThemeIcon('gear')),
                new ModToolItem('Create Mod', vscode.TreeItemCollapsibleState.None, {
                    command: 'mcmodmaker.createMod',
                    title: 'Create Mod'
                }, new vscode.ThemeIcon('new-file'))
            ]);
        }
    }
}

export class ModToolItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri }
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = '';
    }
}
