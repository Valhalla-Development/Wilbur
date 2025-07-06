import { Category, type ICategory } from '@discordx/utilities';
import axios from 'axios';
import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    ChannelType,
    type CommandInteraction,
    ContainerBuilder,
    MessageFlags,
    ModalBuilder,
    type ModalSubmitInteraction,
    type SelectMenuComponentOptionData,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    type StringSelectMenuInteraction,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import type { Client, DApplicationCommand } from 'discordx';
import {
    ButtonComponent,
    Discord,
    MetadataStorage,
    ModalComponent,
    SelectMenuComponent,
    Slash,
} from 'discordx';
import { config } from '../../config/Config.js';
import { capitalise, deletableCheck, getCommandIds } from '../../utils/Util.ts';

// Map categories to their emojis
const categoryEmojis: Record<string, string> = {
    miscellaneous: '🔧',
    depression: '💙',
};

/**
 * Get the emoji for a category, defaults to wrench
 */
function getCategoryEmoji(category: string): string {
    return categoryEmojis[category.toLowerCase()] || '🔧';
}

/**
 * Pull all unique categories from registered commands and format them
 */
function getCategoriesAsOptions(): SelectMenuComponentOptionData[] {
    const uniqueCategories = Array.from(
        new Set(
            MetadataStorage.instance.applicationCommands
                .filter((cmd: DApplicationCommand & ICategory) => cmd.category)
                .map((cmd: DApplicationCommand & ICategory) => cmd.category as string)
        )
    );

    return uniqueCategories.map((cat) => ({
        label: `${getCategoryEmoji(cat)} ${cat}`,
        value: `help-${cat.toLowerCase()}`,
    }));
}

/**
 * Build the formatted command list for a specific category
 */
async function buildCommandsList(category: string, client: Client): Promise<string> {
    // Filter commands by category, excluding the help command itself
    const filteredCommands = MetadataStorage.instance.applicationCommands.filter(
        (cmd: DApplicationCommand & ICategory) =>
            cmd.category?.toLowerCase() === category.toLowerCase() &&
            cmd.name?.toLowerCase() !== 'help'
    );

    const commandIds = await getCommandIds(client);
    return filteredCommands
        .map((cmd) => {
            const commandId = commandIds[cmd.name];
            // Use Discord's command mention format if we have the ID, otherwise just capitalize
            const commandMention = commandId ? `</${cmd.name}:${commandId}>` : capitalise(cmd.name);
            return `> 🔹 **${commandMention}**\n> \u200b \u200b \u200b *${cmd.description}*`;
        })
        .join('\n');
}

/**
 * The main container builder - handles all three display modes based on what options are passed
 */
async function buildHelpContainer(
    client: Client,
    options: {
        category?: string;
        selectMenu?: StringSelectMenuBuilder;
        showCategorySelector?: boolean;
    } = {}
): Promise<ContainerBuilder> {
    const { category, selectMenu, showCategorySelector } = options;

    // Every help view starts with this header
    const headerText = new TextDisplayBuilder().setContent(
        [
            `# 🚀 **${client.user?.username} Command Center**`,
            `> 👋 **Welcome to ${client.user?.username}'s command hub!**`,
        ].join('\n')
    );

    const container = new ContainerBuilder()
        .addTextDisplayComponents(headerText)
        .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Large));

    if (showCategorySelector) {
        // Initial view - show category picker
        const selectText = new TextDisplayBuilder().setContent(
            [
                '## 📂 **Command Categories**',
                '',
                '> **Choose a category below to explore available commands**',
                '> Each category contains specialized commands for different features',
            ].join('\n')
        );

        container
            .addTextDisplayComponents(selectText)
            .addActionRowComponents((row) => row.addComponents(selectMenu!));
    } else if (category) {
        // Category view - show commands for the selected category
        const commandsList = await buildCommandsList(category, client);
        const commandsText = new TextDisplayBuilder().setContent(
            [
                `## ${getCategoryEmoji(category)} **${capitalise(category)} Commands**`,
                '',
                commandsList,
                '',
            ].join('\n')
        );

        container.addTextDisplayComponents(commandsText);

        // Add the dropdown back so users can switch categories
        if (selectMenu) {
            container
                .addSeparatorComponents((separator) =>
                    separator.setSpacing(SeparatorSpacingSize.Small)
                )
                .addActionRowComponents((row) => row.addComponents(selectMenu));
        }
    }

    const inviteButton = new ButtonBuilder()
        .setLabel('Invite Me')
        .setEmoji('🤝')
        .setStyle(ButtonStyle.Link)
        .setURL(
            `https://discordapp.com/oauth2/authorize?client_id=${client.user?.id}&scope=bot%20applications.commands&permissions=535327927376`
        );

    const suggestButton = new ButtonBuilder()
        .setCustomId('trello_suggest')
        .setLabel('Suggest a Feature')
        .setEmoji('💡')
        .setStyle(ButtonStyle.Secondary);

    const issueButton = new ButtonBuilder()
        .setCustomId('trello_issue')
        .setLabel('Report an Issue')
        .setEmoji('🐛')
        .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        inviteButton,
        suggestButton,
        issueButton
    );

    container.addSeparatorComponents((separator) =>
        separator.setSpacing(SeparatorSpacingSize.Large)
    );
    container.addActionRowComponents(() => buttonRow);

    return container;
}

