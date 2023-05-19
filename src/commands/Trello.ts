import {
    Discord, Slash, SlashChoice, SlashOption,
} from 'discordx';
import { ApplicationCommandOptionType } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import axios from 'axios';
import process from 'process';

@Discord()
export class Trello {
    /**
     * Slash command to POST to Trello.
     * @param interaction - The command interaction.
     * @param reportType - Type of POST request
     * @param title - The title for the card
     * @param description - A description of the issue/suggestion
     * @param attachment - Optional image of issue/suggestion
     */
    @Slash({ description: 'Report bug / Make suggestion' })
    async trello(
        @SlashOption({
            description: 'Type of report',
            name: 'type',
            required: true,
            type: ApplicationCommandOptionType.String,
        })
        @SlashChoice('Suggestion')
        @SlashChoice('Issue')
            reportType: string,

        @SlashOption({
            description: 'Title',
            name: 'title',
            minLength: 4,
            maxLength: 40,
            required: true,
            type: ApplicationCommandOptionType.String,
        })
            title: string,

        @SlashOption({
            description: 'Description',
            name: 'description',
            minLength: 4,
            maxLength: 200,
            required: true,
            type: ApplicationCommandOptionType.String,
        })
            description: string,

        @SlashOption({
            description: 'Image',
            name: 'image',
            minLength: 4,
            maxLength: 200,
            required: false,
            type: ApplicationCommandOptionType.String,
        })
            attachment: string,

            interaction: CommandInteraction,
    ) {
        const options = {
            Suggestion: {
                idList: process.env.TrelloSuggestionList,
                idCardSource: process.env.TrelloSuggestionTemplate,
                desc: `**Suggested By: ${interaction.user.username}**\n**Feature: ${description}**\n\n**Additional Notes: N/A**${attachment ? `\n\n**Screenshots: ${attachment}**` : ''}`,
            },
            Issue: {
                idList: process.env.TrelloIssueList,
                idCardSource: process.env.TrelloIssueTemplate,
                desc: `**Reporter: ${interaction.user.username}**\n**Description: ${description}**${attachment ? `\n\n**Screenshots: ${attachment}**` : ''}`,
            },
        };

        await axios.post('https://api.trello.com/1/cards', {
            key: process.env.TrelloApiKey,
            token: process.env.TrelloToken,
            idList: options[reportType as 'Suggestion' | 'Issue'].idList,
            idCardSource: options[reportType as 'Suggestion' | 'Issue'].idCardSource,
            keepFromSource: 'attachments,checklists,comments,customFields,due,start,labels,members,start,stickers',
            name: title,
            desc: options[reportType as 'Suggestion' | 'Issue'].desc,
        }).then(() => {
            interaction.reply({ content: `Your \`${reportType}\` has been logged successfully on the [Trello board!](https://trello.com/b/TpKTayKW/wilbur), appreciate the feedback, mate! `, ephemeral: true });
        }).catch((error) => {
            interaction.reply({ content: 'Blimey! An unknown error occurred mate! I\'ve reported the issue with my creators.' });
            console.error(error);
        });
    }
}
