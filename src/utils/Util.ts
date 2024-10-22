import {
    ChannelType, codeBlock, ColorResolvable, EmbedBuilder, Message, TextChannel,
    PermissionsBitField,
} from 'discord.js';
import { Client } from 'discordx';
import '@colors/colors';
import axios from 'axios';
import Snoowrap from 'snoowrap';

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

        temporaryValue = wordArray[currentIndex];
        wordArray[currentIndex] = wordArray[randomIndex];
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
    const url = `${process.env.ValhallaAPIUri}/wordEnhanced`;

    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${process.env.ValhallaAPIKey}` },
        });

        const { data } = response;

        const { word } = data;
        const scrambledWord = scrambleWord(word);
        const { partOfSpeech } = data;
        const { definition } = data;
        const { pronunciation } = data;

        const fieldArray = [];
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
        console.error('Oopsie daisy! Looks like there\'s been an error trying to fetch the word, mate:', error);
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
    const url = `${process.env.ValhallaAPIUri}/word`;

    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${process.env.ValhallaAPIKey}` },
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
export async function messageDelete(message: Message, time: number): Promise<void> { // todo test
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
        console.error(`Uh-oh, there's been an error trying to delete the message, mate. Here's the message: ${error}`);
        throw error;
    }
}

/**
 * Fetches all registered global application command IDs.
 * @param client - The Discord client instance.
 * @returns A Promise that resolves to a record of command names to their corresponding IDs.
 * @throws Error if unable to fetch commands or if the client's application is not available.
 */
export async function getCommandIds(client: Client): Promise<Record<string, string>> {
    if (!client.application) {
        throw new Error('Client application is not available');
    }

    try {
        const commands = await client.application.commands.fetch();
        return Object.fromEntries(commands.map((c) => [c.name, c.id]));
    } catch (error) {
        console.error('Error fetching global commands:', error);
        throw error;
    }
}

export async function postToReddit(client: Client, cnt: string, author: string) {
    /**
     * Checks if the required environment variables are defined.
     * Throws an error with a list of missing variables if any are not set.
     * @function checkRequiredEnvVars
     * @throws An error if any of the required environment variables are missing.
     */
    function checkRequiredEnvVars(): void {
        // Array of required environment variable names
        const requiredVars = [
            'DiscordSupport',
            'DiscordChannelId',
            'RedditSubredditName',
            'RedditClientId',
            'RedditClientSecret',
            'RedditUsername',
            'RedditPassword',
        ];

        // Filtering out the missing environment variables
        const missingVars = requiredVars.filter((varName) => !process.env[varName]);

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

    const reddit = new Snoowrap({
        userAgent: client.user!.username,
        clientId: process.env.RedditClientId as string,
        clientSecret: process.env.RedditClientSecret as string,
        username: process.env.RedditUsername as string,
        password: process.env.RedditPassword as string,
    });

    await reddit.getSubreddit(process.env.RedditSubredditName as string)
        .submitSelfpost({
            subredditName: process.env.RedditSubredditName as string,
            title: `📣 | ${cnt.length > 50 ? `${cnt.substring(0, 47)}...` : cnt}`,
            text: `${cnt}\n\nPosted by ${author} in our Discord Community at ${process.env.DiscordSupport}\n\nThis is an automated post.`,
        })
        .then((post) => {
            if (process.env.RedditFlair) {
                post.assignFlair({ text: process.env.RedditFlair, cssClass: '' });
            }

            console.log(`Posted message "${cnt}" to Reddit.`);
        })
        .catch((e) => console.error(e));
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
    if (!(error instanceof Error) || !error.stack) {
        console.error('Invalid error object:', error);
        return;
    }

    console.error(error);

    if (process.env.ENABLE_LOGGING?.toLowerCase() !== 'true' || !process.env.LOGGING_CHANNEL) return;

    /**
     * Truncates the description if it exceeds the maximum length.
     * @param description - The description to truncate
     * @returns The truncated description
     */
    function truncateDescription(description: string): string {
        const maxLength = 4096;
        if (description.length <= maxLength) return description;

        const numTruncatedChars = description.length - maxLength;
        return `${description.slice(0, maxLength)}... ${numTruncatedChars} more`;
    }

    try {
        const channel = client.channels.cache.get(process.env.LOGGING_CHANNEL) as TextChannel | undefined;

        if (!channel || channel.type !== ChannelType.GuildText) {
            console.error(`Invalid logging channel: ${process.env.LOGGING_CHANNEL}`);
            return;
        }

        const typeOfError = error.name || 'Unknown Error';
        const fullError = error.stack;
        const timeOfError = `<t:${Math.floor(Date.now() / 1000)}>`;

        const fullString = [
            `From: \`${typeOfError}\``,
            `Time: ${timeOfError}`,
            '',
            'Error:',
            codeBlock('js', fullError),
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
