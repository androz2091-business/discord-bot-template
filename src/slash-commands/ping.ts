import type {
    SlashCommandRunFunction
} from '../handlers/commands.js';

import {
    respond
} from '../util.js';

export const
    commands = [{
        name: 'ping',
        description: `Get the bot's latency`
    }],
    run: SlashCommandRunFunction = async interaction => {
		await respond(interaction, { content: `🏓 Pong! My latency is currently \`${interaction.client.ws.ping}ms\`.` });
	};