import { Category } from '@discordx/utilities';
import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    ChannelType,
    type CommandInteraction,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    type ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { ButtonComponent, Discord, ModalComponent, Slash } from 'discordx';
import { v4 as uuidv4 } from 'uuid';
import { capitalise, color, fetchAndScrambleWord } from '../../utils/Util.ts';

class Game {
    gameIsActive: boolean;

    originalWord!: string;

    scrambledWord!: string;

    pronunciation!: string;

    partOfSpeech!: string;

    fieldArray!: { name: string; value: string }[];

    constructor() {
        this.gameIsActive = true;
    }
}

const activeGames: Record<string, Game> = {};

@Discord()
@Category('Miscellaneous')
export class Scramble {
    /**
     * Creates an EmbedBuilder object for displaying the scrambled word to users.
     * @param game - The current game being played.
     * @returns An EmbedBuilder object.
     */
    private createScrambleEmbed(game: Game): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle('Scramble Word')
            .setDescription(
                `The scrambled word is: ${game.scrambledWord.toLowerCase()}. Can you unscramble it?`
            )
            .setColor('#ffffff');
    }

    /**
     * Creates an ActionRowBuilder object containing a button for users to submit their guesses.
     * @param gameId - The unique id of the current game.
     * @returns An ActionRowBuilder object.
     */
    private createAnswerButton(gameId: string): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`scramble_guess-${gameId}`)
                .setLabel('Answer')
                .setStyle(ButtonStyle.Success)
        );
    }

    /**
     * Plays a game of word scrambling.
     * @param interaction - The CommandInteraction object that represents the user's interaction with the bot.
     */
    @Slash({ description: 'Unscramble a jumbled word in this fun and challenging game' })
    async scramble(interaction: CommandInteraction) {
        if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
            return;
        }
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const game = new Game();
        const gameId = uuidv4(); // Generate a unique id for the game
        activeGames[gameId] = game; // Store the game state in the activeGames object

        try {
            const { originalWord, scrambledWord, pronunciation, partOfSpeech, fieldArray } =
                await fetchAndScrambleWord();
            game.originalWord = originalWord;
            game.scrambledWord = scrambledWord;
            game.pronunciation = pronunciation;
            game.partOfSpeech = partOfSpeech;
            game.fieldArray = fieldArray;

            const embed = this.createScrambleEmbed(game);
            const row = this.createAnswerButton(gameId);

            const initial = await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.deleteReply();

            setTimeout(
                async () => {
                    if (game.gameIsActive) {
                        const timeOut = new EmbedBuilder()
                            .setColor(color(`${interaction.guild?.members.me?.displayHexColor}`))
                            .setAuthor({
                                name: 'Scramble Word',
                                url: `https://wordnik.com/words/${game.originalWord}`,
                                iconURL: `${interaction.guild?.iconURL({ extension: 'png' })}`,
                            })
                            .setDescription(
                                `Blimey, no one managed to guess the scrambled word **(${game.scrambledWord.toLowerCase()})**. Here's the answer: \n\n>>> ${capitalise(`**${game.originalWord}`)}**${`\n*${game.partOfSpeech}*`}${`\n*[ ${game.pronunciation} ]*`}`
                            );

                        if (game.fieldArray.length) {
                            timeOut.addFields(...game.fieldArray);
                        }

                        const oldEmbed = new EmbedBuilder()
                            .setColor(color(`${interaction.guild?.members.me?.displayHexColor}`))
                            .setAuthor({
                                name: 'Scramble Word',
                                url: `https://wordnik.com/words/${game.originalWord}`,
                                iconURL: `${interaction.guild?.iconURL({ extension: 'png' })}`,
                            });

                        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId('scramble_guess')
                                .setLabel('Answer')
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(true)
                        );

                        // Game has ended
                        if (
                            !interaction.channel ||
                            interaction.channel.type !== ChannelType.GuildText
                        ) {
                            return;
                        }

                        const newMessage = await interaction.channel?.send({
                            embeds: [timeOut],
                            components: [buttonRow],
                        });

                        oldEmbed.setDescription(
                            `This game has ended. See: https://discord.com/channels/${interaction.guild?.id}/${interaction.channel?.id}/${newMessage?.id}`
                        );
                        await initial.edit({ embeds: [oldEmbed], components: [buttonRow] });
                    }
                },
                10 * 60 * 1000
            ); // 10 minutes
        } catch (error) {
            console.error(error);
            await interaction.channel.send(
                "Sorry mate, we're having trouble fetching the word right now. Could you please try again later?"
            );
        }
    }

    /**
     * Handles button click events from the "Answer" button.
     * @param interaction - The ButtonInteraction object that represents the user's interaction with the button.
     */
    @ButtonComponent({ id: /^scramble_guess-/ })
    async buttonClicked(interaction: ButtonInteraction) {
        const gameId = interaction.customId.match(/scramble_(?:guess|modal)-([a-f0-9-]+)/i)?.[1]; // Extract the gameId from the custom id

        const modal = new ModalBuilder()
            .setTitle('Scramble Word')
            .setCustomId(`scramble_modal-${gameId}`);
        const input = new TextInputBuilder()
            .setCustomId('modalField')
            .setLabel('Input')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(1)
            .setMaxLength(20);

        const inputRow = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
        modal.addComponents(inputRow);
        await interaction.showModal(modal);
    }

    /**
     * Handles modal submit events for the "Answer" button.
     * @param interaction - The ModalSubmitInteraction object that represents the user's interaction with the modal.
     */
    @ModalComponent({ id: /^scramble_modal-/ })
    async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        const gameId = interaction.customId.match(/scramble_(?:guess|modal)-([a-f0-9-]+)/i)?.[1]; // Extract the gameId from the custom id
        if (!gameId) {
            return;
        }
        const game = activeGames[gameId]; // Get the game state using the gameId

        if (!game) {
            await interaction.reply({ content: 'This game no longer exists.', flags: [MessageFlags.Ephemeral] });
            return;
        }

        const [modalField] = ['modalField'].map((id) => interaction.fields.getTextInputValue(id));

        if (!modalField) {
            await interaction.reply({ content: 'No answer provided.', flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (game.gameIsActive) {
            if (modalField.toLowerCase() === game.originalWord.toLowerCase()) {
                game.gameIsActive = false;

                const successEmbed = new EmbedBuilder()
                    .setColor(color(`${interaction.guild?.members.me?.displayHexColor}`))
                    .setAuthor({
                        name: 'Scramble Word',
                        url: `https://wordnik.com/words/${game.originalWord}`,
                        iconURL: `${interaction.guild?.iconURL({ extension: 'png' })}`,
                    })
                    .setDescription(
                        `Well done, ${interaction.member} you managed to guess the scrambled word **(${game.scrambledWord.toLowerCase()})**\n\n>>> ${capitalise(`**${game.originalWord}`)}**${`\n*${game.partOfSpeech}*`}${`\n*[ ${game.pronunciation} ]*`}`
                    );

                if (game.fieldArray.length) {
                    successEmbed.addFields(...game.fieldArray);
                }

                const oldEmbed = new EmbedBuilder()
                    .setColor(color(`${interaction.guild?.members.me?.displayHexColor}`))
                    .setAuthor({
                        name: 'Scramble Word',
                        url: `https://wordnik.com/words/${game.originalWord}`,
                        iconURL: `${interaction.guild?.iconURL({ extension: 'png' })}`,
                    });

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('scramble_guess')
                        .setLabel('Answer')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                );

                if (!interaction.isFromMessage()) {
                    return;
                }
                if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
                    return;
                }

                const newMessage = await interaction.channel?.send({
                    embeds: [successEmbed],
                    components: [row],
                });

                oldEmbed.setDescription(
                    `This game has ended. See: https://discord.com/channels/${interaction.guild?.id}/${interaction.channel?.id}/${newMessage?.id}`
                );
                await interaction.update({ embeds: [oldEmbed], components: [row] });
            } else {
                await interaction.reply({
                    content: `${interaction.member} incorrectly guessed **${modalField}**`,
                });
            }
        } else {
            await interaction.reply({
                content: 'This game has already ended. Better luck next time!',
                flags: [MessageFlags.Ephemeral],
            });
        }
    }
}
