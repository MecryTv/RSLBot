const { z } = require('zod');

module.exports = {
    name: 'AdditionalSettings',
    table: 'additional_settings',

    validate: z.object({
        guildId: z.string().min(15),
        settingKey: z.string().max(50),
        value: z.string().min(15),
        name: z.string().nullable().optional()
    })
};