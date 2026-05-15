const Event = require("../../structures/Events");
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
} = require("discord.js");
const MessageService = require("../../services/MessageService");
const ConfigService = require("../../services/ConfigService");
const Guardian = require("../../services/Guardian");
const ComponentV2Container = require("../../utils/ComponentV2Container");
const ChannelTypes = require("../../enums/ChannelTypes");

class SetupSettings extends Event {
  constructor(client) {
    super(client, "interactionCreate", false);
  }

  async execute(interaction) {
    const commandCustomId = MessageService.get("setupsettings.menuids.command");
    const logChannelCustomId = MessageService.get("setupsettings.menuids.logchannel");

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === commandCustomId) {
        const selectedOption = interaction.values[0];
        if (selectedOption === "logchannel") {
          await interaction.deferUpdate();
          return await this.sendOverview(interaction, logChannelCustomId);
        }
      }

      if (interaction.customId === logChannelCustomId) {
        await interaction.deferUpdate();
        const logType = interaction.values[0];

        const instructionContainer = ComponentV2Container(
            "Channel Selection",
            `Please select a thread channel for the log type **${logType}**`
        );

        const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId(`select_channel:${logType}`)
            .setPlaceholder(`📜 | Choose a Thread Channel for ${logType}`)
            .addChannelTypes(ChannelTypes.PublicThread, ChannelTypes.PrivateThread);

        const row = new ActionRowBuilder().addComponents(channelSelect);

        return await interaction.editReply({
          content: "",
          components: [instructionContainer, row],
          flags: 32768
        });
      }
    }

    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("select_channel:")) {
      await interaction.deferUpdate();

      const logType = interaction.customId.split(":")[1];
      const channelId = interaction.values[0];
      const channelName = interaction.channels.first()?.name || "Unknown Thread";

      try {
        const uniqueId = `${interaction.guildId}-${logType}`;

        await interaction.client.database.save("DiscordLogChannel", uniqueId, {
          guildId: interaction.guildId,
          logType: logType,
          channelId: channelId,
          name: channelName
        });

        return await this.sendOverview(interaction, logChannelCustomId);
      } catch (error) {
        console.error("Database Save Error:", error);
        return Guardian.handleEvent("Error while Saving in Database", interaction);
      }
    }
  }

  async sendOverview(interaction, logChannelCustomId) {
    try {
      const setupSettingsConf = ConfigService.get("setupsettings");
      if (!setupSettingsConf || !setupSettingsConf[0]) {
        throw new Error("Config 'setupsettings' not found");
      }
      const config = setupSettingsConf[0];

      const activeChannels = await interaction.client.database.findMany("DiscordLogChannel", {
        guildId: interaction.guildId,
      });

      const logOptions = config.logchannel;
      const activeMap = new Map(activeChannels.map(ch => [ch.logType, ch.channelId]));

      const statusList = logOptions.map(option => {
        const setChannelId = activeMap.get(option.value);
        const statusEmoji = setChannelId ? "✅" : "❌";
        const channelInfo = setChannelId ? `→ <#${setChannelId}>` : "*Not Configured*";
        return `${statusEmoji} **${option.name}**\n╰ ${channelInfo}`;
      }).join("\n\n");

      const title = "Log Channel Configuration";
      const description = `State of all Log System Channels:\n\n${statusList}`;

      const container = ComponentV2Container(title, description);

      const pages = config.logchannel;
      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(logChannelCustomId)
          .setPlaceholder("📜 | Choose a Category")
          .addOptions(
              pages.map((page) =>
                  new StringSelectMenuOptionBuilder()
                      .setLabel(page.name)
                      .setValue(page.value)
                      .setDescription(page.description)
                      .setEmoji(page.emoji)
              )
          );

      const actionRow = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.editReply({
        content: "",
        components: [container, actionRow],
        flags: 32768
      });
    } catch (error) {
      console.error("Overview Error:", error);
      await Guardian.handleEvent("An Overview Error", interaction);
    }
  }
}

module.exports = SetupSettings;