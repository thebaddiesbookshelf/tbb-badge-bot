const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

const UserBadge = require('../models/UserBadge');
const canvasGenerator = require('../utils/canvasGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top badge collectors in The Baddies Bookshelf.'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const badgeData = await UserBadge.find({
        guildId: interaction.guild.id
      }).lean();

      if (!badgeData.length) {
        return interaction.editReply({
          content: 'No badges have been awarded yet.'
        });
      }

      const counts = new Map();

      for (const badge of badgeData) {
        counts.set(
          badge.userId,
          (counts.get(badge.userId) || 0) + 1
        );
      }

      const leaderboard = [...counts.entries()]
        .map(([userId, badgeCount]) => ({
          userId,
          badgeCount
        }))
        .sort((a, b) => {
          if (b.badgeCount !== a.badgeCount) {
            return b.badgeCount - a.badgeCount;
          }

          return a.userId.localeCompare(b.userId);
        });

      const topTen = leaderboard.slice(0, 10);

      const userRank =
        leaderboard.findIndex(
          entry => entry.userId === interaction.user.id
        ) + 1;

      const userBadgeCount =
        counts.get(interaction.user.id) || 0;
                    const leaderboardData = await Promise.all(
        topTen.map(async (entry, index) => {
          let username = 'Unknown User';

          try {
            const member =
              await interaction.guild.members.fetch(entry.userId);

            // Always use the Discord username instead of the server nickname.
            username = member.user.username;
          } catch {
            try {
              const user =
                await interaction.client.users.fetch(entry.userId);

              username = user.username;
            } catch {}
          }

          return {
            rank: index + 1,
            username,
            badgeCount: entry.badgeCount
          };
        })
      );

      const imageBuffer =
        await canvasGenerator.generateLeaderboardCard(
          leaderboardData,
          userRank,
          userBadgeCount,
          interaction.user.displayName
        );

      const attachment = new AttachmentBuilder(imageBuffer, {
        name: 'leaderboard.png'
      });

      const embed = new EmbedBuilder()
        .setColor('#F45AA5')
        .setTitle('౨ৎ Badge Leaderboard')
        .setDescription(
          'The current top badge collectors in **The Baddies Bookshelf**.'
        )
        .setThumbnail(interaction.guild.iconURL())
        .setImage('attachment://leaderboard.png')
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        files: [attachment]
      });
          } catch (error) {
      console.error('Leaderboard error:', error);

      await interaction.editReply({
        content:
          '❌ An error occurred while loading the leaderboard.'
      });
    }
  }
};