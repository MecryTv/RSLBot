const { z } = require('zod');

module.exports = {
    name: 'TeamRoles',
    table: 'team_roles',

    validate: z.object({
        guildId: z.string().min(15),
        roleName: z.string().max(100),
        roleId: z.string().min(15),
        sortIndex: z.number().int().nonnegative()
    })
};