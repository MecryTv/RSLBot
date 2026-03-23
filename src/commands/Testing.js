const Command = require("../structures/Command");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ComponentV2Container = require("../utils/ComponentV2Container");

class Testing extends Command {
  constructor() {
    super({
      name: "testing",
      description: "testing stuff",
    });

    this.data = new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
        .addNumberOption(option =>
        option.setName("number")
        .setDescription("A number option")
        .setRequired(true)
        );
  }

  async execute(interaction) {
      const user = interaction.user;
      const number = interaction.options.getNumber("number");

      const avatar512 = user.displayAvatarURL({ extension: "png", size: 512 });
      const avatar1024 = user.displayAvatarURL({ extension: "png", size: 1024 });

      if (number === 1) {
          const container1 = ComponentV2Container("TESTING CONTENT", "TESTING CONTENT")

          await interaction.reply({
              flags: MessageFlags.IsComponentsV2,
              components: [container1],
          });
      } else if (number === 2) {
          const container2 = ComponentV2Container(
              "TESTING CONTENT",
              "TESTING CONTENT",
              {
                  thumbnailURL: avatar512
              }
          );

          await interaction.reply({
              flags: MessageFlags.IsComponentsV2,
              components: [container2],
          });
      } else if (number === 3) {
          const container3 = ComponentV2Container(
              "TESTING CONTENT",
              "TESTING CONTENT",
              {
                  thumbnailURL: avatar512,
                  mediaImageURL: avatar1024
              }
          );

          await interaction.reply({
              flags: MessageFlags.IsComponentsV2,
              components: [container3],
          });
      }
  }
}

module.exports = Testing;