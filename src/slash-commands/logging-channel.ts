import {
    ChannelType
} from 'discord.js';
import dedent from 'dedent';
import { sentenceCase } from 'change-case';

import type { SlashCommandRunFunction } from '../handlers/commands.js';
import { getPostgresRepository } from '../database/database.js';
import LogChannelConfig from '../database/LogChannelConfig.js';
import {
    errorEmbed,
    createButtonRow,
    successEmbed,
    createSelectRow,
    createInteractionManager
} from '../util.js';

export const
    logTypes = [
    ] as const,
    commands = [{
        name: "logging-channel",
        description: "Configure the logging channel",
    }],
    run: SlashCommandRunFunction = async interaction => {
        const
            interactionManager = createInteractionManager(interaction),
            { guildId } = interactionManager,
            logChannelConfig = await (await getPostgresRepository(LogChannelConfig)).findOneBy({ guildId }) as LogChannelConfig | null,
            {
                channelId,
                logs
            } = logChannelConfig || {};

        await interactionManager.respond({
            embeds: (
                logChannelConfig
                    ? successEmbed(dedent `
                        The current logging channel is <#${channelId}>.
    
                        ${
                            logs
                                ? logs.length > 0
                                    ? dedent `
                                        The following logs are enabled :
                                        - ${logs.map(_ => sentenceCase(_)).join('\n- ')}
                                    `
                                    : 'Logs are disabled.'
                                : 'All logs are enabled.'
                        }
                    `)
                    : errorEmbed("No logging channel is set for this server!")
            ).embeds,
            components: [
                createButtonRow([
                    {
                        id: 'set',
                        label: 'Set logging channel'
                    },
                    ...channelId ? [{
                        id: 'toggle-logs',
                        label: 'Toggle logs'
                    }] : []
                ])
            ]
        });

        await interactionManager.onInput();

        switch(interactionManager.getCurrentCustomId()){
            case 'set': {
                await interactionManager.respond({
                    components: [createSelectRow({
                        type: 'channel',
                        placeholder: 'Select a channel',
                        channelTypes: [ChannelType.GuildText],
                        defaultValues: channelId ? [channelId] : []
                    })]
                });
                await interactionManager.onInput();

                const [newChannelId] = interactionManager.getCurrentValues();
                await Promise.allSettled([
                    (async () =>
                        await (await getPostgresRepository(LogChannelConfig)).upsert({
                            channelId: newChannelId,
                            guildId,
                            createdByDiscordId: interactionManager.userId
                        }, ['guildId'])
                    )(),
                    interactionManager.defer()
                ]);

                return interactionManager.respond(successEmbed(`Successfully set the logging channel to <#${newChannelId}>!`));
            }
            case 'toggle-logs': {
                const logOptions = logTypes.map(value => ({
                    label: sentenceCase(value),
                    value: value
                }));
                await interactionManager.respond({
                    components: [createSelectRow({
                        type: 'string',
                        placeholder: 'Select logs to enable',
                        minValues: 0,
                        maxValues: logOptions.length,
                        options: logOptions,
                        defaultValues: logs
                    })]
                });
                await interactionManager.onInput()
                const selectedLogs = interactionManager.getCurrentValues();
                await Promise.allSettled([
                    (async () => await (await getPostgresRepository(LogChannelConfig))
                        .update({ guildId }, { logs: selectedLogs }))(),
                    interactionManager.defer()
                ]);
                await interactionManager.respond(successEmbed(dedent `
                    ${selectedLogs.length > 0 ? dedent `
                        Enabled logs are now as follows :
            
                        - ${selectedLogs.map(_ => sentenceCase(_)).join('\n- ')}
                    ` : 'Logs are now disabled.'}
                `));
                break;
            }
        }
    };