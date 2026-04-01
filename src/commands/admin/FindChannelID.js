const Command = require("../../structures/Command");
const { SlashCommandBuilder } = require("discord.js");
const Permissions = require("../../enums/Permissions");
const ChannelTypes = require("../../enums/ChannelTypes");

class FindChannelID extends Command {
  constructor() {
    super({
      name: "findchannelid",
      description: "Find Spefic Channel ID",
    });

    this.data = new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
        .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Select a channel to find its ID')
            .addChannelTypes(
                ChannelTypes.Text,
                ChannelTypes.Voice,
                ChannelTypes.Category,
                ChannelTypes.Announcement,
                ChannelTypes.AnnouncementThread,
                ChannelTypes.PublicThread,
                ChannelTypes.PrivateThread,
                ChannelTypes.StageVoice,
                ChannelTypes.Forum,
                ChannelTypes.Media
            )
            .setRequired(true)
        )
        .setDefaultMemberPermissions(Permissions.Administrator.toString());
  }

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel) {
            await interaction.reply({ content: 'Channel not found. Please select a valid channel.', ephemeral: true });
            return;
        }

        let response = `The ID of the channel **${channel.name}** is: \`${channel.id}\``;

        if (channel.isThread() && channel.parent) {
            const parentName = channel.parent.name;

            if (channel.parent.type === ChannelTypes.Forum) {
                response = `The ID of the Forum-Thread **${channel.name}** (inside Forum **${parentName}**) is: \`${channel.id}\``;
            } else {
                response = `The ID of the Thread **${channel.name}** (inside **${parentName}**) is: \`${channel.id}\``;
            }
        }

        await interaction.reply({ content: response, ephemeral: true });
    }
}

module.exports = FindChannelID;