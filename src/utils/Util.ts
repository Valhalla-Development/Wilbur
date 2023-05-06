import type { ColorResolvable, Message } from 'discord.js';
import { Client } from 'discordx';
import { PermissionsBitField } from 'discord.js';
import 'colors';
import axios from 'axios';

/**
 * Capitalises the first letter of each word in a string.
 * @param string - The string to be capitalised.
 * @returns The capitalised string.
 */
export function capitalise(string: string) {
    return string.replace(/\S+/g, (word) => word.slice(0, 1).toUpperCase() + word.slice(1));
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
 * Removes HTML tags from a given string.
 * @param text - The input string containing HTML tags to be removed.
 * @returns The processed string with HTML tags removed.
 */
function removeHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
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
 * Fetches the definition and part of speech of a given word from the Wordnik API.
 * @param word - The input word for which the definition and part of speech are to be fetched.
 * @param apiKey - The API key required for accessing the Wordnik API.
 * @returns A Promise that resolves to an object containing the definition and part of speech of the word
 */
async function fetchDefinition(word: string, apiKey: string): Promise<{ definition: string; partOfSpeech: string }> {
    const definitionUrl = `https://api.wordnik.com/v4/word.json/${word}/definitions?sourceDictionaries=wiktionary&limit=1&includeRelated=false&useCanonical=false&includeTags=false&api_key=${apiKey}`;

    try {
        const definitionResponse = await axios.get(definitionUrl);

        const definition = definitionResponse.data[0]?.text || '';
        const partOfSpeech = definitionResponse.data[0]?.partOfSpeech || '';

        return { definition, partOfSpeech };
    } catch (error) {
        return { definition: '', partOfSpeech: '' };
    }
}

/**
 * Fetches an example sentence of a given word from the Wordnik API.
 * @param word - The input word for which an example sentence is to be fetched.
 * @param apiKey - The API key required for accessing the Wordnik API.
 * @returns A Promise that resolves to a string containing the example sentence or an empty string if no example is found.
 */
async function fetchExample(word: string, apiKey: string): Promise<string> {
    const exampleUrl = `https://api.wordnik.com/v4/word.json/${word}/examples?limit=1&useCanonical=false&includeTags=false&api_key=${apiKey}`;

    try {
        const exampleResponse = await axios.get(exampleUrl);
        return exampleResponse.data.examples[0]?.text || '';
    } catch (error) {
        return '';
    }
}

/**
 * Fetches a random word based on the input difficulty level, scrambles it, and retrieves its pronunciation, part of speech,
 * definition, and an example sentence from the Wordnik API.
 *
 * @param difficulty - The difficulty level of the word to be fetched: 'easy', 'medium', or 'hard'.
 * @returns A Promise that resolves to an object containing the original word, scrambled word, pronunciation, part of speech,
 * and an array of fields containing the definition and example sentence.
 */
export async function fetchAndScrambleWord(difficulty: 'easy' | 'medium' | 'hard'): Promise<{
    originalWord: string;
    scrambledWord: string;
    pronunciation: string;
    partOfSpeech: string;
    fieldArray: { name: string; value: string }[];
}> {
    const difficultyLevels = {
        easy: { minCorpusCount: 50001, maxCorpusCount: 300000 },
        medium: { minCorpusCount: 10001, maxCorpusCount: 50000 },
        hard: { minCorpusCount: 1, maxCorpusCount: 10000 },
    };

    const { minCorpusCount, maxCorpusCount } = difficultyLevels[difficulty] || difficultyLevels.easy;
    const apiKey = `${process.env.WordNikApi}`;
    const apiUrl = `https://api.wordnik.com/v4/words.json/randomWord?minCorpusCount=${minCorpusCount}&maxCorpusCount=${maxCorpusCount}&hasDictionaryDef=true&includeRelated=true&api_key=${apiKey}`;

    try {
        const response = await axios.get(apiUrl);
        const { word } = response.data;
        const scrambledWord = scrambleWord(word);

        // Fetch pronunciation
        const pronunciationUrl = `https://api.wordnik.com/v4/word.json/${word}/pronunciations?useCanonical=false&limit=1&api_key=${apiKey}`;
        let pronunciation = '';
        try {
            const pronunciationResponse = await axios.get(pronunciationUrl);
            pronunciation = pronunciationResponse.data[0]?.raw || '';
        } catch (error) {
            console.error('Blimey! There\'s been an error trying to fetch the pronunciation, mate:', error);
        }

        const { definition, partOfSpeech } = await fetchDefinition(word, apiKey);
        const example = await fetchExample(word, apiKey);

        const fieldArray = [];
        if (definition) fieldArray.push({ name: '**Definition:**', value: `>>> *${removeHtmlTags(definition)}*` });
        if (example) fieldArray.push({ name: '**Example:**', value: `>>> ${example}` });

        return {
            originalWord: word,
            scrambledWord,
            pronunciation,
            partOfSpeech,
            fieldArray,
        };
    } catch (error) {
        console.error('Oopsie daisy! Looks like there\'s been an error trying to fetch the word, mate:', error);
        throw error;
    }
}

export async function getRandomWord(): Promise<string | null> {
    const url = 'https://api.ragnarokbot.com/v1/word';

    try {
        const response = await axios.get(url);

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
 * Checks if a message is deletable, and deletes it after a specified amount of time.
 * @param message - The message to check.
 * @param time - The amount of time to wait before deleting the message, in milliseconds.
 * @returns void
 */
export function deletableCheck(message: Message, time: number): void {
    setTimeout(() => {
        if (message && message.deletable) {
            message.delete().catch(console.error);
        }
    }, time);
}

/**
 * Fetches the registered global application commands and returns an object
 * containing the command names as keys and their corresponding IDs as values.
 * @param client - The Discord Client instance.
 * @returns An object containing command names and their corresponding IDs.
 * If there are no commands or an error occurs, an empty object is returned.
 */
export async function getCommandIds(client: Client) {
    try {
        // Fetch the registered global application commands
        const commands = await client.application?.commands.fetch();

        if (!commands) {
            return {};
        }

        // Create an object to store the command IDs
        const commandIds: { [name: string]: string } = {};

        commands.forEach((command) => {
            commandIds[command.name] = command.id;
        });

        return commandIds;
    } catch (error) {
        console.error('Error fetching global commands:', error);
        return {};
    }
}
