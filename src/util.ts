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
	MAX_ITEMS_PER_SELECT_MENU = 25,
	MAX_BUTTONS_PER_ROW = 5,
	MAX_EMBED_FIELD_VALUE_LENGTH = 1024,
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
	consoleLog = (...args: any[]) => console.log(...args.map(arg => inspect(arg, { depth: 0, colors: true }))),
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
	chunk = (array: any[], chunkSize: number) => [...Array(Math.ceil(array.length / chunkSize))]
		.map((_, index) => array.slice(index * chunkSize, index * chunkSize + chunkSize)),
	createInteractionManager = (initialInteraction: CommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>) => {
		let
			currentInteraction: CommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'> = initialInteraction,
			currentModalInteraction: ModalSubmitInteraction<'cached'>;
		const
			props = new Map(),
			isUndeferredModalInteraction = () => currentModalInteraction && !currentModalInteraction.deferred,
			isUnrepliedModalInteraction = () => currentModalInteraction && !currentModalInteraction.replied,
			interactionManager = {
				commandName: initialInteraction instanceof CommandInteraction ? initialInteraction.commandName : undefined,
				customId: initialInteraction instanceof ButtonInteraction ? initialInteraction.customId : undefined,
				channelId: initialInteraction.channelId,
				guildId: initialInteraction.guildId,
				guildOwnerId: initialInteraction.guild.ownerId,
				userId: initialInteraction.user.id,
				userTag: initialInteraction.user.tag,
				createdTimestamp: initialInteraction.createdTimestamp,
				member: initialInteraction.member,
				guild: initialInteraction.guild,
				client: initialInteraction.client,
				getOption: (key: string) => (initialInteraction as CommandInteraction<'cached'>).options.get(key),
				setProp: (key: string, value: any) => props.set(key, value),
				getProp: (key: string) => props.get(key),
				onInput: async (parentOverride?: Message | InteractionResponse) => {
					if(parentOverride)
						return void (currentInteraction = await onInput(parentOverride, currentInteraction as CommandInteraction<'cached'>));
					if(currentInteraction instanceof CommandInteraction)
						return void (currentInteraction = await onInput(await currentInteraction.fetchReply(), currentInteraction));
					return void (currentInteraction = await onInput(currentInteraction));
				},
				defer: (...args: Parameters<typeof defer> extends [any, ...infer R] ? R : never) => defer(isUndeferredModalInteraction() ? currentModalInteraction : currentInteraction, ...args),
				respond: (...args: Parameters<typeof respond> extends [any, ...infer R] ? R : never) => respond(isUnrepliedModalInteraction() ? currentModalInteraction : currentInteraction, ...args),
				useModal: async (
					modalData: Parameters<typeof createModal>[0],
					isRemoveButton: boolean = true
				) => void (currentModalInteraction = (await useModal(
					currentInteraction as MessageComponentInteraction<'cached'>,
					modalData,
					isRemoveButton
				)).interaction),
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
				followUp: (options: InteractionReplyOptions) => currentInteraction.followUp({
					...options,
					flags: [MessageFlags.Ephemeral]
				}),
				deleteReply: () => currentInteraction.deleteReply(),
				getCurrentCustomId: () => (currentInteraction as ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>).component.customId,
				getCurrentValues: () => (currentInteraction as StringSelectMenuInteraction<'cached'> | UserSelectMenuInteraction<'cached'> | RoleSelectMenuInteraction<'cached'> | ChannelSelectMenuInteraction<'cached'>).values,
				getCurrentFields: () => (currentModalInteraction as ModalSubmitInteraction<'cached'>).fields.fields,
				getCurrentInteractionType: () => currentInteraction instanceof CommandInteraction ? 'command'
											   : currentInteraction instanceof ButtonInteraction  ? 'button'
																								  : 'selectMenu'
			};
		return interactionManager;
	},
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