const { Schema } = require("mongoose");
const LogChannelTypes = require("../enums/LogChannelTypes")

/**
 * Model: DiscordLogChannel
 * Datenbank: discordDB (Auswahl: discordDB / websiteDB)
 */

module.exports = (client) => {
    const db = client.discordDB;
    const modelName = "DiscordLogChannel";

    if (!db) {
        throw new Error(`Database connection for discordDB not found in client`);
    }

    const validLogTypes = Object.values(LogChannelTypes).map(type => type.id);

    const schema = new Schema({
        guildId: { type: String, required: true },
        name: { type: String, required: true },
        logType: { type: String, enum: validLogTypes, required: true },
        channelId: { type: String, required: true },
    }, {
        timestamps: true,
        versionKey: false
    });
    schema.index({ guildId: 1, logType: 1 }, { unique: true });

    return db.models[modelName] || db.model(modelName, schema);
};