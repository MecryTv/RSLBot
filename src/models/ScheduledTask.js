const { Schema } = require("mongoose");

/**
 * Model: ScheduledTask
 * Datenbank: discordDB (Auswahl: discordDB / websiteDB)
 */

module.exports = (client) => {
    const db = client.discordDB;
    const modelName = "ScheduledTask";

    if (!db) {
        throw new Error(`Database connection for discordDB not found in client`);
    }

    const schema = new Schema({
        name: { type: String, required: true, unique: true },
        type: { type: String, enum: ['CRON', 'INTERVAL', 'ONCE'], required: true },
        expression: { type: String, required: true },
        nextRun: { type: Date, required: true },
        lastRun: { type: Date },
        enabled: { type: Boolean, default: true }
    }, {
        timestamps: true,
        versionKey: false
    });
    return db.models[modelName] || db.model(modelName, schema);
};