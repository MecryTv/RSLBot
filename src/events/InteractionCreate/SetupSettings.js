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
    const logChannelCustomId = MessageService.get("setupsettings.menuids.logchannel");
    const teamRolesCustomId = MessageService.get("setupsettings.menuids.teamroles");

    if (interaction.isStringSelectMenu()) {

      if (interaction.customId === commandCustomId) {
        const selectedOption = interaction.values[0];
        if (selectedOption === "logchannel") {
          await interaction.deferUpdate();
          return await this.sendLogChannelOverview(interaction, logChannelCustomId);
        } else if (selectedOption === "teamroles") {
          await interaction.deferUpdate();
          return await this.sendTeamRolesOverview(interaction, teamRolesCustomId);
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

      if (interaction.customId === teamRolesCustomId) {
        const action = interaction.values[0];

        if (action === "addteamrole") {
          await interaction.deferUpdate();

          const container = ComponentV2Container("Role Selection", "Please choose the Discord Role you want to add to the Team Overview.");
          const roleSelect = new RoleSelectMenuBuilder()
              .setCustomId("teamrole_add_select")
              .setPlaceholder("👥 | Select a Discord Role");

          return await interaction.editReply({
            components: [container, new ActionRowBuilder().addComponents(roleSelect)]
          });
        }

        if (action === "removeteamrole" || action === "editteamrole") {
          await interaction.deferUpdate();

          const activeRoles = await interaction.client.database.findMany("TeamRoles", { guildId: interaction.guildId });
          if (activeRoles.length === 0) {
            const container = ComponentV2Container("⚠️ No Roles Found", "There are no team roles configured yet that you could modify.");
            return await interaction.editReply({ components: [container] });
          }

          const menuId = action === "removeteamrole" ? "teamrole_remove_select" : "teamrole_edit_select";
          const placeholder = action === "removeteamrole" ? "❌ | Choose a Role to Remove" : "✏️ | Choose a Role to Edit";

          const roleMenu = new StringSelectMenuBuilder()
              .setCustomId(menuId)
              .setPlaceholder(placeholder);

          activeRoles.sort((a, b) => a.sortIndex - b.sortIndex);
          activeRoles.forEach(r => {
            roleMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(`${r.roleName} (Index: ${r.sortIndex})`).setValue(r.roleId));
          });

          const container = ComponentV2Container("Role Selection", `Please select the team role you want to ${action === "removeteamrole" ? "remove" : "edit"}.`);
          return await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(roleMenu)] });
        }
      }

      if (interaction.customId === "teamrole_remove_select") {
        await interaction.deferUpdate();
        const roleId = interaction.values[0];

        try {
          await interaction.client.database.delete("TeamRoles", roleId, true);
          return await this.sendTeamRolesOverview(interaction, teamRolesCustomId);
        } catch (error) {
          console.error("Database Delete Error:", error);
          return Guardian.handleEvent("Error while removing role from Database", interaction);
        }
      }

      if (interaction.customId === "teamrole_edit_select") {
        const roleId = interaction.values[0];
        return await this.sendSortIndexModal(interaction, `teamrole_edit_modal:${roleId}`);
      }
    }

    if (interaction.isRoleSelectMenu() && interaction.customId === "teamrole_add_select") {
      const roleId = interaction.values[0];
      return await this.sendSortIndexModal(interaction, `teamrole_add_modal:${roleId}`);
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
        return await this.sendLogChannelOverview(interaction, logChannelCustomId);
      } catch (error) {
        console.error("Database Save Error:", error);
        return Guardian.handleEvent("Error while Saving in Database", interaction);
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
        const container = ComponentV2Container("⚠️ Invalid Input", "The sort index must be a valid, positive number (e.g. 0, 1, 2).");
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

        return await this.sendTeamRolesOverview(interaction, teamRolesCustomId);
      } catch (error) {
        console.error("Database Role Save Error:", error);
        return Guardian.handleEvent("Error while updating Team Role in Database", interaction);
      }
    }
  }

  async sendLogChannelOverview(interaction, logChannelCustomId) {
    try {
      const setupSettingsConf = ConfigService.get("setupsettings");
      if (!setupSettingsConf || !setupSettingsConf[0]) throw new Error("Config 'setupsettings' not found");
      const config = setupSettingsConf[0];

      const activeChannels = await interaction.client.database.findMany("DiscordLogChannel", { guildId: interaction.guildId });
      const logOptions = config.logchannel;
      const activeMap = new Map(activeChannels.map(ch => [ch.logType, ch.channelId]));

      const statusList = logOptions.map(option => {
        const setChannelId = activeMap.get(option.value);
        const statusEmoji = setChannelId ? "✅" : "❌";
        const channelInfo = setChannelId ? `→ <#${setChannelId}>` : "*Not Configured*";
        return `${statusEmoji} **${option.name}**\n╰ ${channelInfo}`;
      }).join("\n\n");

      const container = ComponentV2Container("Log Channel Configuration", `State of all Log System Channels:\n\n${statusList}`);
      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(logChannelCustomId)
          .setPlaceholder("📜 | Choose a Category")
          .addOptions(config.logchannel.map(page => new StringSelectMenuOptionBuilder().setLabel(page.name).setValue(page.value).setDescription(page.description).setEmoji(page.emoji)));

      await interaction.editReply({ content: "", components: [container, new ActionRowBuilder().addComponents(selectMenu)], flags: 32768 });
    } catch (error) {
      console.error("Overview Error:", error);
      await Guardian.handleEvent("An Overview Error", interaction);
    }
  }

  async sendTeamRolesOverview(interaction, teamRolesCustomId) {
    try {
      const setupSettingsConf = ConfigService.get("setupsettings");
      if (!setupSettingsConf || !setupSettingsConf[0]) throw new Error("Config 'setupsettings' not found");
      const config = setupSettingsConf[0];

      const activeRoles = await interaction.client.database.findMany("TeamRoles", { guildId: interaction.guildId });

      activeRoles.sort((a, b) => a.sortIndex - b.sortIndex);

      const statusList = activeRoles.length > 0
          ? activeRoles.map((r, index) => `\`#${r.sortIndex}\` → <@&${r.roleId}>`).join("\n")
          : "*No Team Roles configured yet.*";

      const container = ComponentV2Container("Team Roles Overview", `Configure and order the roles for your Team Display:\n\n${statusList}`);
      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(teamRolesCustomId)
          .setPlaceholder("👥 | Select a Team Action")
          .addOptions(config.teamroles.map(opt => new StringSelectMenuOptionBuilder().setLabel(opt.name).setValue(opt.value).setDescription(opt.description).setEmoji(opt.emoji)));

      await interaction.editReply({ content: "", components: [container, new ActionRowBuilder().addComponents(selectMenu)], flags: 32768 });
    } catch (error) {
      console.error("Team Roles Overview Error:", error);
      await Guardian.handleEvent("An Overview Error for Team Roles", interaction);
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