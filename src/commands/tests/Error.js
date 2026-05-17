const Command = require("../../structures/Command");
const { SlashCommandBuilder } = require("discord.js");
const Guardian = require("../../services/Guardian");

class ErrorTest extends Command {
    constructor() {
        super({
            name: "error",
            description: "Trigger bewusst das Guardian Error Reporting für Testzwecke",
        });

        this.data = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async execute(interaction) {
        await interaction.deferReply({ flags: 32768 });

        try {
            throw new Error("Dies ist ein manuell ausgelöster Test-Fehler über den /error Command.");
        } catch (error) {

            await Guardian.handleGeneric(
                error.message,
                "Deliberate Command Trigger",
                error.stack
            );

            await interaction.editReply({
                content: "⚠️ **Guardian wurde getriggert!** Ein Test-Fehlerbericht wurde an den Log-Kanal gesendet."
            });
        }
    }
}

module.exports = ErrorTest;