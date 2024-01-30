import type { ArgsOf, Client } from 'discordx';
import { Discord, On } from 'discordx';
import { postToReddit } from '../utils/Util.js';

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
        if (message.author.bot) return;

        if (process.env.RedditPost === 'true' && (process.env.DiscordChannelId && process.env.DiscordChannelId === message.channel.id)) {
            await postToReddit(client, message.content, message.author.displayName);
        }
    }
}
