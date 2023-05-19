import type { Client, DApplicationCommand } from 'discordx';
import {
    Discord, Slash, MetadataStorage,
} from 'discordx';
import type { CommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { capitalise, getCommandIds } from '../utils/Util.js';

@Discord()
export class Commands {
    /**
     * Slash command to display list of commands.
     * @param interaction - The command interaction.
     * @param client - The Discord client.
     */
    @Slash({ description: 'Display list of commands.' })
    async commands(interaction: CommandInteraction, client: Client) {
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
            embed.addFields({ name: `<:fullDot:1109090626395443241> ${commandMention}`, value: `\u200b \u200b <:halfDot:1109090623421689908> ${cmd.description}` });
        });

        await interaction.reply({ embeds: [embed] });
    }
}
