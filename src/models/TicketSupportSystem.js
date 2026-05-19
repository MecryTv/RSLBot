const { z } = require('zod');

module.exports = {
    name: 'TicketSupportSystem',
    table: 'ticket_support_system',

    validate: z.object({
        guildId: z.string(),
        forumChannelId: z.string(),
        transcriptChannelId: z.string().nullable(),
        panelChannelId: z.string().nullable(),
        supportWaitroomId: z.string().nullable(),
        supportRoleIds: z.array(z.string()).nullable(),
        supportTime: z.string().nullable(),
        maxOpenTickets: z.number().nullable(),
        panelMessage: z.string().nullable(),
        createOptions: z.json().nullable(),
    })
};