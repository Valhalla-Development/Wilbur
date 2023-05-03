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
import {
    color, fetchAndScrambleWord, capitalise,
} from '../../utils/Util.js';

@Discord()
@Category('Informative')
/**
 * A class that provides the logic and interactions for the Scramble word game in Discord.
 */
export class Scramble {
    gameIsActive: boolean;

    constructor() {
        this.gameIsActive = true;
    }

    private originalWord!: string;

    private scrambledWord!: string;

    private pronunciation!: string;

    private partOfSpeech!: string;

    private fieldArray!: { name: string; value: string }[];

    /**
     * Creates a new EmbedBuilder instance containing the scramble word game information.
     * @returns The EmbedBuilder instance with the scramble word game information.
     */
    private createScrambleEmbed(): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle('Scramble Word')
            .setDescription(`The scrambled word is: **${this.scrambledWord.toLowerCase()}**`)
            .setColor('#ffffff');
    }

    /**
     * Creates a new ActionRowBuilder instance containing the answer button component.
     * @returns The ActionRowBuilder instance with the answer button component.
     */
    private createAnswerButton(): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('scramble_guess')
                .setLabel('Answer')
                .setStyle(ButtonStyle.Success),
        );
    }

    @Slash({ description: 'Play a scramble word game' })
    /**
     * The slash command that initializes the scramble word game in Discord.
     * @param interaction - The CommandInteraction instance representing the interaction.
     */
    async scramble(interaction: CommandInteraction) {
        if (!interaction.channel) return;
        await interaction.deferReply({ ephemeral: true });

        const difficulty = 'easy';
        try {
            const {
                originalWord, scrambledWord, pronunciation, partOfSpeech, fieldArray,
            } = await fetchAndScrambleWord(difficulty);
            this.originalWord = originalWord;
            this.scrambledWord = scrambledWord;
            this.pronunciation = pronunciation;
            this.partOfSpeech = partOfSpeech;
            this.fieldArray = fieldArray;

            const embed = this.createScrambleEmbed();
            const row = this.createAnswerButton();

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.deleteReply();
        } catch (error) {
            console.error(error);
            await interaction.channel.send('Error fetching word. Please try again later.');
        }
    }

    @ButtonComponent({ id: 'scramble_guess' })
    /**
     * Handles the button interaction for the scramble word game.
     * @param interaction - The ButtonInteraction instance representing the interaction.
     */
    async buttonClicked(interaction: ButtonInteraction) {
        const modal = new ModalBuilder().setTitle('Scramble Word').setCustomId('scramble_modal');
        const input = new TextInputBuilder()
            .setCustomId('modalField')
            .setLabel('Input')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(this.originalWord.length);

        const inputRow = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
        modal.addComponents(inputRow);
        await interaction.showModal(modal);
    }

    @ModalComponent({ id: 'scramble_modal' })
    /**
     * Handles the modal submit interaction for the scramble word game.
     * @param interaction - The ModalSubmitInteraction instance representing the interaction.
     * @returns A Promise that resolves when the interaction is handled.
     */
    async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        const [modalField] = ['modalField'].map((id) => interaction.fields.getTextInputValue(id));

        if (this.gameIsActive) {
            if (modalField.toLowerCase() === this.originalWord.toLowerCase()) {
                this.gameIsActive = false;

                const successEmbed = new EmbedBuilder()
                    .setColor(color(`${interaction.guild?.members.me?.displayHexColor}`))
                    .setAuthor({
                        name: 'Scramble Word',
                        url: `https://wordnik.com/words/${this.originalWord}`,
                        iconURL: `${interaction.guild?.iconURL({ extension: 'png' })}`,
                    })
                    .setDescription(`Congratulations, ${interaction.member} you guessed the scrambled word **(${this.scrambledWord})**\n\n>>> **${capitalise(`${this.originalWord}`)}${this.partOfSpeech ? `**\n*${this.partOfSpeech}*` : ''}`);

                if (this.fieldArray.length) successEmbed.addFields(...this.fieldArray);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('scramble_guess')
                        .setLabel('Answer')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                );

                await (interaction as unknown as ButtonInteraction).update({ embeds: [successEmbed], components: [row] });
            } else {
                await (interaction as unknown as ButtonInteraction).reply({ content: `${interaction.member} incorrectly guessed **${modalField}**` });
            }
        } else {
            await interaction.reply({ content: 'This game has already ended. Better luck next time!', ephemeral: true });
        }
    }
}
