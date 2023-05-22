import type { Client, DApplicationCommand } from 'discordx';
import {
    Discord, Slash, MetadataStorage, ButtonComponent, ModalComponent,
} from 'discordx';
import type { CommandInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle, ChannelType,
    EmbedBuilder,
    ModalBuilder, ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import axios from 'axios';
import { capitalise, getCommandIds } from '../utils/Util.js';

@Discord()
export class Help {
    /**
     * Slash command to display list of commands.
     * @param interaction - The command interaction.
     * @param client - The Discord client.
     */
    @Slash({ description: 'Display list of commands.' })
    async help(interaction: CommandInteraction, client: Client) {
        if (!interaction.channel) return;

        // Create an array of command names
        const filteredCommands = MetadataStorage.instance.applicationCommands.filter(
            (cmd: DApplicationCommand) => cmd.name.toLowerCase() !== 'commands',
        );

        const embed = new EmbedBuilder()
            .setColor('#e91e63')
            .setDescription(`> G'day, mateys! I'm ${client.user?.username} and I'm a shark! Don't worry, though, I'm not here to bite - I'm just a friendly Discord bot ready for fun!`)
            .setAuthor({ name: `${client.user?.username} Help`, iconURL: `${interaction.guild?.iconURL()}` })
            .setThumbnail(`${client.user?.displayAvatarURL()}`)
            .setFooter({
                text: `Bot Version ${process.env.npm_package_version}`,
                iconURL: `${client.user?.avatarURL()}`,
            });

        const commandIds = await getCommandIds(client);

        filteredCommands.forEach((cmd) => {
            const commandId = commandIds[cmd.name];
            const commandMention = commandId ? `</${cmd.name}:${commandId}>` : capitalise(cmd.name);
            embed.addFields({
                name: `<:fullDot:1109090626395443241> ${commandMention}`,
                value: `\u200b \u200b <:halfDot:1109090623421689908> ${cmd.description}`,
            });
        });

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

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(suggestButton, issueButton);

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    @ButtonComponent({ id: /^trello_/ })
    async buttonClicked(interaction: ButtonInteraction) {
        const title = interaction.customId === 'trello_suggest' ? '💡 Suggest a Feature' : '🐛 Report an Issue';

        const modal = new ModalBuilder().setTitle(title).setCustomId(`trello_modal-${interaction.customId}`);

        const titleInput = new TextInputBuilder()
            .setCustomId('modalTitle')
            .setLabel('Title')
            .setPlaceholder(`Short description of your ${interaction.customId === 'trello_suggest' ? 'suggestion' : 'issue'}`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(40);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('modalDescription')
            .setLabel('Description')
            .setPlaceholder(`Description of your ${interaction.customId === 'trello_suggest' ? 'suggestion' : 'issue'}`)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(200);

        const imageInput = new TextInputBuilder()
            .setCustomId('modalImage')
            .setLabel('Image')
            .setPlaceholder(`Links to images, showcasing your ${interaction.customId === 'trello_suggest' ? 'suggestion' : 'issue'}`)
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
        const [modalTitle, modalDescription, modalImage] = ['modalTitle', 'modalDescription', 'modalImage'].map((id) => interaction.fields.getTextInputValue(id));

        const reportType = interaction.customId === 'trello_modal-trello_suggest' ? 'Suggestion' : 'Issue';

        const options = {
            Suggestion: {
                idList: process.env.TrelloSuggestionList,
                idCardSource: process.env.TrelloSuggestionTemplate,
                desc: `**Suggested By: ${interaction.user.username}**\n**Feature: ${modalDescription}**${modalImage ? `\n\n**Screenshots: ${modalImage}**` : ''}`,
            },
            Issue: {
                idList: process.env.TrelloIssueList,
                idCardSource: process.env.TrelloIssueTemplate,
                desc: `**Reporter: ${interaction.user.username}**\n**Description: ${modalDescription}**${modalImage ? `\n\n**Screenshots: ${modalImage}**` : ''}`,
            },
        };

        await axios.post('https://api.trello.com/1/cards', {
            key: process.env.TrelloApiKey,
            token: process.env.TrelloToken,
            idList: options[reportType as 'Suggestion' | 'Issue'].idList,
            idCardSource: options[reportType as 'Suggestion' | 'Issue'].idCardSource,
            keepFromSource: 'attachments,checklists,comments,customFields,due,start,labels,members,start,stickers',
            name: modalTitle,
            desc: options[reportType as 'Suggestion' | 'Issue'].desc,
        }).then((res) => {
            interaction.reply({ content: `Your \`${reportType}\` has been logged successfully on the [Trello board!](${res.data.url}), appreciate the feedback, mate! `, ephemeral: true });

            if (process.env.TrelloChannel) {
                const channel = client.channels.cache.get(process.env.TrelloChannel);
                if (channel && channel.type === ChannelType.GuildText) channel.send({ content: `New ${reportType}, from ${interaction.user.username}: ${res.data.url}` });
            }
        }).catch((error) => {
            interaction.reply({ content: 'Blimey! An unknown error occurred mate! I\'ve reported the issue with my creators.' });
            console.error(error);
        });
    }
}
