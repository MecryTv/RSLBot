const { Schema } = require("redis-om");

const ScheduledTask = new Schema("ScheduledTask", {
    name: { type: 'string' },
    type: { type: 'string' },
    expression: { type: 'string' },
    nextRun: { type: 'date' },
    lastRun: { type: 'date' },
    enabled: { type: 'boolean' }
}, {
    dataStructure: 'JSON'
});

module.exports = ScheduledTask;