import {
	randomUUID
} from 'node:crypto';
import {
	inspect
} from 'node:util';

import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ChannelSelectMenuBuilder,
	RoleSelectMenuBuilder,
	UserSelectMenuBuilder,
	StringSelectMenuBuilder,
	ChannelType,
	MessageComponentInteraction,
	AnySelectMenuInteraction,
	Message,
	InteractionCallbackResponse,
	ButtonInteraction,
	APISelectMenuOption,
	Client,
	GuildTextBasedChannel,
	MessageFlags,
	CommandInteraction,
	InteractionResponse,
	Collection,
	ModalActionRowComponent,
	ModalSubmitInteraction,
	InteractionEditReplyOptions,
	InteractionReplyOptions,
	InteractionUpdateOptions,
	StringSelectMenuInteraction,
	UserSelectMenuInteraction,
	ChannelSelectMenuInteraction,
	RoleSelectMenuInteraction,
	MessageCreateOptions,
	TextDisplayBuilder
} from 'discord.js';
import {
	In
} from "typeorm";

import { getPostgresRepository } from './database/database.js';
import Config from './database/Config.js';
import LogChannelConfig from './database/LogChannelConfig.js';
import GlobalEmitter from './database/GlobalEmitter.js';

export const errorEmbed = (message: string) => {
	return {
		embeds: [new EmbedBuilder().setDescription(`❌ | ${message}`).setColor(process.env.EMBED_COLOR)],
	};
};

export const successEmbed = (message: string) => {
	return {
		embeds: [new EmbedBuilder().setDescription(`✅ | ${message}`).setColor(process.env.EMBED_COLOR)],
	};
};

export const replyEmbed = (message: string) => {
	return {
		embeds: [new EmbedBuilder().setDescription(message).setColor(process.env.EMBED_COLOR)],
	};
};

export const generateId = () => {
	return Math.random().toString(36).slice(2, 12);
};

export const generateEmbeds = <T>(
	{
		entries,
		generateEmbed,
		generateEntry,
	}: {
		entries: T[];
		generateEmbed: (idx: number) => EmbedBuilder;
		generateEntry: (entry: T) => string;
	},
	threshold = 2050,
) => {
	const embeds: EmbedBuilder[] = [];
	entries.forEach((entry) => {
		const entryContent = generateEntry(entry);
		// biome-ignore lint: embeds is going to be filled
		const lastEmbedTooLong = !embeds.length || embeds.at(-1)!.data.description!.length + entryContent.length >= threshold;
		if (lastEmbedTooLong) {
			const newEmbed = generateEmbed(embeds.length);
			embeds.push(newEmbed);
		}
		// biome-ignore lint: embeds is going to be filled
		const lastEmbed = embeds.at(-1)!;
		lastEmbed.data.description = (lastEmbed.data.description || "") + entryContent;
	});
	return embeds;
};

