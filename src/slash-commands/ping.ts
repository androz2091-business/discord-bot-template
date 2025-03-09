import { CommandInteractionOptionResolver } from "discord.js";
import type { SlashCommandRunFunction } from "../handlers/commands.js";

export const commands = [
	{
		name: "ping",
		description: "Get the bot's latency",
	},
];

export const run: SlashCommandRunFunction = async (interaction) => {

	const options = (interaction.options as CommandInteractionOptionResolver);
	// use options!

	interaction.reply(`🏓 Pong! My latency is currently \`${interaction.client.ws.ping}ms\`.`);
};
