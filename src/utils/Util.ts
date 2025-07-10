import {
    ChannelType,
    type ColorResolvable,
    codeBlock,
    EmbedBuilder,
    type Message,
    PermissionsBitField,
    type TextChannel,
} from 'discord.js';
import type { Client } from 'discordx';
import '@colors/colors';
import axios from 'axios';
import Snoowrap from 'snoowrap';
import { config } from '../config/Config.js';

/**
 * Capitalises the first letter of each word in a string.
 * @param str - The string to be capitalised.
 * @returns The capitalised string.
 */
export const capitalise = (str: string): string => str.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Deletes a message after a specified delay if it's deletable.
 * @param message - The message to delete.
 * @param time - The delay before deletion, in milliseconds.
 */
export function deletableCheck(message: Message, time: number): void {
    setTimeout(() => {
        message.delete().catch((error) => console.error('Error deleting message:', error));
    }, time);
}

/**
 * Returns a modified color value based on the input.
 * If the input color value is black (#000000), it is replaced with a red shade (#A10000).
 * Otherwise, the input value is returned unchanged.
 * @param me - The color value to modify, should be of type string
 * @returns The modified color value as a `ColorResolvable`
 */
export function color(me: string): ColorResolvable {
    if (me === '#000000') {
        return '#A10000' as ColorResolvable;
    }
    return me as ColorResolvable;
}

/**
 * Scrambles the input word using the Fisher-Yates shuffle algorithm.
 * @param word - The input word to be scrambled.
 * @returns The scrambled word as a string.
 */
export function scrambleWord(word: string): string {
    const wordArray = word.split('');
    let currentIndex = wordArray.length;
    let temporaryValue: string;
    let randomIndex: number;

    // Fisher-Yates shuffle algorithm
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = wordArray[currentIndex]!;
        wordArray[currentIndex] = wordArray[randomIndex]!;
        wordArray[randomIndex] = temporaryValue;
    }

    return wordArray.join('');
}

/**
 * Fetches a random word based on the input difficulty level, scrambles it, and retrieves its pronunciation, part of speech,
 * definition, and an example sentence from the Wordnik API.
 *
 * @param difficulty - The difficulty level of the word to be fetched: 'easy', 'medium', or 'hard'.
 * @returns A Promise that resolves to an object containing the original word, scrambled word, pronunciation, part of speech,
 * and an array of fields containing the definition and example sentence.
 */
export async function fetchAndScrambleWord(): Promise<{
    originalWord: string;
    scrambledWord: string;
    pronunciation: string;
    partOfSpeech: string;
    definition: string[];
    fieldArray: { name: string; value: string }[];
}> {
    const url = `${config.VALHALLA_API_URI}/wordEnhanced`;

    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${config.VALHALLA_API_KEY}` },
        });

        const { data } = response;

        const { word } = data;
        const scrambledWord = scrambleWord(word);
        const { partOfSpeech } = data;
        const { definition } = data;
        const { pronunciation } = data;

        const fieldArray: { name: string; value: string }[] = [];
        fieldArray.push({ name: '**Definition:**', value: `>>> *${definition.join('\n')}*` });

        return {
            originalWord: word,
            scrambledWord,
            pronunciation,
            partOfSpeech,
            definition,
            fieldArray,
        };
    } catch (error) {
        console.error(
            "Oopsie daisy! Looks like there's been an error trying to fetch the word, mate:",
            error
        );
        throw error;
    }
}

/**
 * Fetches a random word from the Valhalla API.
 * @returns A Promise that resolves to a random word if successful or null if an error occurs.
 * @throws Throws an error if the request fails or if there is an unexpected response status.
 * @example
 * const randomWord = await getRandomWord();
 * console.log(randomWord);
 */
export async function getRandomWord(): Promise<string | null> {
    const url = `${config.VALHALLA_API_URI}/word`;

    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${config.VALHALLA_API_KEY}` },
        });

        if (response.status === 200) {
            const { word } = response.data;
            return word;
        }
        console.log(`Error: ${response.status}`);
        return null;
    } catch (error) {
        console.log(`Error: ${error}`);
        return null;
    }
}

