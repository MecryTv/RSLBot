const { z } = require('zod');
const LogChannelTypes = require('../enums/LogChannelTypes');

const validLogTypes = Object.values(LogChannelTypes).map(type => type.id);

module.exports = {
    name: 'DiscordLogChannel',
    table: 'discord_log_channels',

    validate: z.object({
        guildId: z.string().min(15),
        name: z.string().max(100),
        logType: z.enum(validLogTypes),
        channelId: z.string().min(15)
    })
};