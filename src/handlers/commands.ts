import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
	ApplicationCommand,
	type ApplicationCommandData,
	type ChatInputApplicationCommandData,
	type Client,
	Collection,
	type CommandInteraction,
	type ContextMenuCommandInteraction,
	type Message,
} from "discord.js";

interface SynchronizeSlashCommandOptions {
	guildId?: null | string;
	debug?: boolean;
}

export const synchronizeSlashCommands = async (
	client: Client,
	commands: ChatInputApplicationCommandData[],
	options: SynchronizeSlashCommandOptions = {},
) => {
	const log = (message: string) => options.debug && console.log(message);

	const ready = client.readyAt ? Promise.resolve() : new Promise((resolve) => client.once("ready", resolve));
	await ready;
	const currentCommands = options.guildId
		? // biome-ignore lint: client.application is always defined
			await client.application!.commands.fetch({
				guildId: options.guildId,
			})
		: // biome-ignore lint: client.application is always defined
			await client.application!.commands.fetch();

	log("Synchronizing commands...");
	log(`Currently ${currentCommands.size} commands.`);

	const newCommands = commands.filter((command) => !currentCommands.some((c) => c.name === command.name));
	for (const newCommand of newCommands) {
		if (options.guildId) await client.application?.commands.create(newCommand, options.guildId);
		else await client.application?.commands.create(newCommand);
	}

	log(`Created ${newCommands.length} commands!`);

	const deletedCommands = currentCommands.filter((command) => !commands.some((c) => c.name === command.name)).toJSON();
	for (const deletedCommand of deletedCommands) {
		await deletedCommand.delete();
	}

	log(`Deleted ${deletedCommands.length} commands!`);

	const updatedCommands = commands.filter((command) => currentCommands.some((c) => c.name === command.name));
	let updatedCommandCount = 0;
	for (const updatedCommand of updatedCommands) {
		const newCommand = updatedCommand;
		const previousCommand = currentCommands.find((c) => c.name === updatedCommand.name);
		let modified = false;
		if (previousCommand?.description !== newCommand?.description) modified = true;
		if (!ApplicationCommand.optionsEqual(previousCommand?.options ?? [], newCommand.options ? Array.from(newCommand.options) : [])) modified = true;
		if (modified) {
			await previousCommand?.edit(newCommand as unknown as ApplicationCommandData);
			updatedCommandCount++;
		}
	}

	log(`Updated ${updatedCommandCount} commands!`);

	log("Commands synchronized!");

	return {
		currentCommandCount: currentCommands.size,
		newCommandCount: newCommands.length,
		deletedCommandCount: deletedCommands.length,
		updatedCommandCount,
	};
};

export type SlashCommandRunFunction = (interaction: CommandInteraction<'cached'>, commandName: string) => void;

export type MessageCommandRunFunction = (message: Message, commandName: string) => void;

export type ContextMenuRunFunction = (interaction: ContextMenuCommandInteraction, contextMenuName: string) => void;

export const loadSlashCommands = async (client: Client) => {
	const commands = new Collection<string, SlashCommandRunFunction>();
	const commandsData: ChatInputApplicationCommandData[] = [];

	try {
		const commandsPath = join(import.meta.dirname, "..", "slash-commands");
		const files = readdirSync(commandsPath);
		for (const file of files) {
			if (file.endsWith(".js")) {
				const commandModule = await import(join(commandsPath, file));
				const command = commandModule.default || commandModule;
				if (!command.commands) console.log(`${file} has no commands`);
				else {
					commandsData.push(...command.commands);
					command.commands.forEach((commandData: ChatInputApplicationCommandData) => {
						commands.set(commandData.name, command.run);
						console.log(`Loaded slash command ${commandData.name}`);
					});
				}
			}
		}
	} catch (e) {
		console.error(e);
		console.log("No slash commands found");
	}

	return {
		slashCommands: commands,
		slashCommandsData: commandsData,
	};
};

export const loadMessageCommands = async (client: Client) => {
	const commands = new Collection<string, MessageCommandRunFunction>();

	try {
		const commandsPath = join(import.meta.dirname, "..", "commands");
		const files = readdirSync(commandsPath);
		for (const file of files) {
			if (file.endsWith(".js")) {
				const commandModule = await import(join(commandsPath, file));
				const command = commandModule.default || commandModule;
				if (!command.commands) console.log(`${file} has no commands`);
				else {
					command.commands.forEach((commandName: string) => {
						commands.set(commandName, command.run);
						console.log(`Loaded message command ${commandName}`);
					});
				}
			}
		}
	} catch (e) {
		console.error(e);
		console.log("No message commands found");
	}

	return commands;
};

export const loadContextMenus = async (client: Client) => {
	const contextMenus = new Collection<string, ContextMenuRunFunction>();
	const contextMenusData: ChatInputApplicationCommandData[] = [];

	try {
		const contextMenusPath = join(import.meta.dirname, "..", "context-menus");
		const files = readdirSync(contextMenusPath);
		for (const file of files) {
			if (file.endsWith(".js")) {
				const contextMenuModule = await import(join(contextMenusPath, file));
				const contextMenu = contextMenuModule.default || contextMenuModule;
				if (!contextMenu.contextMenus) console.log(`${file} has no menus`);
				else {
					contextMenusData.push(...contextMenu.contextMenus);
					contextMenu.contextMenus.forEach((contextMenuData: ChatInputApplicationCommandData) => {
						contextMenus.set(contextMenuData.name, contextMenu.run);
						console.log(`Loaded context menu ${contextMenuData.name}`);
					});
				}
			}
		}
	} catch (e) {
		console.error(e);
		console.log("No context menus found");
	}

	return {
		contextMenus,
		contextMenusData,
	};
};
