const logger = require('../utils/logger');
const Guardian = require('../services/Guardian');
const TaskTypes = require('../enums/TaskTypes');
const ComponentV2Container = require('../utils/ComponentV2Container');

module.exports = {
    name: "TeamOverviewUpdate",
    type: TaskTypes.INTERVAL,
    expression: "10s",

    async execute(client) {
        try {
            const targets = await client.database.findMany("AdditionalSettings", {
                settingKey: "teamoverviewchannel"
            });

            if (!targets || targets.length === 0) return;

            for (const target of targets) {
                const guildId = target.guildId;
                const channelId = target.value;

                const discordClient = client.client || client;
                const activeGuild = discordClient.guilds.cache.get(guildId);

                if (!activeGuild) continue;

                const channel = await activeGuild.channels.fetch(channelId).catch(() => null);
                if (!channel) continue;

                await activeGuild.members.fetch().catch(err =>
                    logger.error(`[TeamOverview] Member fetch failed for guild ${guildId}: ${err.message}`)
                );

                const teamRoles = await discordClient.database.findMany("TeamRoles", { guildId });
                teamRoles.sort((a, b) => a.sortIndex - b.sortIndex);

                const teamRoleIds = teamRoles.map(r => r.roleId);

                let descriptionLines = [];

                for (const roleData of teamRoles) {
                    const role = activeGuild.roles.cache.get(roleData.roleId);
                    if (!role) continue;

                    descriptionLines.push(`👑 **${role.name}**`);

                    const uniqueMembers = role.members.filter(member => {
                        const memberTeamRoles = member.roles.cache.filter(r => teamRoleIds.includes(r.id));

                        const highestTeamRole = memberTeamRoles.reduce((highest, current) => {
                            return (!highest || current.position > highest.position) ? current : highest;
                        }, null);

                        return highestTeamRole && highestTeamRole.id === role.id;
                    });

                    if (uniqueMembers.size === 0) {
                        descriptionLines.push(`*Keine Mitglieder zugewiesen*`);
                    } else {
                        uniqueMembers.forEach(member => {
                            descriptionLines.push(`• ${member} (\`${member.id}\`)`);
                        });
                    }
                    descriptionLines.push("");
                }

                const description = descriptionLines.join("\n").trim() || "*No team roles configured yet.*";

                const container = ComponentV2Container("## 👥 Team Overview", description);

                const msgSetting = await discordClient.database.findOne("AdditionalSettings", {
                    guildId,
                    settingKey: "teamoverview_msg_id"
                });

                let existingMessage = null;
                if (msgSetting) {
                    existingMessage = await channel.messages.fetch(msgSetting.value).catch(() => null);
                }

                if (existingMessage) {
                    await existingMessage.edit({ content: "", components: [container], flags: 32768 });
                } else {
                    const newMsg = await channel.send({ content: "", components: [container], flags: 32768 });

                    const uniqueId = `${guildId}-teamoverview_msg_id`;
                    await discordClient.database.save("AdditionalSettings", uniqueId, {
                        guildId,
                        settingKey: "teamoverview_msg_id",
                        value: newMsg.id
                    });
                }
            }
        } catch (error) {
            logger.error(`[Task: TeamOverview] Critical Failure: ${error.message}`);
            await Guardian.handleGeneric("Team Overview Task Failed", error);
        }
    }
};