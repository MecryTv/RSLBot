const Event = require("../../structures/Events");
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

    if (interaction.isStringSelectMenu() && interaction.customId === commandCustomId) {
      await interaction.deferUpdate();
      const category = interaction.values[0];
      return await this.sendCategoryOverview(interaction, category);
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("setup_action:")) {
      await interaction.deferUpdate();
      const category = interaction.customId.split(":")[1];
      const action = interaction.values[0]; // "add", "edit", "remove"
      return await this.handleCategoryAction(interaction, category, action);
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("setup_key_select:")) {
      const [_, category, action] = interaction.customId.split(":");
      const selectedKey = interaction.values[0];

      if (action === "remove") {
        await interaction.deferUpdate();
        return await this.handleGenericDelete(interaction, category, selectedKey);
      }

      await interaction.deferUpdate();
      return await this.sendChannelSelector(interaction, category, action, selectedKey);
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("setup_role_select:")) {
      const [_, action] = interaction.customId.split(":");
      const roleId = interaction.values[0];

      if (action === "remove") {
        await interaction.deferUpdate();
        try {
          await interaction.client.database.delete("TeamRoles", roleId, false); // Nutzt jetzt sauber Soft Delete!
          return await this.sendCategoryOverview(interaction, "teamroles");
        } catch (error) {
          console.error(error);
          return Guardian.handleEvent("Error removing role from Database", interaction);
        }
      }

      return await this.sendSortIndexModal(interaction, `teamrole_edit_modal:${roleId}`);
    }

    if (interaction.isRoleSelectMenu() && interaction.customId === "setup_role_add_select") {
      const roleId = interaction.values[0];
      return await this.sendSortIndexModal(interaction, `teamrole_add_modal:${roleId}`);
    }

    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("setup_channel_save:")) {
      await interaction.deferUpdate();
      const [_, category, action, selectedKey] = interaction.customId.split(":");
      const channelId = interaction.values[0];
      const channelName = interaction.channels.first()?.name || "Unknown Channel";

      try {
        const modelName = this._getModelName(category);
        const uniqueId = `${interaction.guildId}-${selectedKey}`;

        const saveData = { guildId: interaction.guildId };
        if (category === "logchannel") {
          saveData.logType = selectedKey;
          saveData.channelId = channelId;
          saveData.name = channelName;
        } else {
          saveData.settingKey = selectedKey;
          saveData.value = channelId;
          saveData.name = channelName;
        }

        await interaction.client.database.save(modelName, uniqueId, saveData);
        return await this.sendCategoryOverview(interaction, category);
      } catch (error) {
        console.error(error);
        return Guardian.handleEvent("Error saving channel configuration", interaction);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("teamrole_")) {
      await interaction.deferUpdate();
      const parts = interaction.customId.split(/[_:]/);
      const actionType = parts[1];
      const roleId = parts[3];

      const indexInput = interaction.fields.getTextInputValue("sort_index_input");
      const sortIndex = parseInt(indexInput, 10);

      if (isNaN(sortIndex) || sortIndex < 0) {
        const container = ComponentV2Container("⚠️ Invalid Input", "The sort index must be a valid, positive number.");
        return await interaction.editReply({ components: [container] });
      }

      try {
        if (actionType === "add") {
          const discordRole = interaction.guild.roles.cache.get(roleId);
          const roleName = discordRole ? discordRole.name : "Unknown Role";

          await interaction.client.database.save("TeamRoles", roleId, {
            guildId: interaction.guildId,
            roleName: roleName,
            roleId: roleId,
            sortIndex: sortIndex
          });
        } else if (actionType === "edit") {
          await interaction.client.database.edit("TeamRoles", roleId, {
            sortIndex: sortIndex
          });
        }

        return await this.sendCategoryOverview(interaction, "teamroles");
      } catch (error) {
        console.error(error);
        return Guardian.handleEvent("Error while updating Team Role in Database", interaction);
      }
    }
  }

  _getModelName(category) {
    if (category === "logchannel") return "DiscordLogChannel";
    if (category === "teamroles") return "TeamRoles";
    if (category === "additionalsettings") return "AdditionalSettings";
    throw new Error(`Unknown category: ${category}`);
  }

  _getKeyField(category) {
    if (category === "logchannel") return "logType";
    if (category === "teamroles") return "roleId";
    if (category === "additionalsettings") return "settingKey";
  }

  async sendCategoryOverview(interaction, category) {
    try {
      const config = ConfigService.get("setupsettings")[0];
      const modelName = this._getModelName(category);
      const keyField = this._getKeyField(category);

      const dbEntries = await interaction.client.database.findMany(modelName, { guildId: interaction.guildId });

      let statusText = "";
      let title = "";

      if (category === "teamroles") {
        title = "👥 Team Roles Configuration";
        dbEntries.sort((a, b) => a.sortIndex - b.sortIndex);
        statusText = dbEntries.length > 0
            ? dbEntries.map(r => `\`#${r.sortIndex}\` → <@&${r.roleId}>`).join("\n")
            : "*No Team Roles configured yet.*";
      } else {
        title = category === "logchannel" ? "📁 Log Channel Configuration" : "⚙️ Additional Settings Configuration";
        const options = config[category];
        const activeMap = new Map(dbEntries.map(e => [e[keyField], e.channelId || e.value]));

        statusText = options.map(opt => {
          const channelId = activeMap.get(opt.value);
          return `${channelId ? "✅" : "❌"} **${opt.name}**\n╰ ${channelId ? `→ <#${channelId}>` : "*Not Configured*"}`;
        }).join("\n\n");
      }

      const container = ComponentV2Container(title, statusText);

      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`setup_action:${category}`)
          .setPlaceholder("🛠️ | Select an Action")
          .addOptions(config.shared_actions.map(act =>
              new StringSelectMenuOptionBuilder().setLabel(act.name).setValue(act.value).setDescription(act.description).setEmoji(act.emoji)
          ));

      await interaction.editReply({
        content: "",
        components: [container, new ActionRowBuilder().addComponents(selectMenu)],
        flags: 32768
      });
    } catch (error) {
      console.error(error);
      await Guardian.handleEvent("An Overview Generation Error", interaction);
    }
  }

  async handleCategoryAction(interaction, category, action) {
    try {
      const config = ConfigService.get("setupsettings")[0];
      const modelName = this._getModelName(category);
      const keyField = this._getKeyField(category);

      const dbEntries = await interaction.client.database.findMany(modelName, { guildId: interaction.guildId });
      const activeKeys = new Set(dbEntries.map(e => e[keyField]));

      if (category === "teamroles") {
        if (action === "add") {
          const container = ComponentV2Container("Add Team Role", "Please select a Discord Role to register in the Team Display.");
          const roleSelect = new RoleSelectMenuBuilder().setCustomId("setup_role_add_select").setPlaceholder("👥 | Choose a Role");
          return await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(roleSelect)] });
        }

        if (dbEntries.length === 0) {
          return await interaction.editReply({ components: [ComponentV2Container("⚠️ No Roles", "There are no configured roles to modify.")] });
        }

        const menu = new StringSelectMenuBuilder().setCustomId(`setup_role_select:${action}`).setPlaceholder("👥 | Choose a Team Role");
        dbEntries.sort((a, b) => a.sortIndex - b.sortIndex);
        dbEntries.forEach(r => menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(`${r.roleName} (Index: ${r.sortIndex})`).setValue(r.roleId)));

        return await interaction.editReply({ components: [ComponentV2Container(`${action === "edit" ? "Edit" : "Remove"} Team Role`, "Select a role from the list below:"), new ActionRowBuilder().addComponents(menu)] });
      }

      const options = config[category];
      let filteredOptions = [];

      if (action === "add") {
        filteredOptions = options.filter(opt => !activeKeys.has(opt.value));
      } else {
        filteredOptions = options.filter(opt => activeKeys.has(opt.value));
      }

      if (filteredOptions.length === 0) {
        const desc = action === "add" ? "All available options in this category are already configured." : "There are no configured entries to modify in this category.";
        return await interaction.editReply({ components: [ComponentV2Container("⚠️ No Options Available", desc)] });
      }

      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`setup_key_select:${category}:${action}`)
          .setPlaceholder("⚙️ | Choose an Entry");

      filteredOptions.forEach(opt => {
        selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(opt.name).setValue(opt.value).setDescription(opt.description).setEmoji(opt.emoji));
      });

      const title = `${action.toUpperCase()} - Select Option`;
      const container = ComponentV2Container(title, `Please select which option you want to **${action}**.`);

      return await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(selectMenu)] });

    } catch (error) {
      console.error(error);
      await Guardian.handleEvent("Action Handling Error", interaction);
    }
  }

  async sendChannelSelector(interaction, category, action, selectedKey) {
    const config = ConfigService.get("setupsettings")[0];
    const targetConfig = config[category].find(opt => opt.value === selectedKey);

    const title = `${action === "add" ? "Add" : "Edit"} - Channel Selection`;
    const container = ComponentV2Container(title, `Please select the target channel for **${targetConfig?.name || selectedKey}**.`);

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`setup_channel_save:${category}:${action}:${selectedKey}`)
        .setPlaceholder("📁 | Select a Channel");

    if (targetConfig?.channel_type === "GuildText") {
      channelSelect.addChannelTypes(ChannelTypes.Text);
    } else {
      channelSelect.addChannelTypes(ChannelTypes.PublicThread, ChannelTypes.PrivateThread);
    }

    await interaction.editReply({
      components: [container, new ActionRowBuilder().addComponents(channelSelect)]
    });
  }

  async handleGenericDelete(interaction, category, selectedKey) {
    try {
      const modelName = this._getModelName(category);
      const uniqueId = `${interaction.guildId}-${selectedKey}`;

      await interaction.client.database.delete(modelName, uniqueId, false); // Führt korrekten Soft-Delete aus!
      return await this.sendCategoryOverview(interaction, category);
    } catch (error) {
      console.error(error);
      return Guardian.handleEvent("Error executing generic delete", interaction);
    }
  }

  async sendSortIndexModal(interaction, customId) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle("Set Sorting Position");

    const indexInput = new TextInputBuilder()
        .setCustomId("sort_index_input")
        .setLabel("Sort Index (0 = Top Position)")
        .setPlaceholder("e.g. 0 for Owner, 1 for Admin, 2 for Mod...")
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(3)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(indexInput));
    await interaction.showModal(modal);
  }
}

module.exports = SetupSettings;