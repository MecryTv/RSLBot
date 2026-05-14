const { z } = require('zod');

module.exports = {
    name: 'ScheduledTask',
    table: 'scheduled_tasks',
    validate: z.object({
        name: z.string(),
        type: z.string(),
        daily: z.boolean(),
        time: z.string(),
        date: z.string().nullable().optional(),
        nextRun: z.date().nullable(),
        lastRun: z.date().nullable(),
        enabled: z.boolean().default(true),
        isRunning: z.boolean().default(false),
        lastError: z.string().nullable().optional()
    })
};