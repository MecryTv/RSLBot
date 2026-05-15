const Event = require("../../structures/Events");
const ComponentV2Container = require("../../utils/ComponentV2Container");
const logger = require("../../utils/logger");
const DateTimeService = require("../../services/DateTimeService");

class VoiceLeave extends Event {
    constructor(client) {
        super(client, "voiceStateUpdate", false);
    }

    async execute(oldState, newState) {
        if (oldState.channelId && !newState.channelId) {
            const logChannel = await this.client.database.findOne("DiscordLogChannel", {
                guildId: oldState.guildId,
                logType: 'connectionlogs'
            });

            if (logChannel) {
                const targetChannel = await this.client.channels.fetch(logChannel.channelId).catch(() => null);

                if (targetChannel) {
                    const member = await oldState.member.fetch();
                    const user = member.user;
                    const avatarURL = user.displayAvatarURL({ forceStatic: false, size: 512 });
                    const { date, time } = DateTimeService.getNow();

                    const title = `🔇 Voice Session Disconnected`;

                    const description =
                        `👤 **User:** ${user} (${user.tag})\n` +
                        `🆔 **Account ID:** \`${user.id}\`\n` +
                        `📍 **Left Channel:** ${oldState.channel}\n` +
                        `🔌 **Session End:** \`${oldState.channelId}\`\n` +
                        `📅 **Date:** ${date}\n` +
                        `🕒 **Time:** ${time} (CET)`;

                    const container = ComponentV2Container(title, description, {
                        thumbnailURL: avatarURL
                    });

                    await targetChannel.send({
                        components: [container],
                        flags: 32768
                    }).catch(err => logger.error(`[VoiceLeave] Error: ${err.message}`));
                }
            }
        }
    }
}

module.exports = VoiceLeave;