export const
	/** The maximum number of items allowed by Discord in a single select menu. */
	MAX_ITEMS_PER_SELECT_MENU = 25,
	/** The maximum number of buttons allowed by Discord on a single row. */
	MAX_BUTTONS_PER_ROW = 5,
	/** The maximum number of characters allowed by Discord in the value of an embed field. */
	MAX_EMBED_FIELD_VALUE_LENGTH = 1024,
	/**
	 * Fetches the configuration settings for a specific guild and a set of keys from the database.
	 *
	 * @param guildId - The unique identifier of the guild.
	 * @param keys - A list of configuration keys to fetch for the specified guild.
	 * @returns An object containing configuration key-value pairs where keys are strings and values can be boolean, string or number.
	 */
	getConfig = async (
		guildId: string,
		...keys: string[]
	): Promise<{ [key: string]: boolean | string | number }> => (
		await (await getPostgresRepository(Config))
			.find({
				where: {
					guildId,
					key: keys.length === 1 ? keys[0] : In(keys),
				}
			})
	).reduce((
		config,
		{
			key,
			type,
			booleanValue,
			stringValue,
			numberValue
		}
	) => ({
		...config,
		[key]: {
			'boolean': booleanValue,
			'string': stringValue,
			'number': numberValue,
		}[type as 'boolean' | 'string' | 'number'],
	}), {}),
	/**
	 * Sets the configuration settings for a specific guild.
	 *
	 * This method allows updating or inserting configuration key-value pairs for a given guild.
	 * It determines the type of each value (boolean, string or number) and appropriately maps the value
	 * to its respective property to be upserted into the database.
	 *
	 * @param guildId - The unique identifier of the guild.
	 * @param config - An object containing configuration key-value pairs where keys are strings and values can be boolean, string or number.
	 */
	setConfig = async (
		guildId: string,
		config: { [key: string]: boolean | string | number }
	) =>
		await (await getPostgresRepository(Config))
			.upsert(
				Object
					.entries(config)
					.map(([key, value]) => ({
						guildId,
						key,
						type: typeof value,
						...typeof value === 'boolean' ? { booleanValue: value } : {},
						...typeof value === 'string' ? { stringValue: value } : {},
						...typeof value === 'number' ? { numberValue: value } : {},
					})),
				['guildId', 'key']
			),
	/**
	 * Create a button row.
	 *
	 * @param buttons - An array of buttons.
	 * @param [buttons.id] - The unique identifier for the button, defaults to a randomly generated UUID, not applicable to links.
	 * @param buttons.label - The label displayed on the button.
	 * @param [buttons.url] - The URL the button navigates to, if applicable.
	 * @param [buttons.style] - The visual style of the button, defaults to "secondary", not applicable to links.
	 * @param [buttons.emoji] - An optional emoji displayed on the button.
	 *
	 * @returns An `ActionRow` of buttons.
	 */
	createButtonRow = (
		buttons: {
			id?: string;
			label: string;
			url?: string;
			style?: 'success' | 'danger' | 'primary' | 'secondary';
			emoji?: string
		}[]
	) =>
		new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.map(({
			id,
			label,
			url,
			style = url ? 'link' : 'secondary',
			emoji
		}) =>
			//@ts-ignore
			new ButtonBuilder({
				customId: id || (url ? undefined : randomUUID()),
				label,
				url,
				style: {
					'success': ButtonStyle.Success,
					'danger': ButtonStyle.Danger,
					'primary': ButtonStyle.Primary,
					'secondary': ButtonStyle.Secondary,
					'link': ButtonStyle.Link
				}[style],
				emoji
			}))),
	/**
	 * Create a modal dialog.
	 * You'll likely want to use the `useModal` function instead, which automatically displays the modal and collects the submitted data.
	 *
	 * @param title - The title of the modal.
	 * @param inputs - An array of input field configurations for the modal.
	 * @param inputs.label - The label for the input field.
	 * @param [inputs.isRequired] - Specifies whether the input field is required.
	 * @param [inputs.minLength] - Specifies the minimum character length for the input value.
	 * @param [inputs.maxLength] - Specifies the maximum character length for the input value.
	 * @param [inputs.placeholder] - Placeholder text for the input field.
	 * @param [inputs.style] - The style of the input, either 'short' for single line or 'paragraph' for multiline.
	 * @param [inputs.value] - The default value for the input field.
	 *
	 * @returns A ModalBuilder of the modal dialog.
	 */
	createModal = ({
		title,
		inputs
	}: {
		title: string;
		inputs: {
			label: string;
			isRequired?: boolean;
			minLength?: number;
			maxLength?: number;
			placeholder?: string;
			style?: 'short' | 'paragraph';
			value?: string;
		}[]
	}) => new ModalBuilder({
		customId: randomUUID(),
		title,
		components: inputs.map(({
			label,
			isRequired,
			minLength,
			maxLength,
			placeholder,
			style,
			value
		}) => new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder({
			customId: randomUUID(),
			label,
			required: isRequired,
			minLength,
			maxLength,
			placeholder,
			style: {
				'short': TextInputStyle.Short,
				'paragraph': TextInputStyle.Paragraph
			}[style || 'short'],
			value
		})))
	}),
	/**
	 * Create a select menu row.
	 *
	 * @param type - The type of select menu to create.
	 * @param id - A unique identifier for the select menu, defaults to a randomly generated UUID.
	 * @param placeholder - Placeholder text displayed on the select menu.
	 * @param minValues - Minimum number of selections required.
	 * @param maxValues - Maximum number of selections allowed.
	 * @param channelTypes - An array of allowed channel types, only applicable to `type` = `channel`.
	 * @param defaultValues - Default selected values for the select menu.
	 * @param options - Options for the select menu, only applicable to `type` = `string`.
	 *
	 * @returns An `ActionRow` of the select menu.
	 */
	createSelectRow = <type extends 'channel' | 'role' | 'user' | 'string'>({
		type,
		id = randomUUID(),
		placeholder,
		minValues,
		maxValues,
		channelTypes,
		defaultValues,
		options
	}: {
		type: type,
		id?: string,
		placeholder: string,
		minValues?: number,
		maxValues?: number,
		channelTypes?: ChannelType[],
		defaultValues?: any[],
		options?: APISelectMenuOption[]
	}) : type extends 'channel' ? ActionRowBuilder<ChannelSelectMenuBuilder>
	   : type extends 'role'    ? ActionRowBuilder<RoleSelectMenuBuilder>
	   : type extends 'user'    ? ActionRowBuilder<UserSelectMenuBuilder>
								: ActionRowBuilder<StringSelectMenuBuilder> =>
	{
		const select = new ({
			'channel': ChannelSelectMenuBuilder,
			'role': RoleSelectMenuBuilder,
			'user': UserSelectMenuBuilder,
			'string': StringSelectMenuBuilder,
		}[type])({
			customId: id,
			placeholder,
			minValues,
			maxValues,
			channelTypes
		});
		if(defaultValues){
			if(select instanceof ChannelSelectMenuBuilder)
				select.setDefaultChannels(defaultValues);
			if(select instanceof RoleSelectMenuBuilder)
				select.setDefaultRoles(defaultValues);
			if(select instanceof UserSelectMenuBuilder)
				select.setDefaultUsers(defaultValues);
		}
		if(options && select instanceof StringSelectMenuBuilder)
			select.setOptions(...options.map(option => ({
				...option,
				default: defaultValues?.includes(option.value)
			})));
		return new ActionRowBuilder({ components: [select] }) as any;
	},
	/**
	 * Sends a response to a Discord interaction, automatically choosing the right method.
	 *
	 * @param interaction - The interaction to respond to.
	 * @param [payload] - The response payload, empty by default.
	 * @param [isResetPayload] - Whether to reset the payload (remove pre-existing components), enabled by default.
	 * @returns The sent or edited message.
	 */
	respond = async (
		interaction: CommandInteraction<'cached'> | MessageComponentInteraction<'cached'> | ModalSubmitInteraction<'cached'>,
		payload: InteractionEditReplyOptions | InteractionReplyOptions = {},
		isResetPayload: boolean = true
	): Promise<Message> => {
		if(isResetPayload)
			payload = {
				...payload,
				content: payload.content || (payload.embeds || payload.files || payload.components ? '' : '** **'),
				embeds: payload.embeds || [],
				files: payload.files || [],
				components: payload.components || []
			};
		if(interaction.deferred || interaction.replied)
			return interaction.editReply(payload as InteractionEditReplyOptions);
		else if(interaction instanceof MessageComponentInteraction)
			return (await interaction.update(payload as InteractionUpdateOptions)).fetch();
		payload.flags = [MessageFlags.Ephemeral];
		return (await interaction.reply(payload as InteractionReplyOptions)).fetch();
	},
	/**
	 * Display a modal and collect the submitted data.
	 *
	 * @param parentInteraction - The interaction to which the modal is tied.
	 * @param modalData - See the `createModal` function.
	 * @param isRemoveButton - Whether the button that triggered the interaction should be removed after the modal is shown.
	 * @returns The modal submit interaction and the submitted data.
	 */
	useModal = async (
		parentInteraction: MessageComponentInteraction<'cached'>,
		modalData: Parameters<typeof createModal>[0],
		isRemoveButton: boolean = true
	): Promise<{
		interaction: ModalSubmitInteraction<'cached'>;
		fields: Collection<string, ModalActionRowComponent>
	}> => new Promise(async resolve => {
		const modal = createModal(modalData);
		await parentInteraction.showModal(modal);
		if(isRemoveButton)
			await respond(parentInteraction, undefined);
		const [result] = await Promise.allSettled([
			parentInteraction.awaitModalSubmit({
				filter: interaction =>
					interaction.user.id === parentInteraction.user.id
					&& interaction.customId === modal.data.custom_id,
				time: 5 * 60 * 1000
			})
		]);
		if(result.status === 'fulfilled'){
			const interaction = result.value;
			resolve({
				interaction,
				fields: interaction.fields.fields
			});
		}
		else
			await parentInteraction.deleteReply();
	}),
	/**
	 * Listen to and handle a user interaction on a select menu or button.
	 * Automatically remove interaction components after the expiration delay of 5 minutes.
	 *
	 * @param parent - The parent message, interaction or response from which the listener is operating.
	 * @param [interaction] - The command interaction tied to the parent context, if applicable, for managing replies or deletion of interactions.
	 * @returns The interaction.
	 */
	onInput: {
		(parent: MessageComponentInteraction): Promise<AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>>;
		(parent: (Message | InteractionCallbackResponse), interaction?: CommandInteraction): Promise<AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>>;
		(parent: (Message | InteractionResponse), interaction?: CommandInteraction): Promise<AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>>;
	} = async (
		parent:
			Message |
			MessageComponentInteraction |
			InteractionCallbackResponse |
			InteractionResponse,
		interaction?: CommandInteraction
	): Promise<AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>> => new Promise(async resolve => {
		let message: Message, userId: string, remove;
		if(parent instanceof Message){
			message = parent;
			userId = parent.interactionMetadata!.user.id;
			if(interaction)
				remove = () => interaction.deleteReply();
		}
		if(parent instanceof MessageComponentInteraction){
			message = parent.message;
			userId = parent.user.id;
			remove = () => parent.deleteReply();
		}
		if(parent instanceof InteractionCallbackResponse){
			message = parent.resource!.message!;
			userId = parent.resource!.message!.interactionMetadata!.user.id;
			if(interaction)
				remove = () => interaction.deleteReply();
		}
		if(parent instanceof InteractionResponse){
			message = await parent.fetch();
			userId = parent.interaction.user.id;
			remove = () => message.delete();
		}
		const [result] = await Promise.allSettled([
			message!.awaitMessageComponent({
				filter: interaction => interaction.user.id === userId,
				time: 5 * 60 * 1000
			})
		]);
		if(result.status === 'fulfilled')
			resolve(result.value as AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>);
		else if(remove)
			remove();
	}),
	/**
	 * Log anything, but only top-level properties for objects.
	 * Useful for Discord.JS objects, for they are always deep.
	 * @param args - Anything.
	 */
	consoleLog = (...args: any[]) => console.log(...args.map(arg => inspect(arg, { depth: 0, colors: true }))),
	/**
	 * Generate, if applicable, a function for sending log messages to the appropriate channel and user with the appropriate mention,
	 * based on the provided log type and guild settings.
	 *
	 * @param guildId - The ID of the guild to send logs to.
	 * @param type - The type of logs to be sent.
	 * @param client - An instance of the Discord bot client, used to interact with channels and users.
	 * @param [userId] - If applicable, the ID of the user to carbon copy the log message to.
	 * @returns A function that takes a payload to send a log message if this log type is enabled for this guild.
	 */
	getSendLog = async (
		guildId: string,
		type: LogChannelConfig['logs'][number],
		client: Client,
		userId?: string,
	) => {
		const logChannelConfig = await (await getPostgresRepository(LogChannelConfig))
			.findOneBy({ guildId }) as LogChannelConfig;
		if(!logChannelConfig) return;
		const
			{
				logs,
				channelId,
				logMentions
			} = logChannelConfig,
			mention = logMentions?.[type];
		if(logs && !logs.includes(type)) return;
		return (payload: MessageCreateOptions) => {
			if(mention)
				payload.content = `<@&${mention}> ${payload.content || ''}`;
			return Promise.allSettled([
				(client.channels.cache.get(channelId) as GuildTextBasedChannel).send(payload),
				...userId ? [(async () => (await client.users.fetch(userId)).send(payload))()] : []
			]);
		};
	},
	/**
	 * Divide an array into smaller arrays of specific size.
	 * Useful to handle Discord's numerous size limits.
	 *
	 * @param array - The input array to be chunked.
	 * @param chunkSize - The size of each chunk.
	 * @returns An array of arrays.
	 */
	chunk = (array: any[], chunkSize: number) => [...Array(Math.ceil(array.length / chunkSize))]
		.map((_, index) => array.slice(index * chunkSize, index * chunkSize + chunkSize)),
	/**
	 * Create a centralized management utility for handling various types of Discord interactions.
	 * An all-in-one package for convenience methods that are otherwise usable independently.
	 *
	 * @param initialInteraction The initial interaction to operate from.
	 * @returns An interaction manager object with convenient methods to respond, defer, handle modals and select menus.
	 */
	createInteractionManager = (initialInteraction: CommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>) => {
		let
			currentInteraction: CommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'> = initialInteraction,
			currentModalInteraction: ModalSubmitInteraction<'cached'>;
		const
			props = new Map(),
			isUndeferredModalInteraction = () => currentModalInteraction && !currentModalInteraction.deferred,
			isUnrepliedModalInteraction = () => currentModalInteraction && !currentModalInteraction.replied,
			interactionManager = {
				/** The name of the command from which the interaction was created, if applicable. */
				commandName: initialInteraction instanceof CommandInteraction ? initialInteraction.commandName : undefined,
				/** The ID of the button from which the interaction was created, if applicable. */
				customId: initialInteraction instanceof ButtonInteraction ? initialInteraction.customId : undefined,
				/** The ID of the channel where the interaction was created. */
				channelId: initialInteraction.channelId,
				/** The ID of the guild where the interaction was created. */
				guildId: initialInteraction.guildId,
				/** The ID of the owner of the guild where the interaction was created. */
				guildOwnerId: initialInteraction.guild.ownerId,
				/** The ID of the user who created the interaction. */
				userId: initialInteraction.user.id,
				/** The tag of the user who created the interaction. */
				userTag: initialInteraction.user.tag,
				/** The timestamp at which the interaction was created. */
				createdTimestamp: initialInteraction.createdTimestamp,
				/** The member object of the user who created the interaction. */
				member: initialInteraction.member,
				/** The guild object of the guild where the interaction was created. */
				guild: initialInteraction.guild,
				/** The Discord client instance. */
				client: initialInteraction.client,
				getOption: (key: string) => (initialInteraction as CommandInteraction<'cached'>).options.get(key),
				/** Get a custom property attached to the interaction. */
				setProp: (key: string, value: any) => props.set(key, value),
				/** Set a custom property to be attached to the interaction. */
				getProp: (key: string) => props.get(key),
				/** See the `onInput` function. */
				onInput: async (parentOverride?: Message | InteractionResponse) => {
					if(parentOverride)
						return void (currentInteraction = await onInput(parentOverride, currentInteraction as CommandInteraction<'cached'>));
					if(currentInteraction instanceof CommandInteraction)
						return void (currentInteraction = await onInput(await currentInteraction.fetchReply(), currentInteraction));
					return void (currentInteraction = await onInput(currentInteraction));
				},
				/** See the `defer` function. */
				defer: (...args: Parameters<typeof defer> extends [any, ...infer R] ? R : never) => defer(isUndeferredModalInteraction() ? currentModalInteraction : currentInteraction, ...args),
				/** See the `respond` function. */
				respond: (...args: Parameters<typeof respond> extends [any, ...infer R] ? R : never) => respond(isUnrepliedModalInteraction() ? currentModalInteraction : currentInteraction, ...args),
				/** See the `useModal` function. */
				useModal: async (
					modalData: Parameters<typeof createModal>[0],
					isRemoveButton: boolean = true
				) => void (currentModalInteraction = (await useModal(
					currentInteraction as MessageComponentInteraction<'cached'>,
					modalData,
					isRemoveButton
				)).interaction),
				/** See the `useMenus` function. */
				useMenus: async <isFlatten extends boolean = true>(
					rows: (ActionRowBuilder<ChannelSelectMenuBuilder | RoleSelectMenuBuilder | StringSelectMenuBuilder | UserSelectMenuBuilder> | TextDisplayBuilder)[],
					valuesPerRow: (string | undefined)[][] = [],
					isResetPayload?: boolean,
					isFlatten: isFlatten = true as isFlatten
				): Promise<isFlatten extends true ? string[] : (string | undefined)[][]> => {
					const
						selectRows = rows.filter(row => row instanceof ActionRowBuilder),
						hasTextRows = rows.some(row => row instanceof TextDisplayBuilder);
					await interactionManager.respond({
						components: [
							...rows,
							createButtonRow([{ id: 'submit', label: 'Submit', style: 'primary' }])
						],
						...hasTextRows ? {
							flags: [MessageFlags.IsComponentsV2]
						} : {},
					}, isResetPayload);
					let
						isSelect,
						result: (string | undefined)[] = valuesPerRow.flat();
					do {
						await interactionManager.onInput();
						await interactionManager.defer();
						isSelect = interactionManager.getCurrentInteractionType() === 'selectMenu';
						if(isSelect){
							const
								customId = interactionManager.getCurrentCustomId(),
								index = selectRows.findIndex(selectRow => selectRow.components[0].data.custom_id === customId);
							valuesPerRow[index] = interactionManager.getCurrentValues();
							result = [...new Set(valuesPerRow.flat())];
						}
					}
					while(isSelect);
					return (isFlatten ? result : valuesPerRow) as isFlatten extends true ? string[] : (string | undefined)[][];
				},
				/** Send a separate message in response to the interaction. */
				followUp: (options: InteractionReplyOptions) => currentInteraction.followUp({
					...options,
					flags: [MessageFlags.Ephemeral]
				}),
				/** Delete the interaction response. */
				deleteReply: () => currentInteraction.deleteReply(),
				/** Get the ID of the last clicked button or of the last submitted select menu. */
				getCurrentCustomId: () => (currentInteraction as ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>).component.customId,
				/** Get the data of the last submitted select menu. */
				getCurrentValues: () => (currentInteraction as StringSelectMenuInteraction<'cached'> | UserSelectMenuInteraction<'cached'> | RoleSelectMenuInteraction<'cached'> | ChannelSelectMenuInteraction<'cached'>).values,
				/** Get the data of the last submitted modal. */
				getCurrentFields: () => (currentModalInteraction as ModalSubmitInteraction<'cached'>).fields.fields,
				/** Get the type of the last interaction submitted by the user. */
				getCurrentInteractionType: () => currentInteraction instanceof CommandInteraction ? 'command'
											   : currentInteraction instanceof ButtonInteraction  ? 'button'
																								  : 'selectMenu'
			};
		return interactionManager;
	},
	/**
	 * Defer a Discord interaction, automatically choosing the right method.
	 *
	 * @param interaction The interaction to operate on.
	 * @param [isForceReply] Whether to force a reply deferral.
	 * @returns The interaction response.
	 */
	defer = (
		interaction:
			CommandInteraction<'cached'> |
			ModalSubmitInteraction<'cached'> |
			ButtonInteraction<'cached'> |
			AnySelectMenuInteraction<'cached'>,
		isForceReply?: boolean
	): Promise<InteractionResponse> => {
		if(interaction instanceof CommandInteraction || isForceReply)
			return interaction.deferReply({
				flags: [MessageFlags.Ephemeral]
			});
		return interaction.deferUpdate();
	};

