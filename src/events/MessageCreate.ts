import type { ArgsOf, Client } from 'discordx';
import { Discord, On } from 'discordx';
import { postToReddit } from '../utils/Util.ts';

@Discord()
export class MessageCreate {
    /**
     * Handler for messageCreate event.
     * @param args - An array containing the message and client objects.
     * @param client - The Discord client.
     */
    @On({ event: 'messageCreate' })
    async onMessage([message]: ArgsOf<'messageCreate'>, client: Client) {
        // Return if the author is a bot, preventing the bot from replying to itself or other bots.
        if (message.author.bot) {
            return;
        }

        // Check if the message is in the specified channel and if Reddit posting is enabled
        if (
            process.env.REDDIT_POST === 'true' &&
            process.env.DISCORD_CHANNEL_ID &&
            process.env.DISCORD_CHANNEL_ID === message.channel.id
        ) {
            let imageUrl: string | undefined;

            // Check for attachments and get the URL of the first image attachment
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment?.url) {
                    imageUrl = attachment.url; // Get the URL of the image
                }
            }

            // Call postToReddit with the content and imageUrl if available
            await postToReddit(client, message.content, message.author.displayName, imageUrl);
        }
    }
}
