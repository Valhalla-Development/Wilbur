import { dirname, importx } from '@discordx/importer';
import {
    ChannelType, codeBlock, EmbedBuilder, IntentsBitField,
} from 'discord.js';
import { Client } from 'discordx';
import 'dotenv/config';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';

interface CustomClient extends Client {
    cluster: ClusterClient<Client>;
}
/**
 * The Discord.js client instance.
 */
export const client = new Client({
    shards: getInfo().SHARD_LIST,
    shardCount: getInfo().TOTAL_SHARDS,
    intents: [
        IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent,
    ],
    silent: true,
}) as CustomClient;

/**
 * Handles unhandled rejections by logging the error and sending an embed to a designated logging channel, if enabled.
 * @param error - The error that was not handled.
 * @returns void
 */
process.on('unhandledRejection', (error: Error) => {
    if (!error?.stack) return;

    console.error(error.stack);

    if (process.env.Logging && process.env.Logging.toLowerCase() === 'true') {
        if (!process.env.LoggingChannel) return;

        const channel = client.channels.cache.get(process.env.LoggingChannel);
        if (!channel || channel.type !== ChannelType.GuildText) return;

        const typeOfError = error.stack.split(':')[0];
        const fullError = error.stack.replace(/^[^:]+:/, '').trimStart();
        const timeOfError = `<t:${Math.floor(new Date().getTime() / 1000)}>`;
        const fullString = `From: \`${typeOfError}\`\nTime: ${timeOfError}\n\nError:\n${codeBlock('js', fullError)}`;

        function truncateDescription(description: string) {
            const maxLength = 2048;
            if (description.length > maxLength) {
                const numTruncatedChars = description.length - maxLength;
                return `${description.slice(0, maxLength)}... ${numTruncatedChars} more`;
            }
            return description;
        }

        const embed = new EmbedBuilder().setTitle('Error').setDescription(truncateDescription(fullString));
        channel.send({ embeds: [embed] });
    }
});

/**
 * Runs the bot by loading the required components and logging in the client.
 * @async
 * @returns A Promise that resolves with void when the bot is started.
 * @throws An Error if any required environment variables are missing or invalid.
 */
async function run() {
    const missingTokenError = 'Hey mate, you gotta hand over the token to the client, otherwise, we can\'t proceed!';
    const invalidLoggingValueError = 'Either set the \'logging\' value to true or false, mate.';
    const invalidLoggingChannel = 'Oi, if you\'re setting logging to true, make sure to pass a logging channel along with it, mate!';
    const invalidValhallaApiUri = 'Blimey, you forgot to provide a valid API URI';
    const invalidValhallaApiKey = 'Blimey, you forgot to provide a valid API key for Valhalla API.';

    if (process.env.Logging !== 'true' && process.env.Logging !== 'false') throw new Error(invalidLoggingValueError);
    if (process.env.Logging === 'true' && !process.env.LoggingChannel) throw new Error(invalidLoggingChannel);
    if (!process.env.ValhallaAPIUri) throw new Error(invalidValhallaApiUri);
    if (!process.env.ValhallaAPIKey) throw new Error(invalidValhallaApiKey);
    if (!process.env.Token) throw Error(missingTokenError);

    /**
     * Delays the execution of the function for a specified time in milliseconds.
     * @param ms - The time in milliseconds to delay the execution of the function.
     * @returns A promise that resolves after the specified time has passed.
     */
    const sleep = (ms: number): Promise<void> => new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
    const time = 200;

    /**
     * Loads the Mongo events, imports the commands and events, and logs in the client.
     * @returns A Promise that resolves with void when everything is loaded sequentially.
     */
    const loadSequentially = async () => {
        await importx(`${dirname(import.meta.url)}/{events,commands,context}/**/*.{ts,js}`);
        await sleep(time);
        client.cluster = new ClusterClient(client);
        await sleep(time);
        await client.login(process.env.Token as string);
    };
    await loadSequentially();
}

await run();