/**
 * Deletes a message after a specified amount of time if the bot has the `Manage Messages` permission.
 * @param message The message to delete.
 * @param time The amount of time in milliseconds to wait before deleting the message.
 * @returns A Promise that resolves when the message is deleted, or rejects if the message could not be deleted.
 * @throws TypeError if the `message` parameter is not a valid Message object.
 */
export async function messageDelete(message: Message, time: number): Promise<void> {
    // todo test
    try {
        // Check if the bot has the Manage Messages permission
        const botMember = message.guild?.members.cache.get(message.client.user.id);
        if (botMember?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            // Create a Promise object that resolves after the specified amount of time
            const promise = new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, time);
            });

            // Wait for the Promise to resolve before continuing
            await promise;

            // Check if the message is deletable before attempting to delete it
            if (message.deletable) {
                await message.delete();
            }
        }
    } catch (error) {
        // Handle any errors that occur during message deletion
        console.error(
            `Uh-oh, there's been an error trying to delete the message, mate. Here's the message: ${error}`
        );
        throw error;
    }
}

/**
 * Fetches command IDs for both global and guild commands.
 * @param client - The Discord client instance
 * @returns Promise resolving to a record of command names to their IDs
 */
export async function getCommandIds(
    client: Client,
    guildId: string
): Promise<Record<string, string>> {
    if (!client.application) {
        throw new Error('Client application is not available');
    }

    const commandIds = new Map<string, string>();
    const isGuildOnly = client.botGuilds && client.botGuilds.length > 0;

    // Fetch global commands
    if (!isGuildOnly) {
        try {
            const globalCommands = await client.application.commands.fetch();
            for (const cmd of globalCommands.values()) {
                commandIds.set(cmd.name, cmd.id);
            }
        } catch (error) {
            console.warn('Could not fetch global commands:', error);
        }
    }

    // Fetch guild commands
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
        try {
            const guildCommands = await guild.commands.fetch();
            for (const cmd of guildCommands.values()) {
                commandIds.set(cmd.name, cmd.id);
            }
        } catch (error) {
            console.warn(`Could not fetch commands for guild ${guild.name}:`, error);
        }
    }

    return Object.fromEntries(commandIds);
}

export async function postToReddit(client: Client, cnt: string, author: string, imageUrl?: string) {
    // Remove custom Discord emojis from the content
    const processedContent = cnt.replace(/<a?:\w+:\d{17,19}>/g, '');

    /**
     * Checks if the required environment variables are defined.
     * Throws an error with a list of missing variables if any are not set.
     * @function checkRequiredEnvVars
     * @throws An error if any of the required environment variables are missing.
     */
    function checkRequiredEnvVars(): void {
        // Array of required environment variable names
        const requiredVars = [
            'DISCORD_SUPPORT',
            'DISCORD_CHANNEL_ID',
            'REDDIT_SUBREDDIT_NAME',
            'REDDIT_CLIENT_ID',
            'REDDIT_CLIENT_SECRET',
        ];

        // Add auth vars based on 2FA setting
        if (config.REDDIT_2FA) {
            requiredVars.push('REDDIT_REFRESH_TOKEN');
        } else {
            requiredVars.push('REDDIT_USERNAME', 'REDDIT_PASSWORD');
        }

        // Filtering out the missing environment variables
        const missingVars = requiredVars.filter(
            (varName) => !config[varName as keyof typeof config]
        );

        // If any required variables are missing, throw an error
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }
    }

    try {
        checkRequiredEnvVars();
    } catch (error) {
        console.error(error);
        return;
    }

    const reddit = config.REDDIT_2FA
        ? new Snoowrap({
              userAgent: client.user!.username,
              clientId: config.REDDIT_CLIENT_ID as string,
              clientSecret: config.REDDIT_CLIENT_SECRET as string,
              refreshToken: config.REDDIT_REFRESH_TOKEN as string,
          })
        : new Snoowrap({
              userAgent: client.user!.username,
              clientId: config.REDDIT_CLIENT_ID as string,
              clientSecret: config.REDDIT_CLIENT_SECRET as string,
              username: config.REDDIT_USERNAME as string,
              password: config.REDDIT_PASSWORD as string,
          });

    // If an image is provided, post it as a link post
    if (imageUrl) {
        await reddit
            .getSubreddit(config.REDDIT_SUBREDDIT_NAME as string)
            .submitLink({
                subredditName: config.REDDIT_SUBREDDIT_NAME as string,
                title: `📣 | ${processedContent.length > 50 ? `${processedContent.substring(0, 47)}...` : processedContent}`,
                url: imageUrl,
            })
            .then((post) => {
                if (config.REDDIT_FLAIR_TEMPLATE_ID) {
                    post.selectFlair({ flair_template_id: config.REDDIT_FLAIR_TEMPLATE_ID });
                }
                console.log(`Posted image "${imageUrl}" to Reddit.`);
            })
            .catch((e) => {
                console.error(
                    'Error posting image to Reddit:',
                    e.message,
                    e.response ? e.response.body : e
                );
            });
        return;
    }

    // Fallback to submitting a self (text) post if no imageUrl is provided
    await reddit
        .getSubreddit(config.REDDIT_SUBREDDIT_NAME as string)
        .submitSelfpost({
            subredditName: config.REDDIT_SUBREDDIT_NAME as string,
            title: `📣 | ${processedContent.length > 50 ? `${processedContent.substring(0, 47)}...` : processedContent}`,
            text: `${processedContent}\n\nPosted by ${author} in our Discord Community at ${config.DISCORD_SUPPORT}\n\nThis is an automated post.`,
        })
        .then((post) => {
            if (config.REDDIT_FLAIR_TEMPLATE_ID) {
                post.selectFlair({ flair_template_id: config.REDDIT_FLAIR_TEMPLATE_ID });
            }

            console.log(`Posted message "${processedContent}" to Reddit.`);
        })
        .catch((e) => {
            console.error('Error posting to Reddit:', e.message, e.response ? e.response.body : e);
        });
}

