const { EmbedBuilder } = require("discord.js");
const logger = require("../utils/logger");
const path = require("path");

class Guardian {
    constructor() {
        this.client = null;
        this.ERROR_LOG_CHANNEL_ID = '1163164124683964507';
        this.DEVELOPER_PING_ROLE_ID = '1286386691925344390';
    }

    /**
     * @returns {string} The error ID in the format RSL-TIMESTAMP-RANDOM.
     */
    generateErrorId() {
        const timestamp = Math.floor(Date.now() / 1000);
        const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `RSL-${timestamp}-${randomPart}`;
    }

    /**
     * @param {import('discord.js').Client} client - The Discord client instance.
     */
    initialize(client) {
        this.client = client;
        this._initializeGlobalHandlers();
        logger.guardian('info', "✅  Guardian is operational");
    }

    /**
     * @private
     */
    _initializeGlobalHandlers() {
        process.on('unhandledRejection', (reason, promise) => {
            logger.guardian('error', 'Unhandled Rejection erfasst:', reason);
            const error = new Error(reason || "Unbekannter Promise Rejection Grund");
            this.report(error, null, 'Unhandled Rejection');
        });

        process.on('uncaughtException', (err, origin) => {
            logger.guardian('error', `Uncaught Exception erfasst: ${err}`, `Origin: ${origin}`);
            this.report(err, null, 'Uncaught Exception');
        });
    }

