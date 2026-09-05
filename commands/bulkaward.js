const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');

const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');
const { isAdmin } = require('../utils/permissions');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bulkaward')
    .setDescription('Give up to 10 badges to one baddie (Team Only)')
    .addUserOption(option =>
      option
        .setName('member')
        .setDescription('Baddie to give the badges to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('badge1')
        .setDescription('First badge')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge2')
        .setDescription('Second badge')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge3')
        .setDescription('Third badge')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge4')
        .setDescription('Fourth badge')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge5')
        .setDescription('Fifth badge')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge6')
        .setDescription('Sixth badge')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge7')
        .setDescription('Seventh badge')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge8')
        .setDescription('Eighth badge')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge9')
        .setDescription('Ninth badge')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('badge10')
        .setDescription('Tenth badge')
        .setRequired(false)
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
      console.error('Bulk award autocomplete error:', error);

      if (!interaction.responded && !interaction.replied) {
        try {
          await interaction.respond([]);
        } catch {}
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

    const badgeNames = [];

    for (let i = 1; i <= 10; i++) {
      const badgeName = interaction.options.getString(`badge${i}`);

      if (
        badgeName &&
        !badgeNames.some(
          existing =>
            existing.toLowerCase() === badgeName.toLowerCase()
        )
      ) {
        badgeNames.push(badgeName);
      }
    }

    try {
      const badges = await Badge.find({
        name: {
          $in: badgeNames
        }
      })
        .populate('category')
        .lean();

      const badgeMap = new Map(
        badges.map(badge => [
          badge.name.toLowerCase(),
          badge
        ])
      );

      const foundBadges = [];
      const missingBadges = [];

      for (const badgeName of badgeNames) {
        const badge = badgeMap.get(
          badgeName.toLowerCase()
        );

        if (badge) {
          foundBadges.push(badge);
        } else {
          missingBadges.push(badgeName);
        }
      }

      if (foundBadges.length === 0) {
        return interaction.editReply({
          content: '❌ None of the selected badges could be found.'
        });
      }

      const existingUserBadges = await UserBadge.find({
        userId: targetUser.id,
        guildId: interaction.guild.id,
        badgeId: {
          $in: foundBadges.map(badge => badge._id)
        }
      })
        .select({
          badgeId: 1,
          _id: 0
        })
        .lean();

      const existingBadgeIds = new Set(
        existingUserBadges.map(entry =>
          String(entry.badgeId)
        )
      );

      const duplicateBadges = foundBadges.filter(
        badge =>
          existingBadgeIds.has(String(badge._id))
      );

      const badgesToAward = foundBadges.filter(
        badge =>
          !existingBadgeIds.has(String(badge._id))
      );

      const awardedBadges = [];
      const failedBadges = [];

      if (badgesToAward.length > 0) {
        try {
          await UserBadge.insertMany(
            badgesToAward.map(badge => ({
              userId: targetUser.id,
              guildId: interaction.guild.id,
              badgeId: badge._id,
              awardedBy: interaction.user.id
            })),
            {
              ordered: false
            }
          );

          awardedBadges.push(...badgesToAward);
        } catch (insertError) {
          console.error(
            'Bulk award insert error:',
            insertError
          );

          const insertedRecords = await UserBadge.find({
            userId: targetUser.id,
            guildId: interaction.guild.id,
            badgeId: {
              $in: badgesToAward.map(
                badge => badge._id
              )
            }
          })
            .select({
              badgeId: 1,
              _id: 0
            })
            .lean();

          const insertedIds = new Set(
            insertedRecords.map(entry =>
              String(entry.badgeId)
            )
          );

          for (const badge of badgesToAward) {
            if (
              insertedIds.has(String(badge._id))
            ) {
              awardedBadges.push(badge);
            } else {
              failedBadges.push(badge);
            }
          }
        }
      }

      if (awardedBadges.length > 0) {
        try {
          const badgeLogThread =
            await interaction.guild.channels.fetch(
              config.badgeLogThreadId
            );

          if (
            badgeLogThread &&
            typeof badgeLogThread.send === 'function'
          ) {
            const badgeList = awardedBadges
              .map(
                badge => `> **${badge.name}**`
              )
              .join('\n');

            await badgeLogThread.send({
              content:
                `## Badges Awarded\n` +
                `${targetUser} was given the following badges:\n${badgeList}\n\n` +
                `**Awarded By:** <@${interaction.user.id}>`
            });
          } else {
            console.error(
              'Badge log thread could not be found or cannot receive messages.'
            );
          }
        } catch (logError) {
          console.error(
            'Badges were awarded, but the activity log failed:',
            logError
          );
        }
      }

      const summaryEmbed = new EmbedBuilder()
        .setColor('#F45AA5')
        .setTitle('🎖️ Bulk Badge Award Complete!')
        .setDescription(
          `Finished processing badges for ${targetUser}.`
        );

      if (awardedBadges.length > 0) {
        summaryEmbed.addFields({
          name: `✨ Successfully Awarded (${awardedBadges.length})`,
          value: awardedBadges
            .map(
              badge => `> ${badge.name}`
            )
            .join('\n')
        });
      }

      if (duplicateBadges.length > 0) {
        summaryEmbed.addFields({
          name: `📚 Already in Their Library (${duplicateBadges.length})`,
          value: duplicateBadges
            .map(
              badge => `> ${badge.name}`
            )
            .join('\n')
        });
      }

      if (missingBadges.length > 0) {
        summaryEmbed.addFields({
          name: `❓ Badge Not Found (${missingBadges.length})`,
          value: missingBadges
            .map(
              badgeName => `> ${badgeName}`
            )
            .join('\n')
        });
      }

      if (failedBadges.length > 0) {
        summaryEmbed.addFields({
          name: `⚠️ Couldn't Award (${failedBadges.length})`,
          value: failedBadges
            .map(
              badge => `> ${badge.name}`
            )
            .join('\n')
        });
      }

      summaryEmbed
        .setFooter({
          text:
            `${awardedBadges.length} awarded • ` +
            `${duplicateBadges.length} duplicate${
              duplicateBadges.length === 1 ? '' : 's'
            } • ` +
            `${failedBadges.length} failed`
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [summaryEmbed]
      });
    } catch (error) {
      console.error(
        'Error bulk awarding badges:',
        error
      );

      await interaction.editReply({
        content:
          '❌ An error occurred while processing the bulk badge award.'
      });
    }
  }
};