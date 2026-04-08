const Command = require("../../structures/Command");
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require("discord.js");
const Permissions = require("../../enums/Permissions");
const ComponentV2Container = require("../../utils/ComponentV2Container");
const ConfigService = require("../../services/ConfigService");
const Guardian = require("../../services/Guardian");

class SetupSettings extends Command {
  constructor() {
    super({
      name: "setupsettings",
      description: "Setup Discord Bot Basic Settings",
    });

    this.data = new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .setDefaultMemberPermissions(Permissions.Administrator);
  }

  async execute(interaction) {
      const title = "Setup Settings";
      const description = "Configure your bot settings here. More options will be added in the future.";

      const setupSettingsConfig = ConfigService.get("setupsettings");
      if (!setupSettingsConfig || !setupSettingsConfig[0] || !setupSettingsConfig[0].pages) {
          await Guardian.handleCommand("The Configurations for the Site didnt found", interaction, "Config Error");

          return interaction.editReply({
              content: "The Configurations for the Site didnt found"
          });
      }

      const pages = setupSettingsConfig[0].pages;
      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("setup-settings-menu")
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

      const container = ComponentV2Container(title, description);

      await interaction.reply({
        components: [container, actionRow],
        flags: 32768
      });
  }
}

module.exports = SetupSettings;