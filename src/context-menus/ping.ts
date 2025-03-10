import type { ContextMenuCommandInteraction } from "discord.js";
import type { ContextMenuRunFunction } from "../handlers/commands.js";

export const contextMenus = [
	{
		name: "Ping",
		type: 3,
	},
];

export const run: ContextMenuRunFunction = async (interaction: ContextMenuCommandInteraction) => {
	interaction.reply(`🏓 Pong! My latency is currently \`${interaction.client.ws.ping}ms\`.`);
};
