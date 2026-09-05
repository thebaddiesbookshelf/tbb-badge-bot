const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require('discord.js');

const UserBadge = require('../models/UserBadge');
const Category = require('../models/Category');
const canvasGenerator = require('../utils/canvasGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('librarycard')
    .setDescription('View a baddies library card')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Filter the library card by category')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View another baddie’s library card')
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    try {
      const typedText = interaction.options.getFocused();

      const categories = await Category.find({
        name: { $regex: typedText, $options: 'i' }
      })
        .sort({ name: 1 })
        .limit(25)
        .lean();

      await interaction.respond(
        categories.map(category => ({
          name: category.name,
          value: category.name
        }))
      );
    } catch (error) {
      console.error(
        'Member badge category autocomplete error:',
        error
      );

      if (!interaction.responded) {
        try {
          await interaction.respond([]);
        } catch {}
      }
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    const startingCategory =
      interaction.options.getString('category');

    const targetUser =
      interaction.options.getUser('user') ||
      interaction.user;

    try {
      const guildMember =
        await interaction.guild.members.fetch(
          targetUser.id
        );

      const baddieSince =
        guildMember.joinedAt?.getFullYear() ||
        'Unknown';

      let userBadges = await UserBadge.find({
        userId: targetUser.id,
        guildId: interaction.guild.id
      })
        .populate({
          path: 'badgeId',
          populate: {
            path: 'category'
          }
        })
        .lean();

      userBadges = userBadges.filter(
        userBadge => userBadge.badgeId
      );

      if (userBadges.length === 0) {
        return interaction.editReply({
          content:
            `${targetUser.displayName} has no badges yet.`
        });
      }

      const allBadges = userBadges.map(
        userBadge => ({
          name: userBadge.badgeId.name,
          imagePath: userBadge.badgeId.imageUrl,
          description:
            userBadge.badgeId.description,
          category:
            userBadge.badgeId.category?.name ||
            'Uncategorized'
        })
      );

      const availableCategories = [
        ...new Set(
          allBadges.map(
            badge => badge.category
          )
        )
      ]
        .sort((a, b) =>
          a.localeCompare(b)
        )
        .slice(0, 24);

      let selectedCategory =
        startingCategory || 'All Badges';

      if (
        selectedCategory !== 'All Badges'
      ) {
        const matchingCategory =
          availableCategories.find(
            category =>
              category.toLowerCase() ===
              selectedCategory.toLowerCase()
          );

        if (!matchingCategory) {
          return interaction.editReply({
            content:
              `${targetUser.displayName} has no badges in the **${selectedCategory}** category.`
          });
        }

        selectedCategory =
          matchingCategory;
      }

      let currentPage = 1;

      const getFilteredBadges = () => {
        if (
          selectedCategory === 'All Badges'
        ) {
          return allBadges;
        }

        return allBadges.filter(
          badge =>
            badge.category.toLowerCase() ===
            selectedCategory.toLowerCase()
        );
      };

      const createNavigationRow = (
        pageNumber,
        totalPages
      ) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('librarycard_first')
            .setLabel('≪')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageNumber === 1),

          new ButtonBuilder()
            .setCustomId('librarycard_previous')
            .setLabel('↢')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageNumber === 1),

          new ButtonBuilder()
            .setCustomId('librarycard_done')
            .setLabel('♡ Done ♡')
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId('librarycard_next')
            .setLabel('↣')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
              pageNumber === totalPages
            ),

          new ButtonBuilder()
            .setCustomId('librarycard_last')
            .setLabel('≫')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
              pageNumber === totalPages
            )
        );
      };

      const createCategoryRow = () => {
        const options = [
          {
            label: 'All Badges',
            value: 'All Badges',
            description:
              'View the complete library card',
            default:
              selectedCategory === 'All Badges'
          },

          ...availableCategories.map(
            category => ({
              label: category,
              value: category,
              description:
                `View ${category} badges`,
              default:
                selectedCategory === category
            })
          )
        ];

        const selectMenu =
          new StringSelectMenuBuilder()
            .setCustomId(
              'librarycard_category'
            )
            .setPlaceholder(
              'Browse badges by category'
            )
            .addOptions(options);

        return new ActionRowBuilder()
          .addComponents(selectMenu);
      };

      const createPage = async pageNumber => {
        const badges =
          getFilteredBadges();

        const totalBadgeCount =
          badges.length;

        const totalPages =
          canvasGenerator.calculateMemberPages(
            totalBadgeCount
          );

        currentPage = Math.max(
          1,
          Math.min(
            pageNumber,
            totalPages
          )
        );

        const start =
          (currentPage - 1) *
          canvasGenerator.memberBadgesPerPage;

        const end =
          start +
          canvasGenerator.memberBadgesPerPage;

        const pageBadges = badges.slice(
          start,
          end
        );

        const imageBuffer =
          await canvasGenerator.generateMemberCardPage(
            pageBadges,
            currentPage,
            totalPages,
            targetUser.displayName,
            totalBadgeCount,
            baddieSince
          );

        const attachment =
          new AttachmentBuilder(imageBuffer, {
            name: 'member-badge-card.png'
          });

        const embed = new EmbedBuilder()
          .setColor('#FF1493')
          .setAuthor({
            name: targetUser.displayName,
            iconURL:
              targetUser.displayAvatarURL({
                extension: 'png',
                size: 128
              })
          })
          .setTitle(
            `౨ৎ ${targetUser.displayName}'s Library Card`
          )
          .setDescription(
            selectedCategory !== 'All Badges'
              ? `Showing badges earned in the **${selectedCategory}** collection.`
              : `An official record of the badges ${targetUser.displayName} has earned throughout The Baddies Bookshelf.`
          )
          .setImage(
            'attachment://member-badge-card.png'
          )
          .setFooter({
            text:
              `Library card page ${currentPage} of ${totalPages}` +
              ` • ${totalBadgeCount} badge${
                totalBadgeCount === 1
                  ? ''
                  : 's'
              } earned`
          })
          .setTimestamp();

        return {
          embed,
          attachment,
          navigationRow:
            createNavigationRow(
              currentPage,
              totalPages
            ),
          categoryRow:
            createCategoryRow(),
          totalPages
        };
      };

      const firstPage =
        await createPage(currentPage);

      const message =
        await interaction.editReply({
          embeds: [firstPage.embed],
          files: [firstPage.attachment],
          components: [
            firstPage.navigationRow,
            firstPage.categoryRow
          ]
        });

      const collector =
        message.createMessageComponentCollector({
          time: 300000,
          idle: 60000
        });

      collector.on(
        'collect',
        async componentInteraction => {
          if (
            componentInteraction.user.id !==
            interaction.user.id
          ) {
            return componentInteraction.reply({
              content:
                '❌ These controls belong to the person who opened this library card.',
              ephemeral: true
            });
          }

          if (
            componentInteraction.customId ===
            'librarycard_done'
          ) {
            await componentInteraction.update({
              components: []
            });

            collector.stop('done');
            return;
          }

          if (
            componentInteraction.customId ===
            'librarycard_category'
          ) {
            selectedCategory =
              componentInteraction.values[0];

            currentPage = 1;
          }

          if (
            componentInteraction.customId ===
            'librarycard_first'
          ) {
            currentPage = 1;
          }

          if (
            componentInteraction.customId ===
            'librarycard_previous'
          ) {
            currentPage--;
          }

          if (
            componentInteraction.customId ===
            'librarycard_next'
          ) {
            currentPage++;
          }

          if (
            componentInteraction.customId ===
            'librarycard_last'
          ) {
            const filteredBadges =
              getFilteredBadges();

            currentPage =
              canvasGenerator.calculateMemberPages(
                filteredBadges.length
              );
          }

          const updatedPage =
            await createPage(currentPage);

          await componentInteraction.update({
            embeds: [updatedPage.embed],
            files: [updatedPage.attachment],
            attachments: [],
            components: [
              updatedPage.navigationRow,
              updatedPage.categoryRow
            ]
          });
        }
      );

      collector.on(
        'end',
        async (_, reason) => {
          if (reason === 'done') {
            return;
          }

          await message
            .edit({
              components: []
            })
            .catch(() => {});
        }
      );
    } catch (error) {
      console.error(
        'Error fetching member badges:',
        error
      );

      await interaction.editReply({
        content:
          '❌ An error occurred while opening the library card.'
      });
    }
  }
};