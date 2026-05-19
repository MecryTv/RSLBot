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
const EmojiService = require("../../services/EmojiService");
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
      const action = interaction.values[0];
      return await this.handleCategoryAction(interaction, category, action);
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("setup_key_select:")) {
      const [_, category, action] = interaction.customId.split(":");
      const selectedKey = interaction.values[0];

      if (action === "remove") {
        if (category === "supportsystem" && selectedKey === "supportroles") {
          await interaction.deferUpdate();
          const settings = await this._getSupportSettings(interaction);
          return await this.sendSupportRoleRemoveMenu(interaction, settings.supportRoleIds || []);
        }
        if (category === "supportsystem" && selectedKey === "ticketcreateoptions") {
          await interaction.deferUpdate();
          const settings = await this._getSupportSettings(interaction);
          return await this.sendTicketOptionRemoveMenu(interaction, settings.createOptions || []);
        }

        await interaction.deferUpdate();
        return await this.handleGenericDelete(interaction, category, selectedKey);
      }

      const config = ConfigService.get("setupsettings")[0];
      const targetConfig = config[category].find(opt => opt.value === selectedKey);

      if (targetConfig && targetConfig.channel_type) {
        await interaction.deferUpdate();
        return await this.sendChannelSelector(interaction, category, action, selectedKey);
      }

      if (category === "supportsystem") {
        if (["supporttime", "maxopentickets", "ticketpanelmessage"].includes(selectedKey)) {
          return await this.sendSupportTextModal(interaction, selectedKey);
        }

        if (selectedKey === "supportroles") {
          await interaction.deferUpdate();
          const container = ComponentV2Container("🛠️ Support Roles Config", "Select all Discord roles authorized to handle incoming support tickets.");
          const roleMenu = new RoleSelectMenuBuilder()
              .setCustomId("setup_support_roles_select")
              .setPlaceholder("Select Support Roles")
              .setMinValues(1)
              .setMaxValues(10);
          return await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(roleMenu)], flags: 32768 });
        }

        if (selectedKey === "ticketcreateoptions") {
          const settings = await this._getSupportSettings(interaction);

          if (!settings.supportRoleIds || settings.supportRoleIds.length === 0) {
            await interaction.deferUpdate();
            const container = ComponentV2Container("⚠️ Setup Locked", "You must configure your **Support Roles** first before you can manage Ticket Creation Options!");
            return await interaction.editReply({ components: [container], flags: 32768 });
          }

          if (action === "add") {
            return await this.sendTicketOptionModal(interaction);
          } else if (action === "remove") {
            await interaction.deferUpdate();
            return await this.sendTicketOptionRemoveMenu(interaction, settings.createOptions || []);
          }
        }
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "setup_support_role_remove_select") {
      await interaction.deferUpdate();
      const roleIdToRemove = interaction.values[0];
      try {
        const settings = await this._getSupportSettings(interaction);
        settings.supportRoleIds = (settings.supportRoleIds || []).filter(id => id !== roleIdToRemove);

        await interaction.client.database.save("TicketSupportSystem", interaction.guildId, settings);
        await this._updateLiveTicketPanel(interaction);
        return await this.sendCategoryOverview(interaction, "supportsystem");
      } catch (error) {
        console.error(error);
        return Guardian.handleEvent("Error removing support role", interaction);
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "setup_ticketopt_remove_select") {
      await interaction.deferUpdate();
      const optionName = interaction.values[0];
      try {
        const settings = await this._getSupportSettings(interaction);
        const updatedOptions = (settings.createOptions || []).filter(o => o.name !== optionName);

        settings.createOptions = updatedOptions;
        await interaction.client.database.save("TicketSupportSystem", interaction.guildId, settings);

        await this._updateLiveTicketPanel(interaction);
        return await this.sendCategoryOverview(interaction, "supportsystem");
      } catch (error) {
        console.error(error);
        return Guardian.handleEvent("Error removing ticket option", interaction);
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("setup_ticketopt_role;;")) {
      await interaction.deferUpdate();
      const parts = interaction.customId.split(";;");
      const name = parts[1];
      const emoji = parts[2];
      const description = parts.slice(3).join(";;");
      const assignedRoleId = interaction.values[0];

      try {
        const settings = await this._getSupportSettings(interaction);
        const currentOptions = settings.createOptions || [];

        currentOptions.push({
          name,
          description,
          emoji,
          roleId: assignedRoleId
        });

        settings.createOptions = currentOptions;
        await interaction.client.database.save("TicketSupportSystem", interaction.guildId, settings);

        await this._updateLiveTicketPanel(interaction);
        return await this.sendCategoryOverview(interaction, "supportsystem");
      } catch (error) {
        console.error(error);
        return Guardian.handleEvent("Error saving new ticket option", interaction);
      }
    }

    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId === "setup_role_add_select") {
        const roleId = interaction.values[0];
        return await this.sendSortIndexModal(interaction, `teamrole_add_modal:${roleId}`);
      }

      if (interaction.customId === "setup_support_roles_select") {
        await interaction.deferUpdate();
        try {
          const settings = await this._getSupportSettings(interaction);
          settings.supportRoleIds = interaction.values;

          await interaction.client.database.save("TicketSupportSystem", interaction.guildId, settings);

          await this._updateLiveTicketPanel(interaction);
          return await this.sendCategoryOverview(interaction, "supportsystem");
        } catch (error) {
          console.error(error);
          return Guardian.handleEvent("Error saving support roles", interaction);
        }
      }
    }

    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("setup_channel_save:")) {
      await interaction.deferUpdate();
      const [_, category, action, selectedKey] = interaction.customId.split(":");
      const channelId = interaction.values[0];
      const channelName = interaction.channels.first()?.name || "Unknown Channel";

      try {
        const modelName = this._getModelName(category);

        if (category === "supportsystem") {
          const settings = await this._getSupportSettings(interaction);
          const fieldMapping = {
            ticketsforum: "forumChannelId",
            transcriptchannel: "transcriptChannelId",
            ticketpanelchannel: "panelChannelId",
            supportticketwaitroom: "supportWaitroomId"
          };

          settings[fieldMapping[selectedKey]] = channelId;

          await interaction.client.database.save(modelName, interaction.guildId, settings);
          await this._updateLiveTicketPanel(interaction);
        } else {
          const uniqueId = `${interaction.guildId}-${selectedKey}`;
          const saveData = { guildId: interaction.guildId, id: uniqueId };
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
        }

        return await this.sendCategoryOverview(interaction, category);
      } catch (error) {
        console.error(error);
        return Guardian.handleEvent("Error saving channel configuration", interaction);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("setup_support_txtmodal:")) {
        await interaction.deferUpdate();
        const key = interaction.customId.split(":")[1];
        const textValue = interaction.fields.getTextInputValue("support_text_input");

        try {
          const settings = await this._getSupportSettings(interaction);

          if (key === "supporttime") settings.supportTime = textValue;
          if (key === "ticketpanelmessage") settings.panelMessage = textValue;
          if (key === "maxopentickets") {
            const num = parseInt(textValue, 10);
            settings.maxOpenTickets = isNaN(num) ? 1 : num;
          }

          await interaction.client.database.save("TicketSupportSystem", interaction.guildId, settings);
          await this._updateLiveTicketPanel(interaction);
          return await this.sendCategoryOverview(interaction, "supportsystem");
        } catch (error) {
          console.error(error);
          return Guardian.handleEvent("Error updating text settings", interaction);
        }
      }

      if (interaction.customId === "setup_ticketopt_modal") {
        const name = interaction.fields.getTextInputValue("opt_name");
        const description = interaction.fields.getTextInputValue("opt_desc");
        const emojiInput = interaction.fields.getTextInputValue("opt_emoji").trim();

        let finalEmoji = "🎫";
        if (emojiInput) {
          const customGuildEmoji = interaction.guild.emojis.cache.find(e => e.name === emojiInput);
          if (customGuildEmoji) {
            EmojiService.saveServerEmoji(customGuildEmoji.name, customGuildEmoji.id);
            finalEmoji = customGuildEmoji.toString();
          } else if (EmojiService.emojis.has(emojiInput)) {
            finalEmoji = EmojiService.getLocal(emojiInput).toString();
          } else {
            finalEmoji = emojiInput;
          }
        }

        await interaction.deferUpdate();
        return await this.sendTicketOptionRoleSelector(interaction, name, description, finalEmoji);
      }

      if (interaction.customId.startsWith("teamrole_")) {
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
              id: roleId,
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
  }

  _getModelName(category) {
    if (category === "logchannel") return "DiscordLogChannel";
    if (category === "teamroles") return "TeamRoles";
    if (category === "additionalsettings") return "AdditionalSettings";
    if (category === "supportsystem") return "TicketSupportSystem";
    throw new Error(`Unknown category: ${category}`);
  }

  _getKeyField(category) {
    if (category === "logchannel") return "logType";
    if (category === "teamroles") return "roleId";
    if (category === "additionalsettings") return "settingKey";
    return null;
  }

  async _getSupportSettings(interaction) {
    const settings = await interaction.client.database.findOne("TicketSupportSystem", { guildId: interaction.guildId }) || {};
    return {
      id: interaction.guildId,
      guildId: interaction.guildId,
      forumChannelId: settings.forumChannelId ?? "",
      transcriptChannelId: settings.transcriptChannelId ?? null,
      panelChannelId: settings.panelChannelId ?? null,
      supportWaitroomId: settings.supportWaitroomId ?? null,
      supportRoleIds: settings.supportRoleIds ?? [],
      supportTime: settings.supportTime ?? null,
      maxOpenTickets: settings.maxOpenTickets ?? null,
      panelMessage: settings.panelMessage ?? null,
      createOptions: settings.createOptions ?? []
    };
  }

  async _updateLiveTicketPanel(interaction) {
    try {
      const settings = await this._getSupportSettings(interaction);

      const msgSetting = await interaction.client.database.findOne("AdditionalSettings", {
        guildId: interaction.guildId,
        settingKey: "ticket_panel_msg_id"
      });

      let oldChannelId = null;
      let oldMsgId = null;

      if (msgSetting && msgSetting.value) {
        if (msgSetting.value.includes(":")) {
          [oldChannelId, oldMsgId] = msgSetting.value.split(":");
        } else {
          oldChannelId = settings.panelChannelId;
          oldMsgId = msgSetting.value;
        }
      }

      if (!settings.panelChannelId || !settings.forumChannelId || !settings.createOptions || settings.createOptions.length === 0) {
        if (oldMsgId && oldChannelId) {
          const oldChannel = await interaction.guild.channels.fetch(oldChannelId).catch(() => null);
          if (oldChannel) {
            const oldMsg = await oldChannel.messages.fetch(oldMsgId).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => null);
          }
          const uniqueId = `${interaction.guildId}-ticket_panel_msg_id`;
          await interaction.client.database.delete("AdditionalSettings", uniqueId, false).catch(() => null);
        }
        return;
      }

      const panelChannel = await interaction.guild.channels.fetch(settings.panelChannelId).catch(() => null);
      if (!panelChannel) return;

      const teamRolesEntries = await interaction.client.database.findMany("TeamRoles", { guildId: interaction.guildId });
      let onlineCount = 0;
      if (teamRolesEntries.length > 0) {
        const roleIds = teamRolesEntries.map(r => r.roleId);
        onlineCount = interaction.guild.members.cache.filter(member =>
            roleIds.some(roleId => member.roles.cache.has(roleId)) &&
            member.presence?.status && member.presence.status !== "offline"
        ).size;
      }

      const title = "🎫 Support Ticket Panel";
      const description = settings.panelMessage || "Welcome to Support! Please select a category from the select menu below to open a ticket.";

      const supportTimeStr = settings.supportTime ? `🕒 **Support-Zeiten:**\n╰ ${settings.supportTime}` : "🕒 **Support-Zeiten:**\n╰ Rund um die Uhr";
      const teamStatusStr = `👥 **Team Online:**\n╰ ${onlineCount} Supporter aktiv`;

      const container = ComponentV2Container(title, description, {
        columns: [supportTimeStr, teamStatusStr]
      });

      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("ticket_panel_select")
          .setPlaceholder("🆘 | Select a support category...");

      settings.createOptions.forEach(opt => {
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(opt.name)
            .setValue(`ticket_category:${opt.name}`)
            .setDescription(opt.description.substring(0, 100));

        if (opt.emoji) {
          const customEmojiRegex = /<a?:(\w+):(\d+)>/;
          const match = customEmojiRegex.exec(opt.emoji);
          if (match) option.setEmoji(match[2]);
          else option.setEmoji(opt.emoji);
        }
        selectMenu.addOptions(option);
      });

      const actionRow = new ActionRowBuilder().addComponents(selectMenu);

      let existingMessage = null;
      if (oldChannelId && oldMsgId) {
        const oldChannel = await interaction.guild.channels.fetch(oldChannelId).catch(() => null);
        if (oldChannel) {
          existingMessage = await oldChannel.messages.fetch(oldMsgId).catch(() => null);
        }
      }

      if (existingMessage) {
        if (oldChannelId !== settings.panelChannelId) {
          await existingMessage.delete().catch(() => null);
          existingMessage = null;
        } else {
          await existingMessage.edit({ content: "", components: [container, actionRow], flags: 32768 });
          return;
        }
      }

      const newMsg = await panelChannel.send({ content: "", components: [container, actionRow], flags: 32768 });
      const uniqueId = `${interaction.guildId}-ticket_panel_msg_id`;

      await interaction.client.database.save("AdditionalSettings", uniqueId, {
        id: uniqueId,
        guildId: interaction.guildId,
        settingKey: "ticket_panel_msg_id",
        value: `${panelChannel.id}:${newMsg.id}`,
        name: "Ticket Panel Message ID"
      });

    } catch (error) {
      console.error(`[Task: LivePanelUpdate] Failure: ${error.message}`);
    }
  }

  async sendCategoryOverview(interaction, category) {
    try {
      const config = ConfigService.get("setupsettings")[0];
      const modelName = this._getModelName(category);
      let statusText = "";
      let title = "";

      if (category === "teamroles") {
        title = "👥 Team Roles Configuration";
        const dbEntries = await interaction.client.database.findMany(modelName, { guildId: interaction.guildId });
        dbEntries.sort((a, b) => a.sortIndex - b.sortIndex);
        statusText = dbEntries.length > 0
            ? dbEntries.map(r => `\`#${r.sortIndex}\` → <@&${r.roleId}>`).join("\n")
            : "*No Team Roles configured yet.*";
      }
      else if (category === "supportsystem") {
        title = "🆘 Support System Setup";
        const settings = await this._getSupportSettings(interaction);
        const options = config.supportsystem;

        statusText = options.map(opt => {
          let val = null;
          if (opt.value === "ticketsforum") val = settings.forumChannelId !== "" ? settings.forumChannelId : null;
          else if (opt.value === "transcriptchannel") val = settings.transcriptChannelId;
          else if (opt.value === "ticketpanelchannel") val = settings.panelChannelId;
          else if (opt.value === "supportticketwaitroom") val = settings.supportWaitroomId;
          else if (opt.value === "supportroles") val = settings.supportRoleIds?.length ? settings.supportRoleIds.map(id => `<@&${id}>`).join(", ") : null;
          else if (opt.value === "supporttime") val = settings.supportTime;
          else if (opt.value === "maxopentickets") val = settings.maxOpenTickets;
          else if (opt.value === "ticketpanelmessage") val = settings.panelMessage;
          else if (opt.value === "ticketcreateoptions") {
            val = settings.createOptions?.length ? settings.createOptions.map(o => {
              const roleDisplay = o.roleId === "all" ? "👥 *All Support Roles (Default)*" : `<@&${o.roleId}>`;
              return `${o.emoji} **${o.name}** ➔ ${roleDisplay}`;
            }).join("\n") : null;
          }

          const isSet = val !== null && val !== undefined && val !== "";
          let displayVal = "*Not Configured*";
          if (isSet) {
            if (["ticketsforum", "transcriptchannel", "ticketpanelchannel", "supportticketwaitroom"].includes(opt.value)) {
              displayVal = `→ <#${val}>`;
            } else if (opt.value === "ticketcreateoptions") {
              displayVal = `\n${val}`;
            } else {
              displayVal = `→ **${val}**`;
            }
          }

          let displayName = opt.name;
          if (opt.value === "supportticketwaitroom") {
            displayName = "Support Waitroom";
          }

          return `${isSet ? "✅" : "❌"} **${displayName}**\n╰ ${displayVal}`;
        }).join("\n\n");
      }
      else {
        title = category === "logchannel" ? "📁 Log Channel Configuration" : "⚙️ Additional Settings Configuration";
        const dbEntries = await interaction.client.database.findMany(modelName, { guildId: interaction.guildId });
        const keyField = this._getKeyField(category);
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

      if (category === "teamroles") {
        if (action === "add") {
          const container = ComponentV2Container("Add Team Role", "Please select a Discord Role to register in the Team Display.");
          const roleSelect = new RoleSelectMenuBuilder().setCustomId("setup_role_add_select").setPlaceholder("👥 | Choose a Role");
          return await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(roleSelect)] });
        }
        const dbEntries = await interaction.client.database.findMany(modelName, { guildId: interaction.guildId });
        if (dbEntries.length === 0) {
          return await interaction.editReply({ components: [ComponentV2Container("⚠️ No Roles", "There are no configured roles to modify.")] });
        }
        const menu = new StringSelectMenuBuilder().setCustomId(`setup_role_select:${action}`).setPlaceholder("👥 | Choose a Team Role");
        dbEntries.sort((a, b) => a.sortIndex - b.sortIndex);
        dbEntries.forEach(r => menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(`${r.roleName} (Index: ${r.sortIndex})`).setValue(r.roleId)));
        return await interaction.editReply({ components: [ComponentV2Container(`${action === "edit" ? "Edit" : "Remove"} Team Role`, "Select a role from the list below:"), new ActionRowBuilder().addComponents(menu)] });
      }

      const dbEntries = await interaction.client.database.findMany(modelName, { guildId: interaction.guildId });
      const settings = category === "supportsystem" ? await this._getSupportSettings(interaction) : {};

      const keyField = this._getKeyField(category);
      const activeKeys = new Set();

      if (category === "supportsystem") {
        if (settings.forumChannelId !== "") activeKeys.add("ticketsforum");
        if (settings.transcriptChannelId) activeKeys.add("transcriptchannel");
        if (settings.panelChannelId) activeKeys.add("ticketpanelchannel");
        if (settings.supportWaitroomId) activeKeys.add("supportticketwaitroom");
        if (settings.supportRoleIds?.length) activeKeys.add("supportroles");
        if (settings.supportTime) activeKeys.add("supporttime");
        if (settings.maxOpenTickets) activeKeys.add("maxopentickets");
        if (settings.panelMessage) activeKeys.add("ticketpanelmessage");
        if (settings.createOptions?.length) activeKeys.add("ticketcreateoptions");
      } else {
        dbEntries.forEach(e => activeKeys.add(e[keyField]));
      }

      const options = config[category];
      let filteredOptions = action === "add" ? options.filter(opt => !activeKeys.has(opt.value) || opt.value === "ticketcreateoptions") : options.filter(opt => activeKeys.has(opt.value));

      if (filteredOptions.length === 0) {
        return await interaction.editReply({ components: [ComponentV2Container("⚠️ Complete", "All parameters for this action are currently filled or empty.")] });
      }

      const selectMenu = new StringSelectMenuBuilder().setCustomId(`setup_key_select:${category}:${action}`).setPlaceholder("⚙️ | Choose an Entry");
      filteredOptions.forEach(opt => {
        let displayName = opt.name;
        if (opt.value === "supportticketwaitroom") {
          displayName = "Support Waitroom";
        }
        selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(displayName).setValue(opt.value).setDescription(opt.description).setEmoji(opt.emoji));
      });

      return await interaction.editReply({ components: [ComponentV2Container(`Config - ${action.toUpperCase()}`, "Please select which setting you want to access:"), new ActionRowBuilder().addComponents(selectMenu)] });
    } catch (error) {
      console.error(error);
      await Guardian.handleEvent("Action Handling Error", interaction);
    }
  }

  async sendChannelSelector(interaction, category, action, selectedKey) {
    const config = ConfigService.get("setupsettings")[0];
    const targetConfig = config[category].find(opt => opt.value === selectedKey);

    let displayName = targetConfig.name;
    if (selectedKey === "supportticketwaitroom") {
      displayName = "Support Waitroom";
    }

    const container = ComponentV2Container("📁 Channel Selector", `Please assign the target channel for **${displayName}**.`);
    const channelSelect = new ChannelSelectMenuBuilder().setCustomId(`setup_channel_save:${category}:${action}:${selectedKey}`).setPlaceholder("Select Target Channel");

    if (targetConfig.channel_type === "GuildText") channelSelect.addChannelTypes(ChannelTypes.Text);
    else if (targetConfig.channel_type === "Forum") channelSelect.addChannelTypes(ChannelTypes.GuildForum || 15);
    else if (targetConfig.channel_type === "GuildVoice") channelSelect.addChannelTypes(ChannelTypes.GuildVoice || 2);
    else channelSelect.addChannelTypes(ChannelTypes.PublicThread, ChannelTypes.PrivateThread);

    await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(channelSelect)] });
  }

  async sendTicketOptionModal(interaction) {
    const modal = new ModalBuilder().setCustomId("setup_ticketopt_modal").setTitle("New Ticket Category");

    const nameInput = new TextInputBuilder().setCustomId("opt_name").setLabel("Category Name").setPlaceholder("e.g., Player-Report").setStyle(TextInputStyle.Short).setRequired(true);
    const descInput = new TextInputBuilder().setCustomId("opt_desc").setLabel("Description").setPlaceholder("What is this ticket option for?").setStyle(TextInputStyle.Paragraph).setRequired(true);
    const emojiInput = new TextInputBuilder().setCustomId("opt_emoji").setLabel("Option Emoji (Unicode, Name or Key)").setPlaceholder("e.g., 📝, rsl_logo or support.generic").setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(emojiInput));
    await interaction.showModal(modal);
  }

  async sendTicketOptionRoleSelector(interaction, name, description, emoji) {
    const settings = await this._getSupportSettings(interaction);
    const selectMenu = new StringSelectMenuBuilder().setCustomId(`setup_ticketopt_role;;${name};;${emoji};;${description}`).setPlaceholder("Select Responsible Support Role");

    selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel("Default (All Support Roles)").setValue("all").setDescription("All configured support roles will see this ticket category."));

    settings.supportRoleIds.forEach(roleId => {
      const role = interaction.guild.roles.cache.get(roleId);
      selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(role ? role.name : `Role: ${roleId}`).setValue(roleId));
    });

    const container = ComponentV2Container("⚙️ Claim Assignment", `Select which Support Role should be responsible for **${name}** tickets.`);
    await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(selectMenu)], flags: 32768 });
  }

  async sendSupportRoleRemoveMenu(interaction, roleIds) {
    const selectMenu = new StringSelectMenuBuilder().setCustomId("setup_support_role_remove_select").setPlaceholder("Choose a Support Role to remove");
    roleIds.forEach(roleId => {
      const role = interaction.guild.roles.cache.get(roleId);
      selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(role ? role.name : `Role: ${roleId}`).setValue(roleId));
    });

    const container = ComponentV2Container("❌ Remove Support Role", "Select which specific role you want to remove from the authorized list.");
    await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(selectMenu)], flags: 32768 });
  }

  async sendTicketOptionRemoveMenu(interaction, options) {
    const selectMenu = new StringSelectMenuBuilder().setCustomId("setup_ticketopt_remove_select").setPlaceholder("Choose a Ticket Option to delete");
    options.forEach(o => selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(o.name).setValue(o.name).setDescription(o.description.substring(0, 50)).setEmoji(o.emoji)));

    const container = ComponentV2Container("❌ Remove Ticket Category", "Select which category option you want to clear from the panel configuration.");
    await interaction.editReply({ components: [container, new ActionRowBuilder().addComponents(selectMenu)], flags: 32768 });
  }

  async sendSupportTextModal(interaction, key) {
    const modal = new ModalBuilder().setCustomId(`setup_support_txtmodal:${key}`).setTitle("Update Settings");
    const input = new TextInputBuilder().setCustomId("support_text_input");

    if (key === "supporttime") {
      input.setLabel("Support Active Time").setPlaceholder("e.g., 09:00 - 18:00").setStyle(TextInputStyle.Short);
    } else if (key === "maxopentickets") {
      input.setLabel("Max Open Tickets per User").setPlaceholder("e.g., 2").setStyle(TextInputStyle.Short);
    } else if (key === "ticketpanelmessage") {
      input.setLabel("Ticket Panel Embed Message").setPlaceholder("Welcome to Support! Press the button below to open a ticket...").setStyle(TextInputStyle.Paragraph);
    }

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  async handleGenericDelete(interaction, category, selectedKey) {
    try {
      const modelName = this._getModelName(category);

      if (category === "supportsystem") {
        const settings = await this._getSupportSettings(interaction);
        const fieldMapping = {
          ticketsforum: "forumChannelId",
          transcriptchannel: "transcriptChannelId",
          ticketpanelchannel: "panelChannelId",
          supportticketwaitroom: "supportWaitroomId",
          supportroles: "supportRoleIds",
          supporttime: "supportTime",
          maxopentickets: "maxOpenTickets",
          ticketpanelmessage: "panelMessage"
        };

        if (selectedKey === "supportroles") settings.supportRoleIds = [];
        else if (selectedKey === "ticketcreateoptions") settings.createOptions = [];
        else if (selectedKey === "ticketsforum") settings.forumChannelId = "";
        else settings[fieldMapping[selectedKey]] = null;

        await interaction.client.database.save(modelName, interaction.guildId, settings);

        await this._updateLiveTicketPanel(interaction);
      } else {
        const uniqueId = `${interaction.guildId}-${selectedKey}`;
        await interaction.client.database.delete(modelName, uniqueId, false);
      }

      return await this.sendCategoryOverview(interaction, category);
    } catch (error) {
      console.error(error);
      return Guardian.handleEvent("Error executing generic delete", interaction);
    }
  }

  async sendSortIndexModal(interaction, customId) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle("Set Sorting Position");
    const indexInput = new TextInputBuilder().setCustomId("sort_index_input").setLabel("Sort Index (0 = Top Position)").setPlaceholder("e.g., 0, 1, 2...").setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(3).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(indexInput));
    await interaction.showModal(modal);
  }
}

module.exports = SetupSettings;