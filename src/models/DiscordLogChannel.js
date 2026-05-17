const { z } = require('zod');

module.exports = {
    name: 'DiscordLogChannel',
    table: 'discord_log_channels',

    validate: z.object({
        guildId: z.string().min(15),
        name: z.string().max(100),
        logType: z.string().max(100),
        channelId: z.string().min(15)
    })
};