/**
 * Applies a reversed rainbow effect to the input string.
 * @param str - The string to apply the reversed rainbow effect.
 * @returns The input string with reversed rainbow coloring.
 */
export const reversedRainbow = (str: string): string => {
    const colors = ['red', 'magenta', 'blue', 'green', 'yellow', 'red'] as const;
    return str
        .split('')
        .map((char, i) => char[colors[i % colors.length] as keyof typeof char])
        .join('');
};

/**
 * Handles given error by logging it and optionally sending it to a Discord channel.
 * @param client - The Discord client instance
 * @param error - The unknown error
 */
export async function handleError(client: Client, error: unknown): Promise<void> {
    // Properly log the raw error for debugging
    console.error('Raw error:', error);

    // Create an error object if we received something else
    const normalizedError = error instanceof Error ? error : new Error(String(error));

    // Ensure we have a stack trace
    const errorStack = normalizedError.stack || normalizedError.message || String(error);

    if (!(config.ENABLE_LOGGING && config.LOGGING_CHANNEL)) {
        return;
    }

    /**
     * Truncates the description if it exceeds the maximum length.
     * @param description - The description to truncate
     * @returns The truncated description
     */
    function truncateDescription(description: string): string {
        const maxLength = 4096;
        if (description.length <= maxLength) {
            return description;
        }

        const numTruncatedChars = description.length - maxLength;
        return `${description.slice(0, maxLength)}... ${numTruncatedChars} more`;
    }

    try {
        const channel = client.channels.cache.get(config.LOGGING_CHANNEL) as
            | TextChannel
            | undefined;

        if (!channel || channel.type !== ChannelType.GuildText) {
            console.error(`Invalid logging channel: ${config.LOGGING_CHANNEL}`);
            return;
        }

        const typeOfError = normalizedError.name || 'Unknown Error';
        const timeOfError = `<t:${Math.floor(Date.now() / 1000)}>`;

        const fullString = [
            `From: \`${typeOfError}\``,
            `Time: ${timeOfError}`,
            '',
            'Error:',
            codeBlock('js', errorStack),
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription(truncateDescription(fullString))
            .setColor('#FF0000');

        await channel.send({ embeds: [embed] });
    } catch (sendError) {
        console.error('Failed to send the error embed:', sendError);
    }
}
