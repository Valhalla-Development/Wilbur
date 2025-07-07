import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    CommandInteraction,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { Discord, Slash } from 'discordx';
import { oauthServer } from '../../utils/OAuthServer.js';

@Discord()
export class RedditAuthCommand {
    @Slash({
        description: 'Authenticate with Reddit for automated posting',
        defaultMemberPermissions: [PermissionFlagsBits.ManageChannels], // Restrict to moderators
    })
    async redditauth(interaction: CommandInteraction): Promise<void> {
        try {
            // Start the OAuth server if not already running
            await oauthServer.start();

            // Generate the authentication URL
            const authUrl = oauthServer.generateAuthUrl(interaction.user.id);

            // Create embed with instructions
            const embed = new EmbedBuilder()
                .setTitle('🔗 Reddit Authentication')
                .setDescription(
                    'Click the button below to authenticate with Reddit through Discord OAuth.\n\n' +
                    '**This will allow the bot to:**\n' +
                    '• Post messages to Reddit on your behalf\n' +
                    '• Access your Reddit identity\n' +
                    '• Submit posts to configured subreddits\n\n' +
                    '**Authentication Flow:**\n' +
                    '1. Authenticate with Discord\n' +
                    '2. Authenticate with Reddit\n' +
                    '3. Tokens will be stored for automated posting'
                )
                .setColor('#FF4500') // Reddit orange
                .setFooter({
                    text: 'This authentication is required for Reddit integration',
                });

            // Create the authentication button
            const authButton = new ButtonBuilder()
                .setLabel('🔐 Start Authentication')
                .setStyle(ButtonStyle.Link)
                .setURL(authUrl);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(authButton);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true, // Only visible to the user who ran the command
            });

        } catch (error) {
            console.error('Error in reddit auth command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Authentication Error')
                .setDescription('Failed to start the authentication process. Please try again later.')
                .setColor('#DC3545'); // Red

            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true,
            });
        }
    }
} 