export type InteractionManager = ReturnType<typeof createInteractionManager>;

export const
	/**
	 * Create a function to handle an interaction in context despite being global.
	 * Use in `src/global-listeners`, name the file with the ID of the event to handle.
	 *
	 * @param listener - A callback function to handle interactions.
	 * It receives the following parameters:
	 * - `interaction` - The interaction.
	 * - `context` - An object containing key-value pairs of contextual information.
	 * @returns The listener function that was passed as an argument.
	 *
	 * @example
	 * // src/global-listeners/hello.ts
	 * export default defineGlobalListener(
	 *     async (
	 *         interaction,
	 *         context
	 *     ) => {
	 *         await respond(interaction, { content: `${context.name} says hello!` });
	 *     }
	 * );
	 */
	defineGlobalListener = (
		listener: (
			interaction: ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
			context: {
				[key: string]: string
			}
		) => void
	) => {
		return listener;
	},
	/**
	 * Save context persistently for a future global interaction.
	 *
	 * @param event The ID of the event to trigger.
	 * @param context - An object containing key-value pairs of contextual information.
	 * @returns The UUID of the newly created global emitter, to be used as `id` in items of `createButtonRow` or `createSelectRow`,
	 * which will be retrieved from persisted storage along with the context data when sent back by Discord.
	 *
	 * @example
	 * createButtonRow([{
	 *     id: await createGlobalEmitter({
	 *         event: 'hello',
	 *         context: {
	 *             name: interaction.user.tag
	 *         }
	 *     }),
	 *     label: 'Say Hello'
	 * }])
	 */
	createGlobalEmitter = async ({
		event,
		context
	}: {
		event: string,
		context: object
	}) => {
		const id = randomUUID();
		await (await getPostgresRepository(GlobalEmitter)).insert({
			id,
			event,
			context: JSON.stringify(context)
		});
		return id;
	};