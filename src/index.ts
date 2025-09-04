import 'dotenv/config';
import {
	Client,
	IntentsBitField,
	CommandInteraction,
	EmbedBuilder
} from 'discord.js';
import dayjs from 'dayjs';

import './sentry.js';
import {
	loadSlashCommands,
	loadContextMenus,
	loadMessageCommands,
	synchronizeSlashCommands,
	loadGlobalListeners
} from './handlers/commands.js';
import { loadTasks } from './handlers/tasks.js';
import {
	getSendLog
} from './util.js';
import {
	initialize as initializeDatabase,
	getPostgresRepository
} from './database/database.js';
import GlobalEmitter from './database/GlobalEmitter.js';
import { syncSheets } from './integrations/sheets.js';

export const client = new Client({
	intents: [
		IntentsBitField.Flags.Guilds,
		IntentsBitField.Flags.GuildMessages
	]
});

const { slashCommands, slashCommandsData } = await loadSlashCommands(client);
const { contextMenus, contextMenusData } = await loadContextMenus(client);
const messageCommands = loadMessageCommands(client);
const globalListeners = await loadGlobalListeners();
loadTasks(client);

synchronizeSlashCommands(client, [...slashCommandsData, ...contextMenusData], {
	debug: true,
	guildId: process.env.GUILD_ID,
});

client.on("interactionCreate", async (interaction) => {
	if (interaction.isCommand()) {
		const isContext = interaction.isContextMenuCommand();
		if (isContext) {
			const run = contextMenus.get(interaction.commandName);
			if (!run) return;
			run(interaction, interaction.commandName);
		} else {
			const run = slashCommands.get(interaction.commandName);
			if (!run) return;
			await (await getSendLog(
				(interaction as CommandInteraction<'cached'>).guildId,
				'command-run',
				interaction.client
			))?.({
				embeds: [new EmbedBuilder({
					title: `Command run report : \`/${(interaction as CommandInteraction).command?.name}\``,
					fields: [
						{
							name: 'Channel:',
							value: `<#${interaction.channelId}>`,
							inline: true
						},
						{
							name: 'Timestamp:',
							value: `<t:${dayjs(interaction.createdTimestamp).unix()}:f>`,
							inline: true
						},
						{
							name: 'User:',
							value: `<@${interaction.user.id}>`,
							inline: true
						}
					]
				})]
			});
			run(interaction as CommandInteraction<'cached'>, interaction.commandName);
		}
	}

	if(interaction.inCachedGuild() && (interaction.isButton() || interaction.isAnySelectMenu())){
		const globalEmitter = await (await getPostgresRepository(GlobalEmitter)).findOneBy({ id: interaction.customId });
		if(!globalEmitter) return;
		const globalListener = globalListeners[globalEmitter.event];
		if(!globalListener) return;
		return globalListener(interaction, JSON.parse(globalEmitter.context));
	}
});

client.on("messageCreate", async (message) => {
	if (message.author.bot) return;

	if (!process.env.COMMAND_PREFIX) return;

	const args = message.content.slice(process.env.COMMAND_PREFIX.length).split(/ +/);
	const commandName = args.shift();

	if (!commandName) return;

	const run = (await messageCommands).get(commandName);

	if (!run) return;

	run(message, commandName);
});

client.on("ready", () => {
	console.log(`Logged in as ${client.user?.tag}. Ready to serve ${client.users.cache.size} users in ${client.guilds.cache.size} servers 🚀`);

	if (process.env.DB_NAME) {
		initializeDatabase().then(() => {
			console.log("Database initialized 📦");
		});
	} else {
		console.log("Database not initialized, as no keys were specified 📦");
	}

	if (process.env.SPREADSHEET_ID) {
		syncSheets();
	}
});

client.login(process.env.DISCORD_CLIENT_TOKEN);