/**
 * Handle the initial /help command
 */
async function handleHelp(
    interaction: CommandInteraction,
    client: Client,
    selectMenu: StringSelectMenuBuilder
) {
    const cats = getCategoriesAsOptions();

    if (cats.length <= 1) {
        // Single category or no categories
        if (cats.length === 0) {
            return;
        }

        const selectedCategory = cats[0]!.value.replace(/^help-/, '').toLowerCase();
        const container = await buildHelpContainer(client, { category: selectedCategory });

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    } else {
        // Multiple categories
        const container = await buildHelpContainer(client, {
            selectMenu,
            showCategorySelector: true,
        });

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}

/**
 * Handle when someone picks a category from the dropdown
 */
async function handleSelectMenu(
    interaction: StringSelectMenuInteraction,
    client: Client,
    selectMenu: StringSelectMenuBuilder
) {
    // Only let the person who ran the command use the dropdown
    if (interaction.user.id !== interaction.message.interaction?.user.id) {
        const errorText = new TextDisplayBuilder().setContent(
            [
                '## ⛔ **Access Denied**',
                '',
                `> **${client.user?.username} - ${capitalise(interaction.message.interaction?.commandName ?? '')}**`,
                '> 🚫 **Error:** Only the command executor can interact with this menu!',
                '',
                '*Run the command yourself to access the help menu*',
            ].join('\n')
        );

        const errorContainer = new ContainerBuilder().addTextDisplayComponents(errorText);
        await interaction.reply({
            ephemeral: true,
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    const selectedValue = interaction.values?.[0];
    if (!selectedValue) {
        return deletableCheck(interaction.message, 0);
    }

    // Extract the category name from the dropdown value
    const selectedCategory = selectedValue.replace(/^help-/, '').toLowerCase();
    const container = await buildHelpContainer(client, {
        category: selectedCategory,
        selectMenu,
    });

    await interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

@Discord()
@Category('Miscellaneous')
export class Help {
    constructor() {
        // Bind methods
        this.help = this.help.bind(this);
        this.handle = this.handle.bind(this);
    }

    /**
     * Create the dropdown menu with current categories (MetadataStorage is empty during constructor)
     */
    private createSelectMenu(): StringSelectMenuBuilder {
        return new StringSelectMenuBuilder()
            .setCustomId('helpSelect')
            .setPlaceholder('🎯 Choose a command category...')
            .addOptions(...getCategoriesAsOptions());
    }

    /**
     * Slash command to display list of commands.
     * @param interaction - The command interaction.
     * @param client - The Discord client.
     */
    @Slash({ description: 'Display list of commands.' })
    async help(interaction: CommandInteraction, client: Client) {
        if (!interaction.channel) {
            return;
        }

        const selectMenu = this.createSelectMenu();
        await handleHelp(interaction, client, selectMenu);
    }

    /**
     * Handles category selection from the dropdown
     */
    @SelectMenuComponent({ id: 'helpSelect' })
    async handle(interaction: StringSelectMenuInteraction, client: Client): Promise<void> {
        const selectMenu = this.createSelectMenu();
        await handleSelectMenu(interaction, client, selectMenu);
    }

    @ButtonComponent({ id: /^trello_/ })
    async buttonClicked(interaction: ButtonInteraction) {
        const title =
            interaction.customId === 'trello_suggest'
                ? '💡 Suggest a Feature'
                : '🐛 Report an Issue';

        const modal = new ModalBuilder()
            .setTitle(title)
            .setCustomId(`trello_modal-${interaction.customId}`);

        const titleInput = new TextInputBuilder()
            .setCustomId('modalTitle')
            .setLabel('Title')
            .setPlaceholder(
                `Short description of your ${interaction.customId === 'trello_suggest' ? 'suggestion' : 'issue'}`
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(40);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('modalDescription')
            .setLabel('Description')
            .setPlaceholder(
                `Description of your ${interaction.customId === 'trello_suggest' ? 'suggestion' : 'issue'}`
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(200);

        const imageInput = new TextInputBuilder()
            .setCustomId('modalImage')
            .setLabel('Image')
            .setPlaceholder(
                `Links to images, showcasing your ${interaction.customId === 'trello_suggest' ? 'suggestion' : 'issue'}`
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMinLength(1)
            .setMaxLength(200);

        const inputRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
        const inputRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
        const inputRow3 = new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput);

        modal.addComponents(inputRow1, inputRow2, inputRow3);
        await interaction.showModal(modal);
    }

    @ModalComponent({ id: /^trello_modal-/ })
    async handleModalSubmit(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
        const [modalTitle, modalDescription, modalImage] = [
            'modalTitle',
            'modalDescription',
            'modalImage',
        ].map((id) => interaction.fields.getTextInputValue(id));

        const reportType =
            interaction.customId === 'trello_modal-trello_suggest' ? 'Suggestion' : 'Issue';

        const options = {
            Suggestion: {
                idList: config.TRELLO_SUGGESTION_LIST,
                idCardSource: config.TRELLO_SUGGESTION_TEMPLATE,
                desc: `**Suggested By: ${interaction.user.username}**\n**Feature: ${modalDescription}**${modalImage ? `\n\n**Screenshots: ${modalImage}**` : ''}`,
            },
            Issue: {
                idList: config.TRELLO_ISSUE_LIST,
                idCardSource: config.TRELLO_ISSUE_TEMPLATE,
                desc: `**Reporter: ${interaction.user.username}**\n**Description: ${modalDescription}**${modalImage ? `\n\n**Screenshots: ${modalImage}**` : ''}`,
            },
        };

        await axios
            .post('https://api.trello.com/1/cards', {
                key: config.TRELLO_API_KEY,
                token: config.TRELLO_TOKEN,
                idList: options[reportType as 'Suggestion' | 'Issue'].idList,
                idCardSource: options[reportType as 'Suggestion' | 'Issue'].idCardSource,
                keepFromSource:
                    'attachments,checklists,comments,customFields,due,start,labels,members,start,stickers',
                name: modalTitle,
                desc: options[reportType as 'Suggestion' | 'Issue'].desc,
            })
            .then((res) => {
                interaction.reply({
                    content: `Your \`${reportType}\` has been logged successfully on the [Trello board!](${res.data.url}), appreciate the feedback, mate! `,
                    ephemeral: true,
                });

                if (config.TRELLO_CHANNEL) {
                    const channel = client.channels.cache.get(config.TRELLO_CHANNEL);
                    if (channel && channel.type === ChannelType.GuildText) {
                        channel.send({
                            content: `New ${reportType}, from ${interaction.user.username}: ${res.data.url}`,
                        });
                    }
                }
            })
            .catch((error) => {
                interaction.reply({
                    content:
                        "Blimey! An unknown error occurred mate! I've reported the issue with my creators.",
                });
                console.error(error);
            });
    }
}
