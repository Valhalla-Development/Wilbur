import {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    CommandInteraction,
    ButtonInteraction,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ModalSubmitInteraction,
} from 'discord.js';
import {
    Discord, Slash, ButtonComponent, ModalComponent,
} from 'discordx';
import { Category } from '@discordx/utilities';
import { v4 as uuidv4 } from 'uuid';
import {
    color, fetchAndScrambleWord, capitalise,
} from '../../utils/Util.js';

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
@Category('Fun')

export class Scramble {
    /**
     * Creates an EmbedBuilder object for displaying the scrambled word to users.
     * @param game - The current game being played.
     * @returns An EmbedBuilder object.
     */
    private createScrambleEmbed(game: Game): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle('Scramble Word')
            .setDescription(`The scrambled word is: **${game.scrambledWord.toLowerCase()}**`)
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
                .setStyle(ButtonStyle.Success),
        );
    }

    /**
     * Plays a game of word scrambling.
     * @param interaction - The CommandInteraction object that represents the user's interaction with the bot.
     */
    @Slash({ description: 'Play a scramble word game' })
    async scramble(interaction: CommandInteraction) {
        if (!interaction.channel) return;
        await interaction.deferReply({ ephemeral: true });

        const game = new Game();
        const gameId = uuidv4(); // Generate a unique id for the game
        activeGames[gameId] = game; // Store the game state in the activeGames object

        const difficulty = 'easy';
        try {
            const {
                originalWord, scrambledWord, pronunciation, partOfSpeech, fieldArray,
            } = await fetchAndScrambleWord(difficulty);
            game.originalWord = originalWord;
            game.scrambledWord = scrambledWord;
            game.pronunciation = pronunciation;
            game.partOfSpeech = partOfSpeech;
            game.fieldArray = fieldArray;

            const embed = this.createScrambleEmbed(game);
            const row = this.createAnswerButton(gameId);

            const initial = await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.deleteReply();

            setTimeout(async () => {
                if (game.gameIsActive) {
                    const timeOut = new EmbedBuilder()
                        .setColor(color(`${interaction.guild?.members.me?.displayHexColor}`))
                        .setAuthor({
                            name: 'Scramble Word',
                            url: `https://wordnik.com/words/${game.originalWord}`,
                            iconURL: `${interaction.guild?.iconURL({ extension: 'png' })}`,
                        })
                        .setDescription(`No one guessed the scrambled word **(${game.scrambledWord.toLowerCase()})**\n\n>>> **${capitalise(`${game.originalWord}`)}**${game.partOfSpeech ? `\n*${game.partOfSpeech}*` : ''}`);

                    if (game.fieldArray.length) timeOut.addFields(...game.fieldArray);

                    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('scramble_guess')
                            .setLabel('Answer')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true),
                    );

                    // Game has ended
                    await initial.edit({ embeds: [timeOut], components: [buttonRow] });
                }
            }, 10 * 60 * 1000); // 10 minutes
        } catch (error) {
            console.error(error);
            await interaction.channel.send('Error fetching word. Please try again later.');
        }
    }

    /**
     * Handles button click events from the "Answer" button.
     * @param interaction - The ButtonInteraction object that represents the user's interaction with the button.
     */
    @ButtonComponent({ id: /^scramble_guess-/ })
    async buttonClicked(interaction: ButtonInteraction) {
        const gameId = interaction.customId.match(/scramble_(?:guess|modal)-([a-f0-9-]+)/i)?.[1]; // Extract the gameId from the custom id

        const modal = new ModalBuilder().setTitle('Scramble Word').setCustomId(`scramble_modal-${gameId}`);
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
        if (!gameId) return;
        const game = activeGames[gameId]; // Get the game state using the gameId

        const [modalField] = ['modalField'].map((id) => interaction.fields.getTextInputValue(id));

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
                    .setDescription(`Congratulations, ${interaction.member} you guessed the scrambled word **(${game.scrambledWord.toLowerCase()})**\n\n>>> **${capitalise(`${game.originalWord}`)}**${game.partOfSpeech ? `\n*${game.partOfSpeech}*` : ''}`);

                if (game.fieldArray.length) successEmbed.addFields(...game.fieldArray);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('scramble_guess')
                        .setLabel('Answer')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                );

                if (!interaction.isFromMessage()) return;
                await interaction.update({ embeds: [successEmbed], components: [row] });
            } else {
                await interaction.reply({ content: `${interaction.member} incorrectly guessed **${modalField}**` });
            }
        } else {
            await interaction.reply({ content: 'This game has already ended. Better luck next time!', ephemeral: true });
        }
    }
}
