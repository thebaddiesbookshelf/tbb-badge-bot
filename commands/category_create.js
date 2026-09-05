
const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');

const Category = require('../models/Category');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createcategory')
    .setDescription('Create a new badge category (Team Only)')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Category name')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Category description')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('emoji')
        .setDescription('Category emoji')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    });

    const rawName = interaction.options.getString('name');
    const name = rawName.trim();

    const description =
      interaction.options.getString('description')?.trim() || '';

    const emoji =
      interaction.options.getString('emoji')?.trim() || '🏆';

    try {
      const existingCategory = await Category.findOne({
        name: {
          $regex: `^${escapeRegex(name)}$`,
          $options: 'i'
        }
      });

      if (existingCategory) {
        return interaction.editReply({
          content:
            `❌ A category named **${existingCategory.name}** already exists.`
        });
      }

      const category = await Category.create({
        name,
        description,
        emoji
      });

      const embed = new EmbedBuilder()
        .setColor('#F45AA5')
        .setTitle('✅ Category Created Successfully!')
        .addFields(
          {
            name: '📁 Name',
            value: `${emoji} ${name}`,
            inline: true
          },
          {
            name: '🆔 Category ID',
            value: category._id.toString(),
            inline: true
          },
          {
            name: '📝 Description',
            value: description || 'No description provided.'
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Created by ${interaction.user.displayName}`
        });

      await interaction.editReply({
        embeds: [embed]
      });
    } catch (error) {
      console.error('Error creating category:', error);

      await interaction.editReply({
        content: '❌ An error occurred while creating the category.'
      });
    }
  }
};

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
