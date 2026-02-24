import * as vscode from 'vscode';

export async function addEventListener() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('You must have a workspace opened to add an Event Listener.');
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

        // 2. Event Type Selection Dropdown
        const events = [
            { label: 'Player Join Server', description: 'Triggered when a player connects to the server.', id: 'player_join' },
            { label: 'Player Leave Server', description: 'Triggered when a player disconnects from the server.', id: 'player_leave' },
            { label: 'Block Break', description: 'Triggered before a player breaks a block.', id: 'block_break' },
            { label: 'Item Use', description: 'Triggered when a player uses an item.', id: 'item_use' },
            { label: 'Entity Attack', description: 'Triggered when a player attacks an entity.', id: 'entity_attack' }
        ];

        const selectedEvent = await vscode.window.showQuickPick(events, {
            placeHolder: 'Select the Minecraft Event you want to listen to',
            title: 'Add Event Listener'
        });

        if (!selectedEvent) return;

        // 3. Prompt for Class Name
        const defaultClassName = selectedEvent.label.replace(/[^a-zA-Z]/g, '') + 'Listener';
        const className = await vscode.window.showInputBox({
            prompt: `What should the Class name be?`,
            value: defaultClassName,
            validateInput: text => text && text.trim().length > 0 ? null : "Class name cannot be empty."
        });

        if (!className) return;

        // 4. File Configuration
        const langExt = isKotlin ? 'kt' : 'java';
        const langFolder = isKotlin ? 'kotlin' : 'java';
        const eventsDirUri = vscode.Uri.joinPath(rootDir, 'src', 'main', langFolder, packagePath, 'events');

        try { await vscode.workspace.fs.createDirectory(eventsDirUri); } catch (e) { }

        const fileUri = vscode.Uri.joinPath(eventsDirUri, `${className}.${langExt}`);

        try {
            await vscode.workspace.fs.stat(fileUri);
            vscode.window.showErrorMessage(`File ${className}.${langExt} already exists!`);
            return;
        } catch { }

        // 5. Build Content dynamically based on Event ID and Kotlin vs Java
        let content = '';

        if (isKotlin) {
            switch (selectedEvent.id) {
                case 'player_join':
                    content = `package ${packageName}.events

import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents
import net.minecraft.server.network.ServerPlayerEntity

object ${className} {
    fun register() {
        ServerPlayConnectionEvents.JOIN.register { handler, sender, server ->
            val player: ServerPlayerEntity = handler.player
            println("Player \${player.name.string} joined the server!")
        }
    }
}
`;
                    break;
                case 'player_leave':
                    content = `package ${packageName}.events

import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents
import net.minecraft.server.network.ServerPlayerEntity

object ${className} {
    fun register() {
        ServerPlayConnectionEvents.DISCONNECT.register { handler, server ->
            val player: ServerPlayerEntity = handler.player
            println("Player \${player.name.string} left the server!")
        }
    }
}
`;
                    break;
                case 'block_break':
                    content = `package ${packageName}.events

import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents
import net.minecraft.block.BlockState
import net.minecraft.block.entity.BlockEntity
import net.minecraft.entity.player.PlayerEntity
import net.minecraft.util.math.BlockPos
import net.minecraft.world.World

object ${className} {
    fun register() {
        PlayerBlockBreakEvents.BEFORE.register { world: World, player: PlayerEntity, pos: BlockPos, state: BlockState, entity: BlockEntity? ->
            println("Player \${player.name.string} is breaking \${state.block.name.string} at \${pos.toShortString()}")
            true // Return true to allow the block break, false to cancel it.
        }
    }
}
`;
                    break;
                case 'item_use':
                    content = `package ${packageName}.events

import net.fabricmc.fabric.api.event.player.UseItemCallback
import net.minecraft.entity.player.PlayerEntity
import net.minecraft.item.ItemStack
import net.minecraft.util.Hand
import net.minecraft.util.TypedActionResult
import net.minecraft.world.World

object ${className} {
    fun register() {
        UseItemCallback.EVENT.register { player: PlayerEntity, world: World, hand: Hand ->
            val stack: ItemStack = player.getStackInHand(hand)
             if (!world.isClient) {
                 println("Player \${player.name.string} used item \${stack.item.name.string}")
             }
            TypedActionResult.pass(ItemStack.EMPTY) 
            // Return pass, success, or fail. pass() allows the item's default action.
        }
    }
}
`;
                    break;
                case 'entity_attack':
                    content = `package ${packageName}.events

import net.fabricmc.fabric.api.event.player.AttackEntityCallback
import net.minecraft.entity.Entity
import net.minecraft.entity.player.PlayerEntity
import net.minecraft.util.ActionResult
import net.minecraft.util.Hand
import net.minecraft.util.hit.EntityHitResult
import net.minecraft.world.World

object ${className} {
    fun register() {
        AttackEntityCallback.EVENT.register { player: PlayerEntity, world: World, hand: Hand, entity: Entity, hitResult: EntityHitResult? ->
            if (!world.isClient) {
                 println("Player \${player.name.string} attacked entity \${entity.name.string}")
            }
            ActionResult.PASS 
            // Return PASS, SUCCESS, FAIL, or CONSUME.
        }
    }
}
`;
                    break;
            }
        } else { // Java
            switch (selectedEvent.id) {
                case 'player_join':
                    content = `package ${packageName}.events;

import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.network.ServerPlayerEntity;

public class ${className} {
    public static void register() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            System.out.println("Player " + player.getName().getString() + " joined the server!");
        });
    }
}
`;
                    break;
                case 'player_leave':
                    content = `package ${packageName}.events;

import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.network.ServerPlayerEntity;

public class ${className} {
    public static void register() {
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            System.out.println("Player " + player.getName().getString() + " left the server!");
        });
    }
}
`;
                    break;
                case 'block_break':
                    content = `package ${packageName}.events;

import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;

public class ${className} {
    public static void register() {
        PlayerBlockBreakEvents.BEFORE.register((world, player, pos, state, entity) -> {
            System.out.println("Player " + player.getName().getString() + " is breaking " + state.getBlock().getName().getString() + " at " + pos.toShortString());
            return true; // Return true to allow the block break, false to cancel it.
        });
    }
}
`;
                    break;
                case 'item_use':
                    content = `package ${packageName}.events;

import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.item.ItemStack;
import net.minecraft.util.TypedActionResult;

public class ${className} {
    public static void register() {
        UseItemCallback.EVENT.register((player, world, hand) -> {
            ItemStack stack = player.getStackInHand(hand);
            if (!world.isClient()) {
                 System.out.println("Player " + player.getName().getString() + " used item " + stack.getItem().getName().getString());
            }
            return TypedActionResult.pass(ItemStack.EMPTY); 
            // Return pass, success, or fail. pass() allows the item's default action.
        });
    }
}
`;
                    break;
                case 'entity_attack':
                    content = `package ${packageName}.events;

import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.util.ActionResult;

public class ${className} {
    public static void register() {
        AttackEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
            if (!world.isClient()) {
                 System.out.println("Player " + player.getName().getString() + " attacked entity " + entity.getName().getString());
            }
            return ActionResult.PASS; 
            // Return PASS, SUCCESS, FAIL, or CONSUME.
        });
    }
}
`;
                    break;
            }
        }

        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));

        // 6. Navigate to File
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`Created ${className}! Remember to call ${className}.register() in your ModInitializer.`);

    } catch (error: any) {
        vscode.window.showErrorMessage("Error adding Event Listener: " + error.message);
        console.error(error);
    }
}
