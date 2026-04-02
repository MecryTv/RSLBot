const { Schema } = require("redis-om");

const DiscordLogChannel = new Schema("DiscordLogChannel", {
    guildId: { type: 'string' },
    name: { type: 'string' },
    logType: { type: 'string' },
    channelId: { type: 'string' }
}, {
    dataStructure: 'JSON'
});

module.exports = DiscordLogChannel;