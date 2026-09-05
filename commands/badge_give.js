const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');
const { isAdmin } = require('../utils/permissions');
const { getBadgeImagePath } = require('../utils/fileHandler');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('award')
    .setDescription('Give a badge to up to 10 baddies (Team Only)')
    .addUserOption(option =>
      option
        .setName('member1')
        .setDescription('First baddie to give the badge to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('badge')
        .setDescription('Badge name to give')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addUserOption(option =>
      option
        .setName('member2')
        .setDescription('Second baddie')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('member3')
        .setDescription('Third baddie')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('member4')
        .setDescription('Fourth baddie')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('member5')
        .setDescription('Fifth baddie')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('member6')
        .setDescription('Sixth baddie')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('member7')
        .setDescription('Seventh baddie')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('member8')
        .setDescription('Eighth baddie')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('member9')
        .setDescription('Ninth baddie')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('member10')
        .setDescription('Tenth baddie')
        .setRequired(false)
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
      console.error('Badge autocomplete error:', error);

      if (!interaction.responded && !interaction.replied) {
  try {
    await interaction.respond([]);
  } catch {
    // Another bot instance or Discord already handled this interaction.
  }
}
    }
  },

  async execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const targetUsers = [];

  for (let i = 1; i <= 10; i++) {
    const user = interaction.options.getUser(`member${i}`);

    if (
      user &&
      !targetUsers.some(existingUser => existingUser.id === user.id)
    ) {
      targetUsers.push(user);
    }
  }

  const badgeName = interaction.options.getString('badge');

  try {
    const badge = await Badge.findOne({
      name: badgeName
    })
      .populate('category')
      .lean();

    if (!badge) {
      return interaction.editReply({
        content: '❌ Badge not found!'
      });
    }

    const guildId = interaction.guild.id;
    const targetUserIds = targetUsers.map(user => user.id);

    const existingBadges = await UserBadge.find({
      guildId,
      badgeId: badge._id,
      userId: {
        $in: targetUserIds
      }
    })
      .select({
        userId: 1,
        _id: 0
      })
      .lean();

    const existingUserIds = new Set(
      existingBadges.map(entry => entry.userId)
    );

    const duplicateUsers = targetUsers.filter(user =>
      existingUserIds.has(user.id)
    );

    const usersToAward = targetUsers.filter(
      user => !existingUserIds.has(user.id)
    );

    const awardedUsers = [];
    const failedUsers = [];

    if (usersToAward.length > 0) {
      try {
        await UserBadge.insertMany(
          usersToAward.map(user => ({
            userId: user.id,
            guildId,
            badgeId: badge._id,
            awardedBy: interaction.user.id
          })),
          {
            ordered: false
          }
        );

        awardedUsers.push(...usersToAward);
      } catch (insertError) {
        console.error('Bulk badge insert error:', insertError);

        const successfullyInserted = await UserBadge.find({
          guildId,
          badgeId: badge._id,
          userId: {
            $in: usersToAward.map(user => user.id)
          }
        })
          .select({
            userId: 1,
            _id: 0
          })
          .lean();

        const insertedIds = new Set(
          successfullyInserted.map(entry => entry.userId)
        );

        for (const user of usersToAward) {
          if (insertedIds.has(user.id)) {
            awardedUsers.push(user);
          } else {
            failedUsers.push(user);
          }
        }
      }
    }

    // Get everyone's total badge count with one aggregation.
    const badgeCountMap = new Map();

    if (awardedUsers.length > 0) {
      const badgeCounts = await UserBadge.aggregate([
        {
          $match: {
            guildId,
            userId: {
              $in: awardedUsers.map(user => user.id)
            }
          }
        },
        {
          $group: {
            _id: '$userId',
            total: {
              $sum: 1
            }
          }
        }
      ]);

      for (const entry of badgeCounts) {
        badgeCountMap.set(entry._id, entry.total);
      }
    }

    // Send one permanent badge activity log.
    if (awardedUsers.length > 0) {
      try {
        const badgeLogThread = await interaction.guild.channels.fetch(
      config.badgeLogThreadId
    );

    if (
      badgeLogThread &&
      typeof badgeLogThread.send === 'function'
    ) {
      const recipientList = awardedUsers
        .map(user => `${user}`)
        .join(', ');

      await badgeLogThread.send({
        content:
          `## Badge Awarded\n` +
          `The **${badge.name}** badge was awarded to ${recipientList}.\n\n` +
          `**Category:** ${badge.category?.name || 'Uncategorized'}\n` +
          `**Awarded By:** <@${interaction.user.id}>`
      });
    } else {
      console.error(
        'Badge log thread could not be found or cannot receive messages.'
      );
    }
  } catch (logError) {
    console.error(
      'Badge was awarded, but the activity log failed:',
      logError
    );
  }
}

    const summaryEmbed = new EmbedBuilder()
      .setColor('#F45AA5')
      .setTitle('🎖️ Badge Award Complete!')
      .setDescription(
        `The **${badge.name}** badge has finished processing.`
      )
      .addFields(
        {
          name: '🎖️ Badge',
          value: badge.name,
          inline: true
        },
        {
          name: '📁 Category',
          value: badge.category?.name || 'Uncategorized',
          inline: true
        },
        {
          name: '👤 Awarded By',
          value: `<@${interaction.user.id}>`,
          inline: true
        }
      );

    if (awardedUsers.length > 0) {
      summaryEmbed.addFields({
        name: `✨ Successfully Awarded (${awardedUsers.length})`,
        value: awardedUsers
          .map(user => `> ${user}`)
          .join('\n')
      });
    }

    if (duplicateUsers.length > 0) {
      summaryEmbed.addFields({
        name: `📚 Already in Their Library (${duplicateUsers.length})`,
        value: duplicateUsers
          .map(user => `> ${user}`)
          .join('\n')
      });
    }

    if (failedUsers.length > 0) {
      summaryEmbed.addFields({
        name: `⚠️ Couldn't Award (${failedUsers.length})`,
        value: failedUsers
          .map(user => `> ${user}`)
          .join('\n')
      });
    }

    summaryEmbed
      .setFooter({
        text: `${awardedUsers.length} awarded • ${
          duplicateUsers.length
        } duplicate${
          duplicateUsers.length === 1 ? '' : 's'
        } • ${failedUsers.length} failed`
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [summaryEmbed]
    });

    if (typeof global.gc === 'function') {
      setImmediate(() => {
        try {
          global.gc();
        } catch (gcError) {
          console.error('Manual garbage collection failed:', gcError);
        }
      });
    }
  } catch (error) {
    console.error('Error giving badge:', error);

    await interaction.editReply({
      content:
        '❌ An error occurred while processing the badge awards. No additional members were processed.'
    });
  }
}
}