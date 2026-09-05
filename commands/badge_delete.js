
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');
const { isAdmin } = require('../utils/permissions');
const { deleteBadgeImage } = require('../utils/fileHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletebadge')
    .setDescription('Permanently delete a badge (Team Only)')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Badge name to delete')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    try {
      const typedText = interaction.options.getFocused();

      const badges = await Badge.find({
        name: { $regex: typedText, $options: 'i' }
      })
        .sort({ name: 1 })
        .limit(25)
        .lean();

      await interaction.respond(
        badges.map(badge => ({
          name: badge.name,
          value: badge.name
        }))
      );
    } catch (error) {
      console.error('Badge delete autocomplete error:', error);

      if (!interaction.responded) {
        await interaction.respond([]);
      }
    }
  },

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

    const name = interaction.options.getString('name');

    try {
      const badge = await Badge.findOne({ name }).populate('category');

      if (!badge) {
        return interaction.editReply({
          content: '❌ Badge not found!'
        });
      }

      const awardedCount = await UserBadge.countDocuments({
        badgeId: badge._id
      });

      const warningEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Permanently Delete Badge?')
        .setDescription(
          `Are you sure you want to permanently delete the **${badge.name}** badge?`
        )
        .addFields(
          {
            name: '📁 Category',
            value: badge.category?.name || 'Uncategorized',
            inline: true
          },
          {
            name: '👥 Current Owners',
            value: `${awardedCount}`,
            inline: true
          },
          {
            name: '📝 Description',
            value: badge.description || 'No description provided.'
          },
          {
            name: '🚨 This Cannot Be Undone',
            value:
              'The badge, its image, and every member award connected to it will be permanently deleted.'
          }
        );

      const confirmationRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_badge_delete')
          .setLabel('Delete Badge')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId('cancel_badge_delete')
          .setLabel('Cancel')
          .setEmoji('✖️')
          .setStyle(ButtonStyle.Secondary)
      );

      const confirmationMessage = await interaction.editReply({
        embeds: [warningEmbed],
        components: [confirmationRow]
      });

      const filter = buttonInteraction =>
        buttonInteraction.user.id === interaction.user.id;

      try {
        const buttonInteraction =
          await confirmationMessage.awaitMessageComponent({
            filter,
            time: 60000
          });

        if (buttonInteraction.customId === 'cancel_badge_delete') {
          const cancelledEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setTitle('Deletion Cancelled')
            .setDescription(
              `The **${badge.name}** badge was not deleted.`
            );

          return buttonInteraction.update({
            embeds: [cancelledEmbed],
            components: []
          });
        }

        if (buttonInteraction.customId === 'confirm_badge_delete') {
          await buttonInteraction.deferUpdate();

          // Remove the badge from every member
          await UserBadge.deleteMany({
            badgeId: badge._id
          });

          // Remove its saved image
          deleteBadgeImage(badge.imageUrl);

          // Delete the badge itself
          await Badge.findByIdAndDelete(badge._id);

          const deletedEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🗑️ Badge Deleted Successfully!')
            .setDescription(
              `The **${badge.name}** badge has been permanently deleted.`
            )
            .addFields(
              {
                name: '📁 Category',
                value: badge.category?.name || 'Uncategorized',
                inline: true
              },
              {
                name: '👥 Awards Removed',
                value: `${awardedCount}`,
                inline: true
              },
              {
                name: '📝 Description',
                value: badge.description || 'No description provided.'
              }
            )
            .setTimestamp()
            .setFooter({
              text: `Deleted by ${interaction.user.displayName}`
            });

          return interaction.editReply({
            embeds: [deletedEmbed],
            components: []
          });
        }
      } catch (error) {
        if (error.code === 'InteractionCollectorError') {
          const expiredRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_badge_delete')
              .setLabel('Delete Badge')
              .setEmoji('🗑️')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true),

            new ButtonBuilder()
              .setCustomId('cancel_badge_delete')
              .setLabel('Cancel')
              .setEmoji('✖️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

          return interaction.editReply({
            content: '⌛ Confirmation expired. The badge was not deleted.',
            embeds: [warningEmbed],
            components: [expiredRow]
          });
        }

        throw error;
      }
    } catch (error) {
      console.error('Error deleting badge:', error);

      await interaction.editReply({
        content: '❌ An error occurred while deleting the badge.',
        embeds: [],
        components: []
      });
    }
  }
};
