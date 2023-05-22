import { Discord, Slash } from 'discordx';
import type { CommandInteraction } from 'discord.js';
import {
    AttachmentBuilder, ChannelType, Message, ThreadChannel, PermissionsBitField,
} from 'discord.js';
import axios from 'axios';
import {
    deletableCheck, getRandomWord, messageDelete,
} from '../utils/Util.js';

const cooldown = new Map();
const cooldownSeconds = 1;

@Discord()
export class Hangman {
    @Slash({ description: 'Test your word-guessing skills in a thrilling game of Hangman' })
    async hangman(interaction: CommandInteraction) {
        if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) return;

        if (!interaction.guild?.members.me?.permissions.has(PermissionsBitField.Flags.CreatePublicThreads)) {
            await interaction.reply('Ahoy there, mate! It seems like I don\'t have the Create Public Threads permission. This permission is required for me to execute this command.');
            return;
        }

        const word = await getRandomWord();

        if (!word) {
            await interaction.reply('Oopsie daisy, mate! An unknown error occurred. Could you please try again later?');
            return;
        }

        await interaction.deferReply();
        await interaction.deleteReply();

        const gameState = {
            word: word.toLowerCase(),
            guessed: '',
            hangmanState: 0,
            showWord: false,
        };

        async function updateGameImage(channel: ThreadChannel, messageToUpdate?: Message) {
            let response;
            try {
                response = await axios.get('https://api.ragnarokbot.com/v1/hangman', {
                    params: {
                        api_key: `${process.env.WilburApi}`,
                        word: gameState.word,
                        guessed: gameState.guessed,
                        hangmanState: gameState.hangmanState,
                        showWord: gameState.showWord,
                    },
                    responseType: 'arraybuffer',
                    headers: { Authorization: `Bearer ${process.env.WilburApi}` },
                });

                const attachment = new AttachmentBuilder(response.data, { name: 'Hangman.jpg' });

                if (messageToUpdate) {
                    return messageToUpdate.edit({ files: [attachment] });
                }
                return channel.send({ files: [attachment] });
            } catch {
                await channel.send('Oopsie daisy, mate! An unknown error occurred. Could you please try again later?');
                return undefined;
            }
        }

        // Create thread
        const thread = await interaction.channel.threads.create({
            name: `Hangman - @${interaction.user.username}`,
            autoArchiveDuration: 60,
            reason: `Woo-hoo! A game of Hangman has begun with ${interaction.user.username}. Let's get started, mate!`,
        });

        const gameMessage = await updateGameImage(thread);

        const letterPattern = /^[a-zA-Z]$/;
        const filter = (m: Message) => !m.author.bot;
        const collector = thread.createMessageCollector({ filter, time: 30_000 });
        collector.on('collect', async (m) => {
            if (m.author.id !== interaction.user.id) {
                await messageDelete(m, 0);
                return;
            }

            if (!gameMessage) {
                // The API call failed; inform the user and stop the game
                await m.reply({ content: 'Oopsie daisy, mate! An unknown error occurred. Could you please try again later?' }).then((ms) => deletableCheck(ms, 2500));
                collector.stop();
                return;
            }

            collector.resetTimer();

            const remainingCooldown = cooldown.get(interaction.user.id) - Date.now();
            if (remainingCooldown > 0) {
                const remainingSeconds = Math.ceil(remainingCooldown / 1000);
                m.reply({ content: `Whoa there, mate! Slow down a bit! You need to wait another ${remainingSeconds} seconds before trying again.` }).then((ms) => deletableCheck(ms, 2500));
                await messageDelete(m, 2500);
                return;
            }

            cooldown.delete(interaction.user.id);

            if (!cooldown.has(interaction.user.id)) {
                const cooldownEnd = Date.now() + cooldownSeconds * 1000;
                cooldown.set(interaction.user.id, cooldownEnd);
            }

            if (m.content.length > 1) {
                if (m.content.length === gameState.word.length) {
                    if (m.content.toLowerCase() === gameState.word.toLowerCase()) {
                        // Word is fully guessed
                        gameState.guessed = gameState.word;
                        gameState.showWord = true;
                        await updateGameImage(thread, gameMessage);
                        thread.send({ content: `Fantastic work, ${interaction.member}! You've correctly guessed the word! 🎉. You're a natural at this, mate!` });
                        collector.stop();
                        return;
                    }
                    // entered full word, wrong answer
                    await m.reply({ content: 'Sorry, mate! You guessed the wrong word!' }).then((ms) => deletableCheck(ms, 2500));
                    await messageDelete(m, 2500);
                } else {
                    await m.reply({ content: 'Oi, mate! Please only enter **1** character at a time. Can\'t have you giving away all the answers now, can we?' }).then((ms) => deletableCheck(ms, 2500));
                    await messageDelete(m, 2500);
                    return;
                }
            }

            // If letter has already been guessed
            if (gameState && letterPattern.test(m.content)) {
                const letter = m.content.toLowerCase();
                if (!gameState.guessed.includes(letter)) {
                    if (!gameState.word.includes(letter)) {
                        gameState.hangmanState += 1;

                        if (gameState.hangmanState >= 10) {
                            // Game has ended
                            gameState.showWord = true;
                            thread.send({ content: `Uh-oh, ${interaction.member}! Looks like you've run out of attempts ☹️. Better luck next time, mate!` });
                            await messageDelete(m, 0);
                            collector.stop();
                        }
                    }

                    gameState.guessed += letter;
                    await updateGameImage(thread, gameMessage);
                    await messageDelete(m, 0);

                    // Check if the word has been fully guessed
                    const remainingLetters = gameState.word.split('').filter((char) => !gameState.guessed.includes(char));
                    if (remainingLetters.length === 0) {
                        // Word is fully guessed
                        gameState.showWord = true;
                        await updateGameImage(thread, gameMessage);
                        thread.send({ content: `Fantastic work, ${interaction.member}! You've correctly guessed the word! 🎉. You're a natural at this, mate!` });
                        collector.stop();
                    }
                } else {
                    await m.reply({ content: `Oopsie daisy, ${interaction.member}! It looks like you've already guessed that letter. Please try another one!` }).then((ms) => deletableCheck(ms, 2500));
                    await messageDelete(m, 2500);
                }
            }
        });

        collector.on('end', async (_, reason) => {
            if (!gameMessage) {
                // The API call failed; don't send the end message
                await thread.setLocked(true);
                return;
            }
            if (reason === 'time') {
                gameState.hangmanState = 10;
                gameState.showWord = true;
                await updateGameImage(thread, gameMessage);
                thread.send({ content: `Time's up, ${interaction.member}! Unfortunately, you couldn't guess the word in time. Better luck next time, mate!` });
            }
            await thread.setLocked(true);
        });
    }
}
