
const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags
} = require('discord.js');

const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');
const { isAdmin } = require('../utils/permissions');
const { getBadgeImagePath } = require('../utils/fileHandler');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('revoke')
    .setDescription('Remove a badge from a baddie (Team Only)')
    .addUserOption(option =>
      option
        .setName('member')
        .setDescription('Baddie to remove the badge from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('badge')
        .setDescription('Badge name to remove')
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
      console.error('Badge revoke autocomplete error:', error);

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

    const targetUser = interaction.options.getUser('member');
    const badgeName = interaction.options.getString('badge');

    try {
      const badge = await Badge.findOne({
        name: badgeName
      }).populate('category');

      if (!badge) {
        return interaction.editReply({
          content: '❌ Badge not found!'
        });
      }

      const userBadge = await UserBadge.findOneAndDelete({
        userId: targetUser.id,
        guildId: interaction.guild.id,
        badgeId: badge._id
      });

      if (!userBadge) {
        return interaction.editReply({
          content: `❌ ${targetUser.displayName} doesn't have this badge!`
        });
      }

      const imagePath = getBadgeImagePath(badge.imageUrl);

      const attachment = new AttachmentBuilder(imagePath, {
        name: 'badge.png'
      });

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🚫 Badge Removed!')
        .setThumbnail('attachment://badge.png')
        .setDescription(
          `The **${badge.name}** badge has been removed from ${targetUser}.`
        )
        .addFields(
          {
            name: '📁 Category',
            value: badge.category?.name || 'Uncategorized',
            inline: true
          },
          {
            name: '👤 Removed By',
            value: `<@${interaction.user.id}>`,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        files: [attachment]
      });
      try {
  
        const badgeLogThread = await interaction.guild.channels.fetch(
          config.badgeLogThreadId
      );

    if (
        badgeLogThread &&
          typeof badgeLogThread.send === 'function'
      ) {
    
      await badgeLogThread.send({
        content:
        `## Badge Removed\n` +
        `The **${badge.name}** badge was removed from ${targetUser}.\n\n` +
        `**Category:** ${badge.category?.name || 'Uncategorized'}\n` +
        `**Removed By:** <@${interaction.user.id}>`
      });
      }  else {
    console.error(
      'Badge log thread could not be found or cannot receive messages.'
    );
  }
} catch (logError) {
  console.error(
    'Badge was removed, but the activity log failed:',
    logError
  );
}
    } catch (error) {
      console.error('Error revoking badge:', error);

      await interaction.editReply({
        content: '❌ An error occurred while removing the badge.'
      });
    }
  }
};