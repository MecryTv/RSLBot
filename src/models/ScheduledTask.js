const { z } = require('zod');
const TaskTypes = require('../enums/TaskTypes');

module.exports = {
    name: 'ScheduledTask',
    table: 'scheduled_tasks',

    validate: z.object({
        name: z.string(),
        type: z.enum(Object.values(TaskTypes)),
        expression: z.string().nullable().optional(),
        time: z.string().nullable().optional(),
        date: z.string().nullable().optional(),
        nextRun: z.date().nullable(),
        lastRun: z.date().nullable().optional(),
        enabled: z.boolean().default(true),
        isRunning: z.boolean().default(false),
        lastError: z.string().nullable().optional()
    })
};