    /**
     * @param {import('discord.js').Interaction} interaction - The interaction to which a response is required
     * @param {string} errorId - The generated error ID
     * @private
     */
    async _sendUserReply(interaction, errorId) {
        if (!interaction || !interaction.channel || !interaction.isCommand()) return;

        const replyContent = {
            content: `> Oops! 🛠️ An unexpected error has occurred.\n> **Error ID:** \`${errorId}\`\n> \n> Please report this ID to a team member so we can resolve the issue quickly`,
            ephemeral: true,
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyContent);
            } else {
                await interaction.reply(replyContent);
            }
        } catch (e) {
            logger.guardian("error", "Unable to send user error message:", e);
        }
    }

    /**
     * @param {Error} error - The error object
     * @returns {{fileName: string, filePath: string, line: string} | null} - An object containing the location details, or null.
     * @private
     */
    _parseStackForLocation(error) {
        if (!error.stack) return null;

        const stackLines = error.stack.split('\n').slice(1);
        const relevantLine = stackLines.find(line => !line.includes('Guardian.js'));

        if (!relevantLine) return null;

        const locationMatch = relevantLine.match(/\((.*?)\)/);

        if (!locationMatch || !locationMatch[1]) return null;

        const fullPath = locationMatch[1];
        const parts = fullPath.split(':');
        const line = parts[parts.length - 2] || 'N/A';
        const filePath = parts.slice(0, parts.length - 2).join(':') || 'N/A';
        const fileName = path.basename(filePath) || 'N/A';

        return { fileName, filePath, line };
    }

    /**
     * @param {Error} error - The error object
     * @param {string} errorId - The generated error ID
     * @param {object} context - Additional information about the context of the error
     * @private
     */
    async _sendLogReport(error, errorId, context) {
        if (!this.client) {
            return logger.guardian('error', "Guardian was not initialized. Unable to send error report");
        }

        const { interaction, type } = context;

        const errorLogChannelId = this.ERROR_LOG_CHANNEL_ID;

        if (!errorLogChannelId) {
            return logger.guardian('warn', `The hardcoded ‘ERROR_LOG_CHANNEL_ID’ is missing or has not been replaced. Skip the Discord log`);
        }

        const logChannel = await this.client.channels.fetch(errorLogChannelId).catch(() => null);
        if (!logChannel) {
            return logger.guardian('error', `Error log channel with ID ${errorLogChannelId} not found`);
        }

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`🛡️ Guardian | ${type}`)
            .setTimestamp()
            .setFooter({ text: `Error-ID: ${errorId}` });

        let contentToSend = null;

        if (interaction) {
            const developerPingRoleId = this.DEVELOPER_PING_ROLE_ID;
            if (developerPingRoleId) {
                const developerRole = await interaction.guild.roles.fetch(developerPingRoleId).catch(() => null);
                if (developerRole) {
                    contentToSend = `${developerRole}`;
                } else {
                    logger.guardian('warn', `The Developer Ping role with ID ${developerPingRoleId} was not found on the server`);
                }
            } else {
                logger.guardian('warn', `The hard-coded ‘DEVELOPER_PING_ROLE_ID’ is missing or has not been replaced`);
            }

            embed.addFields(
                { name: "Triggered by", value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                { name: "Server", value: `\`${interaction.guild.name}\``, inline: true },
                { name: "Command", value: interaction.isCommand() ? `\`/${interaction.commandName}\`` : "`N/A`", inline: true },
            );
        } else {
            embed.addFields({ name: "Context", value: "`Global Process`", inline: true });
        }


        const location = this._parseStackForLocation(error);
        if (location) {
            embed.addFields(
                { name: "📍 Location", value: `\`\`\`ini\n[File]: ${location.fileName}\n[Row]: ${location.line}\`\`\`` },
                { name: "Path", value: `\`${location.filePath}\``}
            );
        }

        const stackTrace = error.stack || error.toString();
        embed.addFields(
            { name: "Error Message", value: `\`\`\`${error.message}\`\`\`` },
            { name: "Stack Trace", value: `\`\`\`js\n${stackTrace.substring(0, 1000)}\`\`\`` }
        );

        await logChannel.send({ content: contentToSend, embeds: [embed] });
    }

    /**
     * @param {string} errorMessage - A clear error message that developers can understand
     * @param {import('discord.js').Interaction} interaction - The interaction during which the error occurred
     * @param {string} type - An optional, specific type of error
     */
    async handleCommand(errorMessage, interaction, type = 'Command Logic Error') {
        const error = new Error(errorMessage);
        await this.report(error, interaction, type);
    }

    /**
     * @param {string} errorMessage - A clear error message that developers can understand
     * @param {{guild?: import('discord.js').Guild, eventName?: string}} context - Optional context objects from the event (e.g., the server)
     */
    async handleEvent(errorMessage, context = {}) {
        const error = new Error(errorMessage);
        const type = context.eventName ? `Event Logic Error: ${context.eventName}` : 'Event Logic Error';
        await this.report(error, null, type);
    }

    /**
     * @param {string} errorMessage - A clear error message that developers can understand
     * @param {string} type - A custom type for the error (e.g., “Service Initialization”)
     * @param {string} [stack] - **Optional:** The `error.stack` of the original error
     */
    async handleGeneric(errorMessage, type = 'Generic System Error', stack = null) {
        const error = new Error(errorMessage);
        if (stack) {
            error.stack = stack;
        }
        await this.report(error, null, type);
    }

    /**
     * The primary method for correcting an error
     * @param {Error} error - The error object that occurred
     * @param {import('discord.js').Interaction | null} interaction - The interaction during which the error occurred
     * @param {string} type - The type of error (e.g., “Command Execution”)
     */
    async report(error, interaction, type = "Unknown Error") {
        const errorId = this.generateErrorId();
        const context = {
            interaction,
            type,
        };

        logger.guardian('error', `Error detected [ID: ${errorId}] | Type: ${type}:`, error);

        const location = this._parseStackForLocation(error);

        if (location) {
            logger.guardian('error', `📍 Error location: ${location.fileName} (line: ${location.line}) | Path: ${location.filePath}`);
        }

        await this._sendLogReport(error, errorId, context);

        if (interaction) {
            await this._sendUserReply(interaction, errorId);
        }
    }
}

module.exports = new Guardian();