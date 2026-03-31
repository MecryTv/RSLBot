const ComponentV2Container = require('../utils/ComponentV2Container');
const Guardian = require("../services/Guardian")
const DiscordLogChannel = require("../models/DiscordLogChannel");
const ChannelTypes = require("../enums/ChannelTypes");

class DiscordLogService {
    constructor(client) {
        this.client = client;
        this.model = DiscordLogChannel(client);
    }

    async isChannelValid(guildId, logType){
        const config = await this.model.findOne({ guildId, logType });

        if (!config) return false;

        const channelExists = await this.client.channels.cache.has(config.channelId);

        return channelExists;
    }

    async sendLogReport(channelID, titleContent, textContent, thumbnail, thumbnailURL, mediaImage, mediaImageURL) {
        try {
            const channel = await this.client.channels.fetch(channelID).catch(() => null);

            if (!channel || !channel.isThread()) {
                await Guardian.handleGeneric(`Channel ${channelID} not found or not a thread`, 'LogService');
                return false;
            }

            if (channel.parent?.type !== ChannelTypes.Forum) {
                await Guardian.handleGeneric(`Channel ${channelID} is not in a forum`, 'LogService');
                return false;
            }

            const container = ComponentV2Container(titleContent, textContent, { thumbnailURL, mediaImageURL });

            const files = [thumbnail, mediaImage].filter(f => f);

            await channel.send({
                components: [container],
                files: files
            });

            return true;
        } catch (error) {
            await Guardian.handleGeneric(`Failed to send log to ${channelID}`, 'LogService', error.stack);
            return false;
        }
    }
}