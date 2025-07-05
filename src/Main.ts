import { dirname, importx } from '@discordx/importer';
import { IntentsBitField } from 'discord.js';
import { Client } from 'discordx';
import 'dotenv/config';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import { config, isDev } from './config/Config.js';
import { handleError } from './utils/Util.ts';

/**
 * Extends the Discord.js Client to include cluster functionality
 * This allows each shard to communicate with the cluster manager
 */
interface WilburClient extends Client {
    cluster: ClusterClient<Client>;
}

/**
 * The Discord.js client instance with conditional sharding support.
 *
 * Development Mode:
 * - Single process, no sharding
 * - Direct client without cluster functionality
 *
 * Production Mode:
 * - Sharding Configuration:
 * - shards: Uses getInfo().SHARD_LIST to get the list of shards this instance should handle
 * - shardCount: Uses getInfo().TOTAL_SHARDS to know the total number of shards
 * - Each instance of the bot (cluster) will handle a subset of the total shards
 */
const clientConfig = {
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
    silent: true,
    botGuilds: config.GUILDS,
    ...(isDev
        ? {}
        : {
              shards: getInfo().SHARD_LIST,
              shardCount: getInfo().TOTAL_SHARDS,
          }),
};

export const client = new Client(clientConfig) as WilburClient;

/**
 * Handles unhandled rejections by logging the error and sending an embed to a designated logging channel, if enabled.
 * @param error - The error that was not handled.
 * @returns void
 */
process.on('unhandledRejection', async (error) => {
    await handleError(client, error);
});

/**
 * Handles uncaught exception by logging the error and sending an embed to a designated logging channel, if enabled.
 * @param error - The error that was not handled.
 * @returns void
 */
process.on('uncaughtException', async (error) => {
    await handleError(client, error);
});

/**
 * Event handler for client errors
 * @param error - The error that occurred
 * @returns Promise that resolves when error is handled
 */
client.on('error', async (error: unknown) => {
    console.error('Client error:', error);
    await handleError(client, error);
});

/**
 * Runs the bot by loading the required components and logging in the client.
 * @async
 * @returns A Promise that resolves with void when the bot is started.
 * @throws An Error if any required environment variables are missing or invalid.
 */
async function run() {
    const missingVar = (v: string) => `Oi mate, the ${v} environment variable is missing!`;
    const invalidBool = (v: string) => `Either set the '${v}' value to true or false, mate.`;
    const invalidValhallaConfig =
        'Blimey, you need both VALHALLA_API_URI and VALHALLA_API_KEY for the Valhalla integration to work!';

    // Required variables that must be present
    const required = ['BOT_TOKEN', 'VALHALLA_API_URI', 'VALHALLA_API_KEY'];

    // Variables that must be boolean (true/false)
    const booleans = ['ENABLE_LOGGING', 'REDDIT_POST'];

    // Check all required variables
    for (const v of required) {
        if (!process.env[v]) {
            throw new Error(missingVar(v));
        }
    }

    // Validate boolean values
    for (const v of booleans) {
        if (process.env[v] !== 'true' && process.env[v] !== 'false') {
            throw new Error(invalidBool(v));
        }
    }

    // Special validation for Valhalla API (since both URI and key are needed together)
    if (
        (process.env.VALHALLA_API_URI && !process.env.VALHALLA_API_KEY) ||
        (!process.env.VALHALLA_API_URI && process.env.VALHALLA_API_KEY)
    ) {
        throw new Error(invalidValhallaConfig);
    }

    // Reddit configuration validation (if Reddit posting is enabled)
    if (process.env.REDDIT_POST === 'true') {
        const requiredRedditVars = [
            'DISCORD_CHANNEL_ID',
            'REDDIT_SUBREDDIT_NAME',
            'REDDIT_CLIENT_ID',
            'REDDIT_CLIENT_SECRET',
            'REDDIT_USERNAME',
            'REDDIT_PASSWORD',
        ];

        for (const v of requiredRedditVars) {
            if (!process.env[v]) {
                throw new Error(`Oi mate, when REDDIT_POST is true, ${v} is required!`);
            }
        }
    }

    /**
     * Delays the execution of the function for a specified time in milliseconds.
     * @param ms - The time in milliseconds to delay the execution of the function.
     * @returns A promise that resolves after the specified time has passed.
     */
    const sleep = (ms: number): Promise<void> =>
        new Promise<void>((resolve) => {
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
        if (!isDev) {
            client.cluster = new ClusterClient(client);
            await sleep(time);
        }
        await client.login(config.BOT_TOKEN);
    };
    await loadSequentially();
}

await run();
